// src/scripts/retryFailed.cjs
const pool = require("../db.cjs");
const retrySingle = require("./retrySingle.cjs");

async function getFailed() {
  const { rows } = await pool.query(`
    SELECT endpoint
    FROM api_sync
    WHERE status = 'error'
  `);

  return rows.map(r => {
    // localBudgetData_program_0130450700_MONTH_2024
    const parts = r.endpoint.split("_");

    return {
      type: parts[1],
      code: parts[2],
      period: parts[3],
      year: parts[4]
    };
  });
}

async function retryFailed() {
  const failed = await getFailed();

  console.log(`🔁 Починаю повтор ${failed.length} endpointів...\n`);

  for (const f of failed) {
    console.log(`➡ Повторюю: ${f.code} [${f.type}]`);
    await retrySingle(f.code, f.type, f.period, f.year);
  }

  console.log("🎉 Усі повтори завершено.");
}

retryFailed();
