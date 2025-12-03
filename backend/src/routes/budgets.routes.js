import { Router } from "express";
import BudgetController from "../controllers/BudgetController.js";

const router = Router();

router.get("/budgets", BudgetController.list);

export default router;
