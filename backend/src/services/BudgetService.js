import pool from "../db.js";

class BudgetService {
  async getBudgetByCommunity(id, year) {
    const q = await pool.query(
      `SELECT * FROM budget WHERE community_id = $1 AND year = $2`,
      [id, year]
    );
    return q.rows[0] || null;
  }

  async getAllBudgets(year) {
    const q = await pool.query(
      `SELECT * FROM budget WHERE year = $1 ORDER BY code`,
      [year]
    );
    return q.rows;
  }
}

export default new BudgetService();
