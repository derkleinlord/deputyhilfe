import { Router } from "express";
import * as tgController from "../controllers/telegramListController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.get("/users", tgController.getUsers);
router.get("/groups", tgController.getMyGroups);
router.post("/groups/join", tgController.joinGroup);
router.post("/groups/leave", tgController.leaveGroup);

router.get("/", tgController.getLists);
router.get("/:id", tgController.getList);
router.post("/", tgController.createList);
router.put("/:id", tgController.updateList);
router.delete("/:id", tgController.deleteList);

router.get("/:id/entries", tgController.getEntries);
router.post("/:id/entries", tgController.createEntry);
router.put("/:id/entries/:entryId", tgController.updateEntry);
router.delete("/:id/entries/:entryId", tgController.deleteEntry);

router.get("/:id/shares", tgController.getShares);
router.post("/:id/shares", tgController.createShare);
router.delete("/:id/shares/:shareId", tgController.deleteShare);

export default router;
