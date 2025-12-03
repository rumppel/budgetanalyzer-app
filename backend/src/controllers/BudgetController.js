import BudgetService from "../services/BudgetService.js";

class BudgetController {
  async list(req, res) {
    try {
      const year = req.query.year || new Date().getFullYear();
      const data = await BudgetService.getAllBudgets(year);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

export default new BudgetController();
