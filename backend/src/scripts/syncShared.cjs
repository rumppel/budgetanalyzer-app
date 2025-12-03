// src/scripts/syncShared.cjs
const pool = require("../db.cjs");

// Глобальний fetch
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// -----------------------------------
// 📌 1. FETCH CSV
// -----------------------------------
async function fetchCSV(budgetCode, year, type, period) {
  const url =
    `https://api.openbudget.gov.ua/api/public/localBudgetData?` +
    `budgetCode=${budgetCode}&budgetItem=EXPENSES&classificationType=${type.toUpperCase()}` +
    `&period=${period}&year=${year}`;

  const res = await fetch(url);
  const text = await res.text();

  // ❗ 1) Якщо це HTML → 503
  if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
    throw new Error("503 — HTML response (maintenance)");
  }

  // ❗ 2) Якщо текст починається з REP_PERIOD → CSV
  if (text.startsWith("REP_PERIOD")) {
    const rows = parseCSV(text);
    return {
      rows,
      params: { budgetCode, year, type, period },
      url
    };
  }

  // ❗ 3) Інакше пробуємо як JSON
  try {
    const json = JSON.parse(text);

    return {
      rows: json.data || [],
      params: { budgetCode, year, type, period },
      url
    };
  } catch (err) {
    throw new Error("Unexpected format, cannot parse JSON or CSV");
  }
}


// -----------------------------------
// 📌 2. LOG RAW
// -----------------------------------
async function logRaw(endpoint, params, response) {
  await pool.query(`
    INSERT INTO api_raw(endpoint, params, response)
    VALUES ($1, $2, $3)
  `, [
    endpoint,
    JSON.stringify(params),
    JSON.stringify(response)
  ]);
}


// -----------------------------------
// 📌 3. SAVE STRUCTURE
// (та сама логіка, що в syncOpenBudget.cjs)
// -----------------------------------
async function saveBudgetStructure(budget, year, type, rows) {
  if (!rows.length) return;

  const values = rows
    .map((r) => `(
      '${r.period}',
      '${budget.code}',
      '${type}',
      '${r.cons}',
      '${r.name.replace(/'/g, "''")}',
      ${Number(r.zat || 0)},
      ${Number(r.plan || 0)},
      ${Number(r.fakt || 0)}
    )`)
    .join(",");

  const sql = `
    INSERT INTO budget_structure(
      rep_period, cod_budget, classification_type, cod_cons_mb_pk,
      cod_cons_mb_pk_name, zat_amt, plans_amt, fakt_amt
    )
    VALUES ${values}
    ON CONFLICT DO NOTHING;
  `;

  await pool.query(sql);
}

// -----------------------------------
// 📌 4. LOG SYNC (з ON CONFLICT)
// -----------------------------------
async function logSync(endpoint, status, total, details) {
  await pool.query(
    `INSERT INTO api_sync(endpoint, last_synced, status, total_records, details)
     VALUES ($1, now(), $2, $3, $4)
     ON CONFLICT (endpoint)
     DO UPDATE SET last_synced = now(), status=$2, total_records=$3, details=$4`,
    [endpoint, status, total, JSON.stringify(details)]
  );
}

function parseCSV(text) {
  // прибрати BOM
  text = text.replace(/^\uFEFF/, "");

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) return [];

  const header = lines[0].split(";").map(h => h.trim());

  return lines.slice(1).map(line => {
    const cols = line.split(";");
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = cols[i] ? cols[i].trim() : null;
    });
    return obj;
  });
}



module.exports = {
  fetchCSV,
  saveBudgetStructure,
  logRaw,
  logSync,
  parseCSV
};
