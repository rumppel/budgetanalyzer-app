/* eslint-disable no-console */
const { Pool } = require('pg');
const { parse } = require('csv-parse/sync');
// Базовий URL OpenBudget
const OPENBUDGET_BASE_URL = 'https://api.openbudget.gov.ua/api/public';

// Паралельність — 40 бюджетів одночасно
const MAX_CONCURRENT = 40;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const CLASSIFICATION_TYPES = {
  program: 'PROGRAM',
  functional: 'FUNCTIONAL',
  economic: 'ECONOMIC',
};

// Доступні періоди
const PERIOD_TYPES = ['MONTH', 'QUARTER'];

const STRUCTURE_TABLES = {
  program: {
    table: 'budget_structure',
    uniqueCols: ['rep_period', 'cod_budget', 'cod_cons_mb_pk'],
    codeCol: 'cod_cons_mb_pk',
    nameCol: 'cod_cons_mb_pk_name',
  },
  functional: {
    table: 'budget_functional',
    uniqueCols: ['rep_period', 'cod_budget', 'func_code'],
    codeCol: 'func_code',
    nameCol: 'func_name',
  },
  economic: {
    table: 'budget_economic',
    uniqueCols: ['rep_period', 'cod_budget', 'econ_code'],
    codeCol: 'econ_code',
    nameCol: 'econ_name',
  },
};


/**
 * Пул підключень до Postgres
 * (налаштування — такі самі, як у скрипті імпорту Excel)
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'db',
  port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'postgres',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

/**
 * Нормалізуємо поля з рядка OpenBudget (на випадок camelCase / UPPERCASE)
 */
function field(row, variants) {
  for (const key of variants) {
    if (row[key] !== undefined && row[key] !== null) {
      return row[key];
    }
  }
  return null;
}

/**
 * Парсинг місяця з rep_period
 * Підтримує формати:
 * - ISO-дата (2024-01-01, 2024-01-01T00:00:00Z)
 * - "01.2024"
 * - "202401" або "2024-01"
 */
function parseMonthFromRepPeriod(repPeriod) {
  if (!repPeriod) return null;
  const s = String(repPeriod).trim();

  // Спробувати як дату
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    const m = d.getMonth() + 1;
    if (m >= 1 && m <= 12) return m;
  }

  // Формат "MM.YYYY" або "MM-YYYY"
  let m = s.match(/(\d{2})[.\-\/](\d{4})/);
  if (m) {
    const month = parseInt(m[1], 10);
    if (month >= 1 && month <= 12) return month;
  }

  // Формат "YYYYMM" або "YYYY-MM"
  m = s.match(/(\d{4})[.\-\/]?(\d{2})/);
  if (m) {
    const month = parseInt(m[2], 10);
    if (month >= 1 && month <= 12) return month;
  }

  return null;
}

/**
 * Витягнути структуру бюджету з OpenBudget
 * (Програмна класифікація видатків, по місяцях)
 */


async function fetchBudgetData(type, budgetCode, year, period = 'MONTH') {
  const classification = CLASSIFICATION_TYPES[type];
  if (!classification) {
    throw new Error(`Unknown classification type: ${type}`);
  }

  if (!PERIOD_TYPES.includes(period)) {
    throw new Error(`Unknown period type: ${period}`);
  }

  const params = new URLSearchParams({
    budgetCode: String(budgetCode),
    budgetItem: 'EXPENSES',
    classificationType: classification,   // <── ГОЛОВНА зміна
    period,                               // MONTH або QUARTER
    year: String(year),
  });

  const url = `${OPENBUDGET_BASE_URL}/localBudgetData?${params.toString()}`;
  
  try {
    const res = await fetch(url);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const errorMsg = `HTTP ${res.status}: ${body.slice(0, 200)}`;
      console.error(`[fetchBudgetData] Request failed for budgetCode=${budgetCode}, type=${type}, year=${year}`, {
        url,
        status: res.status,
        statusText: res.statusText,
        body: body.slice(0, 500)
      });
      throw new Error(errorMsg);
    }

    const text = await res.text();
    const rows = parse(text, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
    });

    return { url, params: Object.fromEntries(params.entries()), rows };
  } catch (err) {
    // Enhanced error logging for fetch failures
    if (err.message.includes('fetch failed') || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      console.error(`[fetchBudgetData] Network error for budgetCode=${budgetCode}, type=${type}, year=${year}`, {
        url,
        error: err.message,
        code: err.code,
        cause: err.cause?.message || err.cause,
        stack: err.stack
      });
    }
    throw err;
  }
}



