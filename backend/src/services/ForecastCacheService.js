// src/services/ForecastCacheService.js
import pool from "../db.js";

class ForecastCacheService {
  async get(budgetCode, type, alpha, window) {
    const { rows } = await pool.query(
      `
      SELECT method, forecast, series
      FROM forecast_cache
      WHERE budget_code=$1
        AND classification_type=$2
        AND params->>'alpha' = $3
        AND params->>'window' = $4
      `,
      [budgetCode, type, String(alpha), String(window)]
    );

    if (!rows.length) return null;

    const methods = {};
    for (const r of rows) {
        methods[r.method] = r.forecast;
    }

    return {
        series: rows[0].series, // series однакова
        methods,
    };
}


  async save(budgetCode, type, alpha, window, result) {
    const params = { alpha, window };
    const series = result.series;

    for (const key of Object.keys(result.methods)) {
      const forecast = result.methods[key];

      await pool.query(
        `
        INSERT INTO forecast_cache (
          budget_code,
          classification_type,
          method,
          params,
          series,
          forecast
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (budget_code, classification_type, method)
        DO UPDATE SET
          params   = EXCLUDED.params,
          series   = EXCLUDED.series,
          forecast = EXCLUDED.forecast,
          updated_at = NOW()
        `,
        [
          budgetCode,                  // ✔ існує
          type,
          key,                         // arithmeticGrowth / movingAverage / ...
          JSON.stringify(params),      // JSON
          JSON.stringify(series),      // масив об’єктів
          JSON.stringify(forecast)     // JSON
        ]
      );
    }
  }
}

export default new ForecastCacheService();
