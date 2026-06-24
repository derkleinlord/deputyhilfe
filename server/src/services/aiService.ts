import { config } from "../config.js";

export interface ProofreadSuggestion {
  original: string;
  replacement: string;
  category: "Rechtschreibung" | "Grammatik" | "Zeichensetzung" | "Stil";
  reason: string;
  confidence: "safe" | "review";
}

interface ProofreadResponse {
  suggestions: ProofreadSuggestion[];
}

// Rate limiter: sliding window per userId
const requestLog = new Map<number, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  let timestamps = requestLog.get(userId);
  if (!timestamps) {
    timestamps = [];
    requestLog.set(userId, timestamps);
  }

  const recent = timestamps.filter((t) => t > windowStart);
  requestLog.set(userId, recent);

  if (recent.length >= RATE_LIMIT_MAX) return false;

  recent.push(now);
  requestLog.set(userId, recent);
  return true;
}

const SYSTEM_PROMPT = `Du bist ein Korrekturassistent für polizeiliche Berichte.  
Deine Aufgabe: Prüfe den folgenden Text auf Rechtschreibung, Grammatik, Zeichensetzung, Satzbau und sachlichere Formulierungen.

REGELN:
- Korrigiere NUR Rechtschreibung, Grammatik, Zeichensetzung, Satzbau und formuliere ggf. sachlicher/neutraler.
- Erfinde oder verändere NIEMALS Fakten.
- Namen, TG-Nummern, Orte, Daten, Uhrzeiten, Paragraphen, Seriennummern, Gegenstände, Abkürzungen und Zitate dürfen NICHT verändert werden.
- Keine rechtlichen Bewertungen oder neuen Tatvorwürfe hinzufügen.
- Gib das Ergebnis IMMER als JSON aus:

{
  "suggestions": [
    {
      "original": "fehlerhafter Textabschnitt",
      "replacement": "korrigierter Textabschnitt",
      "category": "Grammatik",
      "reason": "Kurze Begründung der Korrektur",
      "confidence": "safe"
    }
  ]
}

- "category" ist einer von: "Rechtschreibung", "Grammatik", "Zeichensetzung", "Stil"
- "confidence" ist "safe" bei sicheren Korrekturen (Rechtschreibung, Grammatik, Zeichensetzung) oder "review" bei Stil-Änderungen, die subjektiv sein könnten.
- Wenn keine Korrekturen nötig sind, gib ein leeres Array zurück: { "suggestions": [] }
- Gib NUR das JSON-Objekt zurück, ohne zusätzlichen Text.`;

export async function proofreadText(text: string, userId: number): Promise<ProofreadResponse> {
  if (!config.ai.apiKey) {
    return { suggestions: [] };
  }

  if (!checkRateLimit(userId)) {
    throw new Error("Zu viele Anfragen. Bitte warte einen Moment.");
  }

  const response = await fetch(`${config.ai.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.ai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    console.error(`AI API error (${response.status}):`, errBody.slice(0, 200));
    let detail = "";
    try {
      const errJson = JSON.parse(errBody);
      detail = errJson.error?.message || errJson.error || "";
    } catch {}
    throw new Error(`KI-Schnittstelle: ${detail || `HTTP-Fehler ${response.status}`}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Leere Antwort von der KI-Schnittstelle.");
  }

  let parsed: ProofreadResponse;
  try {
    parsed = JSON.parse(content) as ProofreadResponse;
  } catch {
    throw new Error("Ungültiges JSON von der KI-Schnittstelle.");
  }

  if (!Array.isArray(parsed.suggestions)) {
    parsed.suggestions = [];
  }

  // Log only metadata, never full text
  console.log(
    `[ai] proofread: userId=${userId} chars=${text.length} suggestions=${parsed.suggestions.length}`
  );

  return parsed;
}
