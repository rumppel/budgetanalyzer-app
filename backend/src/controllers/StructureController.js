import StructureService from "../services/StructureService.js";

class StructureController {
  async get(req, res, type) {
    try {
      const { code } = req.params;
      const year = req.query.year || new Date().getFullYear();

      const rows = await StructureService.getStructure(code, year, type);
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
}

export default new StructureController();
