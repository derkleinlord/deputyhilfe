import { Router } from "express";
import * as moduleController from "../controllers/moduleController.js";
import { authenticate } from "../middleware/auth.js";
import { requireTemplateManager } from "../middleware/roles.js";

const router = Router();

router.use(authenticate, requireTemplateManager);
router.post("/:templateId/modules", moduleController.create);
router.put("/:templateId/modules/:moduleId", moduleController.update);
router.delete("/:templateId/modules/:moduleId", moduleController.remove);
router.put("/:templateId/modules/reorder", moduleController.reorder);

export default router;
