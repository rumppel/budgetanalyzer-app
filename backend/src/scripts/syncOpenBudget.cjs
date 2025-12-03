  /* eslint-disable no-console */
  const { Pool } = require('pg');
  const { parse } = require('csv-parse/sync');

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const OPENBUDGET_BASE_URL = "https://api.openbudget.gov.ua/api/public";
  const MAX_CONCURRENT = 30;

  /** ------------------------------ DB ----------------------------------- */

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'ilovesoad11',
    database: process.env.POSTGRES_NAME || 'openbudget',
  });


  /** ------------------------- HELPERS ----------------------------------- */

  function field(row, variants) {
    for (const k of variants) {
      if (row[k] !== undefined && row[k] !== null) return row[k];
    }
    return null;
  }

  function parseMonth(rep) {
    if (!rep) return null;
    const s = String(rep).trim();

    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.getMonth() + 1;

    let m = s.match(/(\d{2})[.\-\/](\d{4})/);
    if (m) return Number(m[1]);

    m = s.match(/(\d{4})[.\-\/]?(\d{2})/);
    if (m) return Number(m[2]);

    return null;
  }


  /** ---------------------- FETCH CSV ------------------------------------ */

  async function fetchCSV(budgetCode, year, type, period) {
    const params = new URLSearchParams({
      budgetCode,
      budgetItem: "EXPENSES",
      classificationType: type.toUpperCase(),
      period,
      year,
    });

    const url = `${OPENBUDGET_BASE_URL}/localBudgetData?${params.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} — ${res.statusText}: ${text.slice(0,300)}`);
    }

    const text = await res.text();

    const rows = parse(text, {
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
    });

    return { rows, params: Object.fromEntries(params), url };
  }


  /** ---------------------- SAVE STRUCTURE ------------------------------- */

  async function saveBudgetStructure(budget, year, classificationType, rows) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const rep_period = [];
      const fund_typ = [];
      const cod_budget = [];
      const cod_cons = [];
      const cons_name = [];
      const zat_amt = [];
      const plans_amt = [];
      const fakt_amt = [];
      const class_type = [];

      const monthly = {};
      const unique = new Set();

      for (const r of rows) {
        const rep = field(r, ["rep_period", "REP_PERIOD"]);
        const cb = field(r, ["cod_budget", "COD_BUDGET"]);
        const cc = field(r, [
          "cod_cons_mb_pk", "COD_CONS_MB_PK",        // програмна
          "cod_cons_ek", "COD_CONS_EK",              // економічна
          "cod_cons_fun", "COD_FUN", "COD_CONS_FUN"  // (якщо буде функціональна)
        ]);

        const nm = field(r, [
          "cod_cons_mb_pk_name", "COD_CONS_MB_PK_NAME",  // програмна
          "cod_cons_ek_name", "COD_CONS_EK_NAME",        // економічна
          "cod_cons_fun_name", "COD_FUN_NAME", "COD_CONS_FUN_NAME" // функціональна
        ]);


        if (!cb || !cc) continue;

        const key = `${rep}__${cb}__${cc}__${classificationType}`;
        if (unique.has(key)) continue;
        unique.add(key);

        const zat = Number(field(r, ["zat_amt", "ZAT_AMT"])) || 0;
        const plan = Number(field(r, ["plans_amt", "PLANS_AMT"])) || 0;
        const fakt = Number(field(r, ["fakt_amt", "FAKT_AMT"])) || 0;

        rep_period.push(rep);
        fund_typ.push(field(r, ["fund_typ", "FUND_TYP"]));
        cod_budget.push(cb);
        cod_cons.push(cc);
        cons_name.push(nm);
        zat_amt.push(zat);
        plans_amt.push(plan);
        fakt_amt.push(fakt);
        class_type.push(classificationType);

        const m = parseMonth(rep);
        if (m) monthly[m] = (monthly[m] || 0) + fakt;
      }

      await client.query(
        `
        INSERT INTO budget_structure(
          rep_period, fund_typ, cod_budget,
          cod_cons_mb_pk, cod_cons_mb_pk_name,
          zat_amt, plans_amt, fakt_amt,
          classification_type
        )
        SELECT * FROM UNNEST(
          $1::text[],
          $2::text[],
          $3::text[],
          $4::text[],
          $5::text[],
          $6::numeric[],
          $7::numeric[],
          $8::numeric[],
          $9::text[]
        )
        ON CONFLICT(rep_period, cod_budget, cod_cons_mb_pk, classification_type)
        DO UPDATE SET
          fund_typ = EXCLUDED.fund_typ,
          cod_cons_mb_pk_name = EXCLUDED.cod_cons_mb_pk_name,
          zat_amt = EXCLUDED.zat_amt,
          plans_amt = EXCLUDED.plans_amt,
          fakt_amt = EXCLUDED.fakt_amt
        `,
        [
          rep_period,
          fund_typ,
          cod_budget,
          cod_cons,
          cons_name,
          zat_amt,
          plans_amt,
          fakt_amt,
          class_type,
        ]
      );

      const months = Object.keys(monthly);
      if (months.length > 0) {
        await client.query(
          `
          INSERT INTO monthly_indicators(budget_id, month, income, expense, balance)
          SELECT $1, UNNEST($2::int[]), NULL, UNNEST($3::numeric[]), NULL
          ON CONFLICT(budget_id, month)
          DO UPDATE SET expense = EXCLUDED.expense
          `,
          [budget.id, months.map(Number), months.map(m => monthly[m])]
        );
      }

      await client.query(
        `UPDATE budget SET last_update = now() WHERE id = $1`,
        [budget.id]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }


  /** ---------------------- LOGGING ------------------------------------- */

  async function logRaw(endpoint, params, resp) {
    await pool.query(
      `INSERT INTO api_raw(endpoint, params, response)
      VALUES ($1, $2::jsonb, $3::jsonb)`,
      [endpoint, JSON.stringify(params), JSON.stringify(resp)]
    );
  }

  
  async function logSync(endpoint, status, total, details) {
  await pool.query(
    `
    INSERT INTO api_sync (endpoint, last_synced, status, total_records, details)
    VALUES ($1, now(), $2, $3, $4)
    ON CONFLICT (endpoint)
    DO UPDATE SET
      last_synced = now(),
      status = EXCLUDED.status,
      total_records = EXCLUDED.total_records,
      details = EXCLUDED.details;
    `,
    [endpoint, status, total, JSON.stringify(details)]
  );
}



  /** ---------------------- SYNC ONE ------------------------------------ */

  async function syncSingle(budget, year, types, period, index, total) {
    const label = `[${index + 1}/${total}] budgetCode=${budget.code}`;
    console.log(`🔄 ${label} — старт (${types.join(",")}, period=${period})`);

    for (const type of types) {
      try {
        const { rows, params, url } = await fetchCSV(budget.code, year, type, period);

        console.log(`📥 ${label} — [${type}] отримано ${rows.length} рядків`);

        await logRaw(`localBudgetData_${type}`, params, rows);

        await saveBudgetStructure(budget, year, type, rows);

        const endpointKey = `localBudgetData_${type}_${budget.code}_${period}_${year}`;

        await logSync(
          endpointKey,
          "success",
          rows.length,
          { budgetId: budget.id, budgetCode: budget.code, year, url }
        );

        console.log(`✅ ${label} — [${type}] OK`);
      } catch (err) {
        console.error(`❌ ${label} — [${type}] помилка: ${err.message}`);

        const endpointKey = `localBudgetData_${type}_${budget.code}_${period}_${year}`;

        await logSync(
          endpointKey,
          "error",
          0,
          { budgetId: budget.id, budgetCode: budget.code, year, error: err.message }
        );
      }
    }
  }


  /** ------------------------ MAIN -------------------------------------- */

  async function main() {
    const [, , yearArg, typesArg, periodArg, limitArg] = process.argv;

    if (!yearArg) {
      console.error("❌ Usage: node syncOpenBudget.cjs <year> [types] [period] [limit]");
      process.exit(1);
    }

    const year = Number(yearArg);
    const period = periodArg || "MONTH";

    let types = ["program"];
    if (typesArg) types = typesArg.split(",");

    let limit = null;
    if (limitArg) limit = Number(limitArg);

    console.log(`📅 Синхронізація бюджетів за ${year} рік (types=${types.join(", ")}, period=${period}, limit=${limit || "∞"})`);

    const q = await pool.query(`
      SELECT id, code 
      FROM community 
      WHERE code IS NOT NULL 
      ORDER BY code
    `);

    let budgets = q.rows;
    if (limit) budgets = budgets.slice(0, limit);

    const total = budgets.length;
    console.log(`🔢 Всього бюджетів до синхронізації: ${total}`);
    console.log(`⚙️ Паралельність: ${MAX_CONCURRENT}`);

    let idx = 0;

    async function worker() {
      while (idx < total) {
        const i = idx++;
        await syncSingle(budgets[i], year, types, period, i, total);
      }
    }

    const workers = [];
    for (let i = 0; i < MAX_CONCURRENT; i++) workers.push(worker());

    await Promise.all(workers);

    console.log("✨ Синхронізація завершена.");
    await pool.end();
  }


  /** ------------------------ LAUNCH ------------------------------------ */

  if (require.main === module) {
    main().catch(err => {
      console.error("💥 Fatal:", err);
      process.exit(1);
    });
  }
