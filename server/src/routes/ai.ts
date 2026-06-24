import { Router } from "express";
import { proofread } from "../controllers/aiController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.post("/proofread", authenticate, proofread);

export default router;
