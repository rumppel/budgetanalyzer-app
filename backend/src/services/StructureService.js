import pool from "../db.js";

class StructureService {
  async getStructure(budgetCode, year, type) {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (cod_cons_mb_pk)
      cod_cons_mb_pk AS code,
      cod_cons_mb_pk_name AS name,
      zat_amt AS zat,
      plans_amt AS plan,
      CASE 
        WHEN plans_amt = 0 OR plans_amt IS NULL THEN zat_amt 
        ELSE plans_amt 
      END AS plan_final,
      fakt_amt AS fact,
      rep_period,
      classification_type
    FROM budget_structure
    WHERE cod_budget = $1
      AND LOWER(classification_type) = LOWER($2)
      AND SUBSTRING(rep_period FROM 4 FOR 4) = $3
    ORDER BY cod_cons_mb_pk, rep_period DESC
    `,
    [budgetCode, type, year]
  );
  return result.rows.map(r => ({
    code: r.code,
    name: r.name,
    zat: Number(r.zat || 0),
    plan: Number(r.plan_final || 0),   // ← тепер це твій основний plan
    fact: Number(r.fact || 0),
    rep_period: r.rep_period,
    classification_type: r.classification_type,
  }));
}

}

export default new StructureService();

