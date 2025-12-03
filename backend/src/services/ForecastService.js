// src/services/ForecastService.js
import pool from "../db.js";

class ForecastService {
  // 1) тягнемо річні суми фактичних видатків
  async getSeries(budgetCode, type) {
    const { rows } = await pool.query(
        `
        WITH last_months AS (
        SELECT 
            RIGHT(rep_period, 4) AS year,
            MAX(rep_period) AS rep_period
        FROM budget_structure
        WHERE cod_budget = $1
            AND LOWER(classification_type) = LOWER($2)
        GROUP BY RIGHT(rep_period, 4)
        )
        SELECT
        lm.year::int AS year,
        SUM(bs.fakt_amt) AS value
        FROM last_months lm
        JOIN budget_structure bs
        ON bs.rep_period = lm.rep_period
        AND bs.cod_budget = $1
        AND LOWER(bs.classification_type) = LOWER($2)
        GROUP BY lm.year
        ORDER BY lm.year;
        `,
        [budgetCode, type]
    );

    return rows.map(r => ({
        year: Number(r.year),
        value: Number(r.value || 0)
    }))
      .filter((r) => !Number.isNaN(r.year));
  }

  // ---------- 4.1. Метод середнього темпу приросту ----------
  static arithmeticGrowth(series) {
    const n = series.length;
    if (n < 2) return null;

    let sumRates = 0;
    let count = 0;

    for (let i = 1; i < n; i++) {
      const prev = series[i - 1].value;
      const curr = series[i].value;
      if (prev <= 0) continue;
      const rate = (curr - prev) / prev;
      sumRates += rate;
      count++;
    }

    if (!count) return null;

    const avgRate = sumRates / count;
    const last = series[n - 1];

    const forecastValue = last.value * (1 + avgRate);

    return {
      method: "arithmetic_growth",
      lastYear: last.year,
      avgRate,
      forecastYear: last.year + 1,
      forecastValue,
    };
  }

  // ---------- 4.2. Метод ковзного середнього ----------
  static movingAverage(series, window = 3) {
    const n = series.length;
    if (n === 0) return null;

    const k = Math.min(window, n);
    const lastSlice = series.slice(n - k);
    const sum = lastSlice.reduce((acc, p) => acc + p.value, 0);
    const forecastValue = sum / k;

    return {
      method: "moving_average",
      window: k,
      yearsUsed: lastSlice.map((p) => p.year),
      forecastYear: series[n - 1].year + 1,
      forecastValue,
    };
  }

  // ---------- 4.3. Експоненційне згладжування ----------
  static exponentialSmoothing(series, alpha = 0.3) {
    const n = series.length;
    if (n === 0) return null;

    let F = series[0].value; // початковий прогноз = перше значення

    for (let i = 1; i < n; i++) {
      const X = series[i].value;
      F = alpha * X + (1 - alpha) * F;
    }

    const last = series[n - 1];

    return {
      method: "exponential_smoothing",
      alpha,
      lastYear: last.year,
      lastSmoothed: F,
      forecastYear: last.year + 1,
      forecastValue: F, // прогноз на наступний період = останнє згладжене
    };
  }

  // ---------- 4.4. Лінійна регресія ----------
  static linearRegression(series) {
    const n = series.length;
    if (n < 2) return null;

    // t = 1..n, Yt = value
    let sumT = 0;
    let sumY = 0;
    let sumT2 = 0;
    let sumTY = 0;

    for (let i = 0; i < n; i++) {
      const t = i + 1;
      const y = series[i].value;
      sumT += t;
      sumY += y;
      sumT2 += t * t;
      sumTY += t * y;
    }

    const denominator = n * sumT2 - sumT * sumT;
    if (denominator === 0) return null;

    const b = (n * sumTY - sumT * sumY) / denominator; // коеф. тренду
    const a = (sumY - b * sumT) / n;                   // вільний член

    const forecastT = n + 1;
    const forecastValue = a + b * forecastT;

    // тренд по існуючих роках (для графіка)
    const trend = series.map((p, idx) => ({
      year: p.year,
      value: a + b * (idx + 1),
    }));

    return {
      method: "linear_regression",
      a,
      b,
      forecastYear: series[n - 1].year + 1,
      forecastValue,
      trend,
    };
  }

  // ---------- Головний метод ----------
  async forecast(budgetCode, type, { alpha, window } = {}) {
    const series = await this.getSeries(budgetCode, type);

    if (!series.length) {
      return {
        budget: budgetCode,
        type,
        series: [],
        methods: {},
      };
    }

    const alphaNum = alpha ? Number(alpha) : 0.3;
    const windowNum = window ? Number(window) : 3;

    const arithmeticGrowth = ForecastService.arithmeticGrowth(series);
    const movingAverage = ForecastService.movingAverage(series, windowNum);
    const exponential = ForecastService.exponentialSmoothing(series, alphaNum);
    const regression = ForecastService.linearRegression(series);

    return {
      budget: budgetCode,
      type,
      series,
      methods: {
        arithmeticGrowth,
        movingAverage,
        exponential,
        regression,
      },
    };
  }
}

export default new ForecastService();
