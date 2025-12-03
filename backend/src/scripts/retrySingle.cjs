// src/scripts/retrySingle.cjs
const {
  fetchCSV,
  saveBudgetStructure,
  logRaw,
  logSync
} = require("./syncShared.cjs");

async function retrySingle(budgetCode, type, period, year) {
  const label = `[RETRY] budgetCode=${budgetCode} type=${type}`;
  console.log(`➡ Повторюю: ${budgetCode} [${type}]`);

  try {
    const { rows, params, url } = await fetchCSV(budgetCode, year, type, period);

    console.log(`📥 ${label} — отримано ${rows.length} рядків`);

    await logRaw(`retry_${type}`, params, rows);
    await saveBudgetStructure({ code: budgetCode }, year, type, rows);

    const endpointKey = `retry_${type}_${budgetCode}_${period}_${year}`;

    await logSync(endpointKey, "success", rows.length, {
      budgetCode,
      year,
      url
    });

    console.log(`✅ ${label} — OK`);
  } catch (err) {
    console.error(`❌ ${label} — помилка: ${err.message}`);

    const endpointKey = `retry_${type}_${budgetCode}_${period}_${year}`;

    await logSync(endpointKey, "error", 0, {
      budgetCode,
      year,
      error: err.message
    });
  }
}

module.exports = retrySingle;
