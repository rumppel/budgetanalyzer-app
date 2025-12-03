import { Router } from "express";
import StructureController from "../controllers/StructureController.js";

const router = Router();

// програмна
router.get("/budget-program/:code", (req, res) =>
  StructureController.get(req, res, "program")
);

// функціональна
router.get("/budget-functional/:code", (req, res) =>
  StructureController.get(req, res, "functional")
);

// економічна
router.get("/budget-economic/:code", (req, res) =>
  StructureController.get(req, res, "economic")
);

export default router;
