import { Router } from "express";
import * as userController from "../controllers/userController.js";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/roles.js";

const router = Router();

router.use(authenticate);
router.get("/", requireAdmin, userController.getAll);
router.get("/:id", requireAdmin, userController.getById);
router.post("/", requireAdmin, userController.create);
router.put("/:id", requireAdmin, userController.update);
router.delete("/:id", requireAdmin, userController.remove);

export default router;
