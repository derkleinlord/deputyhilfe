import { Router } from "express";
import * as draftController from "../controllers/draftController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);
router.get("/", draftController.getAll);
router.get("/:id", draftController.getById);
router.post("/", draftController.create);
router.put("/:id", draftController.update);
router.delete("/:id", draftController.remove);

export default router;
