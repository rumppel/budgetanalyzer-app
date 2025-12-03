import StructureStatsService from '../services/StructureStatsService.js';

class StatsController {

  static async getStats(req, res) {
    try {
      const { budget, type, year } = req.params;

      const monthly = await StructureStatsService.monthly(budget, type, year);
      const quarterly = await StructureStatsService.quarterly(budget, type, year);
      const yearly = await StructureStatsService.yearly(budget, type, year);
      const top10 = await StructureStatsService.top10(budget, type, year);
      const structure = await StructureStatsService.structure(budget, type, year);
      const dynamics = await StructureStatsService.dynamics(budget, type);

      res.json({
        budget,
        type,
        year,
        monthly,
        quarterly,
        yearly,
        top10,
        structure,
        dynamics
      });

    } catch (err) {
      console.error("Stats error:", err);
      res.status(500).json({ error: "Failed to generate statistics" });
    }
  }
}

export default StatsController;
