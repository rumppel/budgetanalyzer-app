import ForecastService from "../services/ForecastService.js";
import ForecastCacheService from "../services/ForecastCacheService.js";

class ForecastController {
  async getForecast(req, res) {
    try {
      const { budget, type } = req.params;
      const alpha = Number(req.query.alpha || 0.3);
      const window = Number(req.query.window || 3);

      // 1️⃣ Пробуємо з кешу
        const force = req.query.force === "1";

        // 1️⃣ Якщо force → пропускаємо кеш
        if (!force) {
        const cached = await ForecastCacheService.get(budget, type, alpha, window);
        if (cached) {
            return res.json({
            budget,
            type,
            series: cached.series,
            methods: cached.methods,
            cached: true
            });
        }
        }


        // 2️⃣ Рахуємо прогноз
        const result = await ForecastService.forecast(budget, type, {
        alpha,
        window,
        });

        // 3️⃣ Зберігаємо в кеш ОДИН раз
        await ForecastCacheService.save(budget, type, alpha, window, result);


        // 4️⃣ Віддаємо
        res.json({
        ...result,
        cached: false
        });


    } catch (err) {
      console.error("Forecast error:", err);
      res.status(500).json({ error: "Failed to calculate forecast" });
    }
  }
}

export default new ForecastController();
