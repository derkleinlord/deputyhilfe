import { Router } from "express";
import * as templateController from "../controllers/templateController.js";
import { authenticate } from "../middleware/auth.js";
import { requireTemplateManager } from "../middleware/roles.js";

const router = Router();

router.use(authenticate);
router.get("/", templateController.getAll);
router.get("/:id", templateController.getById);
router.post("/", requireTemplateManager, templateController.create);
router.put("/reorder", requireTemplateManager, templateController.reorder);
router.put("/:id", requireTemplateManager, templateController.update);
router.delete("/:id", requireTemplateManager, templateController.remove);
router.post("/:id/duplicate", requireTemplateManager, templateController.duplicate);

export default router;
