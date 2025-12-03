// src/services/StructureStatsService.js
import pool from '../db.js';

class StructureStatsService {

  // ============================
  // 1. ПОМІСЯЧНА статистика
  // ============================
  static async monthly(budget, type, year) {
    const { rows } = await pool.query(`
      SELECT 
        rep_period,
        SUM(zat_amt) AS zat,
        SUM(plans_amt) AS plan,
        SUM(fakt_amt) AS fact
      FROM budget_structure
      WHERE cod_budget = $1
        AND LOWER(classification_type) = LOWER($2)
        AND RIGHT(rep_period, 4) = $3
      GROUP BY rep_period
      ORDER BY rep_period;
    `, [budget, type, year]);

    return rows.map(r => ({
      rep_period: r.rep_period,
      zat: Number(r.zat || 0),
      plan: Number(r.plan || 0),
      fact: Number(r.fact || 0)
    }));
  }

  // ============================
  // 2. ПОКВАРТАЛЬНА статистика
  // ============================
  // ============================
// 2. ПОКВАРТАЛЬНА статистика (виправлено)
// ============================
// ============================
// 2. ПОКВАРТАЛЬНА статистика (виправлено)
// ============================
static async quarterly(budget, type, year) {
  const { rows } = await pool.query(`
    WITH months AS (
      SELECT
        rep_period,
        SUBSTRING(rep_period, 1, 2)::int AS month,
        CASE
          WHEN SUBSTRING(rep_period, 1, 2)::int BETWEEN 1 AND 3 THEN 'Q1'
          WHEN SUBSTRING(rep_period, 1, 2)::int BETWEEN 4 AND 6 THEN 'Q2'
          WHEN SUBSTRING(rep_period, 1, 2)::int BETWEEN 7 AND 9 THEN 'Q3'
          ELSE 'Q4'
        END AS quarter
      FROM budget_structure
      WHERE cod_budget = $1
        AND LOWER(classification_type) = LOWER($2)
        AND RIGHT(rep_period, 4) = $3
    ),

    last_months AS (
      SELECT 
        quarter,
        MAX(rep_period) AS rep_period
      FROM months
      GROUP BY quarter
    )

    SELECT
      lm.quarter,
      SUM(bs.zat_amt) AS zat,
      SUM(bs.plans_amt) AS plan,
      SUM(bs.fakt_amt) AS fact
    FROM last_months lm
    JOIN budget_structure bs
      ON bs.rep_period = lm.rep_period
     AND bs.cod_budget = $1
     AND LOWER(bs.classification_type) = LOWER($2)
    GROUP BY lm.quarter
    ORDER BY lm.quarter;
  `, [budget, type, year]);

  return rows.map(r => ({
    quarter: r.quarter,
    zat: Number(r.zat || 0),
    plan: Number(r.plan || 0),
    fact: Number(r.fact || 0)
  }));
}



  // ============================
  // 3. РІЧНА статистика
  // ============================
  static async yearly(budget, type, year) {
    const { rows } = await pool.query(`
      SELECT
        SUM(zat_amt) AS zat,
        SUM(plans_amt) AS plan,
        SUM(fakt_amt) AS fact,
        CASE 
          WHEN SUM(plans_amt) > 0 
          THEN ROUND((SUM(fakt_amt) / SUM(plans_amt)) * 100, 2)
          ELSE 0
        END AS execution_percent
      FROM budget_structure
      WHERE cod_budget = $1
        AND LOWER(classification_type) = LOWER($2)
        AND RIGHT(rep_period, 4) = $3
    `, [budget, type, year]);

    if (!rows[0]) return null;

    const result = rows[0];
    // Use plan if available, otherwise use zat (like in StructureService)
    const planFinal = Number(result.plan) || Number(result.zat) || 0;
    
    return {
      zat: Number(result.zat || 0),
      plan: planFinal,
      fact: Number(result.fact || 0),
      execution_percent: result.execution_percent ? Number(result.execution_percent) : null
    };
  }

  // ============================
  // 4. ТОП-10 кодів (програм, економічних або функцій)
  // ============================
  static async top10(budget, type, year) {
    const { rows } = await pool.query(`
      SELECT
        cod_cons_mb_pk AS code,
        cod_cons_mb_pk_name AS name,
        SUM(fakt_amt) AS total
      FROM budget_structure
      WHERE cod_budget = $1
        AND LOWER(classification_type) = LOWER($2)
        AND RIGHT(rep_period, 4) = $3
      GROUP BY code, name
      ORDER BY total DESC
      LIMIT 10;
    `, [budget, type, year]);

    return rows;
  }

  // ============================
  // 5. СТРУКТУРА видатків (%)
  // ============================
  static async structure(budget, type, year) {
  const { rows } = await pool.query(`
    WITH base AS (
      SELECT
        cod_cons_mb_pk AS code,
        cod_cons_mb_pk_name AS name,
        SUM(fakt_amt) AS fact
      FROM budget_structure
      WHERE cod_budget = $1
        AND LOWER(classification_type) = LOWER($2)
        AND RIGHT(rep_period, 4) = $3
      GROUP BY code, name
    ),
    sorted AS (
      SELECT *
      FROM base
      ORDER BY fact DESC
    ),
    top10 AS (
      SELECT * FROM sorted LIMIT 10
    ),
    other AS (
      SELECT 
        'other' AS code,
        'Інше' AS name,
        SUM(fact) AS fact
      FROM sorted OFFSET 10
    ),
    combined AS (
      SELECT * FROM top10
      UNION ALL
      SELECT * FROM other WHERE fact > 0
    ),
    total AS (
      SELECT SUM(fact) AS total_fact FROM combined
    )
    SELECT
      code,
      name,
      fact,
      ROUND(fact * 100.0 / NULLIF((SELECT total_fact FROM total), 0), 2)::numeric AS percent
    FROM combined
    ORDER BY fact DESC;
  `, [budget, type, year]);

  return rows.map(r => ({
    code: r.code,
    name: r.name,
    fact: Number(r.fact),
    percent: Number(r.percent)
  }));
}



  // ============================
  // 6. ДИНАМІКА за роками
  // ============================
  // ============================
// 6. ДИНАМІКА за роками (виправлено)
// ============================
    static async dynamics(budget, type) {
    const { rows } = await pool.query(`
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
        lm.year,
        SUM(bs.fakt_amt) AS fact
        FROM last_months lm
        JOIN budget_structure bs
        ON bs.rep_period = lm.rep_period
        AND bs.cod_budget = $1
        AND LOWER(bs.classification_type) = LOWER($2)
        GROUP BY lm.year
        ORDER BY lm.year;
    `, [budget, type]);

  return rows.map(r => ({
    year: Number(r.year),
    fact: Number(r.fact)
  }));
}

}

export default StructureStatsService;