/**
 * Зберігаємо raw відповідь у api_raw
 */
async function saveApiRaw(endpoint, params, response) {
  // params і response робимо ЯВНО валідним JSON-текстом
  const paramsJson = params ? JSON.stringify(params) : null;
  const responseJson = response ? JSON.stringify(response) : null;

  await pool.query(
    `
      INSERT INTO api_raw (endpoint, params, response)
      VALUES ($1, $2::jsonb, $3::jsonb)
    `,
    [endpoint, paramsJson, responseJson],
  );
}


/**
 * Лог у api_sync
 */
async function logApiSync(endpoint, status, totalRecords, detailsObj) {
  const details =
    detailsObj && Object.keys(detailsObj).length > 0 ? JSON.stringify(detailsObj) : null;

  await pool.query(
    `
      INSERT INTO api_sync (endpoint, last_synced, status, total_records, details)
      VALUES ($1, now(), $2, $3, $4)
    `,
    [endpoint, status, totalRecords, details],
  );
}

/**
 * Зберігаємо структуру бюджету у budget_structure
 * + одночасно агрегуємо помісячні фактичні видатки для monthly_indicators
 */

async function saveBudgetGeneric(type, budget, year, rows) {
  const cfg = STRUCTURE_TABLES[type];
  if (!cfg) throw new Error(`Unknown structure type: ${type}`);

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Поля, що збираємо
    const rep_period = [];
    const cod_budget = [];
    const codeArr = [];
    const nameArr = [];
    const zat_amt = [];
    const plans_amt = [];
    const fakt_amt = [];

    const unique = new Set();

    for (const row of rows) {
      const repPeriod = field(row, ['rep_period', 'REP_PERIOD']);
      const codBudget = field(row, ['cod_budget', 'COD_BUDGET']);
      const code = field(row, [cfg.codeCol, cfg.codeCol.toUpperCase()]);
      const name = field(row, [cfg.nameCol, cfg.nameCol.toUpperCase()]);

      const key = `${repPeriod}__${codBudget}__${code}`;
      if (unique.has(key)) continue;
      unique.add(key);

      rep_period.push(repPeriod);
      cod_budget.push(codBudget);
      codeArr.push(code);
      nameArr.push(name);

      zat_amt.push(Number(field(row, ['zat_amt', 'ZAT_AMT'])) || 0);
      plans_amt.push(Number(field(row, ['plans_amt', 'PLANS_AMT'])) || 0);
      fakt_amt.push(Number(field(row, ['fakt_amt', 'FAKT_AMT'])) || 0);
    }

    // Генеруємо список колонок
    const insertCols = [
      'rep_period',
      'cod_budget',
      cfg.codeCol,
      cfg.nameCol,
      'zat_amt',
      'plans_amt',
      'fakt_amt',
    ];

    const conflictCols = cfg.uniqueCols.join(', ');

    const sql = `
      INSERT INTO ${cfg.table} (
        ${insertCols.join(', ')}
      )
      SELECT * FROM UNNEST(
        $1::text[],
        $2::text[],
        $3::text[],
        $4::text[],
        $5::numeric[],
        $6::numeric[],
        $7::numeric[]
      )
      ON CONFLICT (${conflictCols})
      DO UPDATE SET
        ${cfg.nameCol} = EXCLUDED.${cfg.nameCol},
        zat_amt = EXCLUDED.zat_amt,
        plans_amt = EXCLUDED.plans_amt,
        fakt_amt = EXCLUDED.fakt_amt
    `;

    await client.query(sql, [
      rep_period,
      cod_budget,
      codeArr,
      nameArr,
      zat_amt,
      plans_amt,
      fakt_amt,
    ]);

    // Оновлюємо last_update (загальне)
    await client.query(
      `UPDATE budget SET last_update = now() WHERE id = $1`,
      [budget.id],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}


async function saveBudgetStructureAndMonthly(budget, year, rows) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Масиви для UNNEST
    const rep_period = [];
    const fund_typ = [];
    const cod_budget = [];
    const cod_cons_mb_pk = [];
    const cod_cons_mb_pk_name = [];
    const zat_amt = [];
    const plans_amt = [];
    const fakt_amt = [];

    // Для monthly aggregation
    const monthly = {};

        // Set для унікальності (rep_period + cod_budget + cod_cons_mb_pk)
    const unique = new Set();

    for (const row of rows) {
      const repPeriod = field(row, ['rep_period', 'REP_PERIOD']);
      const codBudget = field(row, ['cod_budget', 'COD_BUDGET']);
      const codCons = field(row, ['cod_cons_mb_pk', 'COD_CONS_MB_PK']);

      // ключ унікальності
      const key = `${repPeriod}__${codBudget}__${codCons}`;

      if (unique.has(key)) {
        // Дубль — пропускаємо, не вставляємо
        continue;
      }
      unique.add(key);

      const fundTyp = field(row, ['fund_typ', 'FUND_TYP']);
      const consName = field(row, ['cod_cons_mb_pk_name', 'COD_CONS_MB_PK_NAME']);

      const zat = Number(field(row, ['zat_amt', 'ZAT_AMT'])) || 0;
      const plans = Number(field(row, ['plans_amt', 'PLANS_AMT'])) || 0;
      const fakt = Number(field(row, ['fakt_amt', 'FAKT_AMT'])) || 0;

      rep_period.push(repPeriod);
      fund_typ.push(fundTyp);
      cod_budget.push(codBudget);
      cod_cons_mb_pk.push(codCons);
      cod_cons_mb_pk_name.push(consName);
      zat_amt.push(zat);
      plans_amt.push(plans);
      fakt_amt.push(fakt);

      // Monthly aggregation
      const m = parseMonthFromRepPeriod(repPeriod);
      if (m) {
        if (!monthly[m]) monthly[m] = 0;
        monthly[m] += fakt;
      }
    }

    // B U L K   I N S E R T
    await client.query(
      `
      INSERT INTO budget_structure (
        rep_period,
        fund_typ,
        cod_budget,
        cod_cons_mb_pk,
        cod_cons_mb_pk_name,
        zat_amt,
        plans_amt,
        fakt_amt
      )
      SELECT * FROM UNNEST (
        $1::text[],
        $2::text[],
        $3::text[],
        $4::text[],
        $5::text[],
        $6::numeric[],
        $7::numeric[],
        $8::numeric[]
      )
      ON CONFLICT (rep_period, cod_budget, cod_cons_mb_pk)
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
        cod_cons_mb_pk,
        cod_cons_mb_pk_name,
        zat_amt,
        plans_amt,
        fakt_amt,
      ],
    );

    // Monthly indicators bulk insert
    const months = Object.keys(monthly);
    if (months.length > 0) {
      const monthArr = months.map(Number);
      const expenseArr = months.map((m) => monthly[m]);

      await client.query(
        `
        INSERT INTO monthly_indicators (budget_id, month, income, expense, balance)
        SELECT $1, UNNEST($2::int[]), NULL, UNNEST($3::numeric[]), NULL
        ON CONFLICT (budget_id, month)
        DO UPDATE SET
          expense = EXCLUDED.expense
        `,
        [budget.id, monthArr, expenseArr],
      );
    }

    // Оновлюємо last_update
    await client.query(
      `UPDATE budget SET last_update = now() WHERE id = $1`,
      [budget.id],
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function saveBudgetStructureUnified(type, budget, year, rows) {
  if (type === 'program') {
    return saveBudgetStructureAndMonthly(budget, year, rows);
  }

  if (type === 'functional') {
    return saveBudgetFunctional(budget, year, rows);
  }

  if (type === 'economic') {
    return saveBudgetEconomic(budget, year, rows);
  }

  throw new Error(`Unknown save operation for type: ${type}`);
}

/**
 * Синхронізація ОДНОГО бюджету:
 * - тягнемо localBudgetData
 * - зберігаємо raw у api_raw
 * - зберігаємо структуру у budget_structure
 * - заповнюємо monthly_indicators (на основі fakt_amt)
 * - лог у api_sync
 */
async function syncSingleBudget(budget, year, index, total, types = ['program'], period = 'MONTH') {
  const label = `[${index + 1}/${total}] budgetCode=${budget.code}`;

  console.log(`🔄 ${label} — старт (types=${types.join(', ')}, period=${period})`);

  try {
    for (const type of types) {
      const { url, params, rows } = await fetchBudgetData(type, budget.code, year, period);

      console.log(`📥 ${label} — [${type}] отримано ${rows.length} рядків`);

      await saveApiRaw(`localBudgetData_${type}`, params, rows);

      // зберігаємо у свою таблицю
      await saveBudgetStructureUnified(type, budget, year, rows);

      await logApiSync(`localBudgetData_${type}`, 'success', rows.length, {
        type,
        budgetId: budget.id,
        budgetCode: budget.code,
        year,
        url,
        period,
      });

      console.log(`✅ ${label} — [${type}] синхронізовано`);
    }
  } catch (err) {
    const errorDetails = {
      error: err.message,
      code: err.code,
      type: err.name,
      budgetCode: budget.code,
      budgetId: budget.id,
      year,
      types: types.join(','),
      period,
      cause: err.cause?.message || err.cause
    };
    
    console.error(`❌ ${label} — помилка:`, err.message);
    console.error(`[syncSingleBudget] Error details:`, errorDetails);
    
    // Log to api_sync with detailed error information
    await logApiSync('localBudgetData', 'error', 0, errorDetails);
  }
}


/**
 * Основна функція:
 * - читає всі бюджети за рік
 * - запускає синхронізацію з паралельністю MAX_CONCURRENT
 * опціонально: 3-й аргумент — limit
 */
async function main() {
  const [, , yearArg, typesArg = 'program', periodArg = 'MONTH', limitArg] = process.argv;

  if (!yearArg) {
    console.error('❌ Використання: node syncOpenBudget.cjs <year> [types] [period] [limit]');
    console.error('Приклад: node syncOpenBudget.cjs 2024 program,functional MONTH 100');
    process.exit(1);
  }

  const year = Number(yearArg);
  let types = typesArg.split(',').map(s => s.trim().toLowerCase());
  let period = periodArg.toUpperCase();

  if (!PERIOD_TYPES.includes(period)) {
    console.error('❌ Некоректний період. Доступні:', PERIOD_TYPES.join(', '));
    process.exit(1);
  }

  console.log(`📅 Синхронізація за ${year}, класифікації: ${types.join(', ')}, період=${period}`);

  let limit = null;
  if (limitArg) limit = Number(limitArg);

  const budgetsRes = await pool.query(
    `SELECT id, code FROM budget WHERE year=$1 AND code IS NOT NULL ORDER BY code`,
    [year],
  );

  let budgets = budgetsRes.rows;
  if (limit) budgets = budgets.slice(0, limit);

  console.log(`🔢 Всього бюджетів: ${budgets.length}`);

  let currentIndex = 0;

  async function worker() {
    while (currentIndex < budgets.length) {
      const idx = currentIndex++;
      const budget = budgets[idx];
      await syncSingleBudget(budget, year, idx, budgets.length, types, period);
    }
  }

  console.log(`⚙️ Паралельність: ${MAX_CONCURRENT}`);
  await Promise.all(Array.from({ length: MAX_CONCURRENT }, worker));

  console.log('✨ Готово');
  await pool.end();
}
