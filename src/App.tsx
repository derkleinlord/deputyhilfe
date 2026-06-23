import { AppProvider, useApp } from "./store";
import AppLayout from "./components/AppLayout";
import CaseEditor from "./components/CaseEditor";
import TemplatePage from "./components/TemplatePage";
import DraftList from "./components/DraftList";
import Toast from "./components/Toast";
import "./App.css";

function Content() {
  const { activeView } = useApp();

  switch (activeView) {
    case "write":
      return <CaseEditor />;
    case "templates":
      return <TemplatePage />;
    case "drafts":
      return <DraftList />;
    default:
      return <CaseEditor />;
  }
}

function AppInner() {
  return (
    <AppLayout>
      <Content />
      <Toast />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}
