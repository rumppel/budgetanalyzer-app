// src/routes/forecast.routes.js
import { Router } from "express";
import ForecastController from "../controllers/ForecastController.js";

const router = Router();

// GET /api/forecast/:budget/:type?alpha=0.3&window=3
router.get("/:budget/:type", (req, res) =>
  ForecastController.getForecast(req, res)
);

export default router;
