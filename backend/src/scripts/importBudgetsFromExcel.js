/* eslint-disable no-console */
import { existsSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';
import XLSX from "xlsx";
const { readFile, utils } = XLSX;

/**
 * Нормалізація заголовків Excel:
 * - обрізаємо пробіли
 * - схлопуємо повторні пробіли
 */
function normalizeHeader(h) {
  return String(h || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Мапа "наші логічні поля" -> можливі назви колонок в Excel
 */
const HEADER_MAP = {
  territoryCode: ['Код території 1', 'Код території'],
  controlFlag: ['Ознака підконтрольності території 2', 'Ознака підконтрольності території'],
  budgetType: ['Ознака бюджету 3', 'Ознака бюджету'],
  budgetsCount: ['Кількість бюджетів'],
  relWithState: ['Кількість бюджетів, що мають взаємовідносини з державним бюджетом'],
  budgetCode: ['Код бюджету 4', 'Код бюджету'],
  budgetName: ['Найменування бюджету'],
  omsName: ['Найменування органу місцевого самоврядування'],
  katottg: ['КАТОТТГ5', 'КАТОТТГ'],
  fullAtoName: ['Повне найменування адміністративно-територіальної одиниці'],
};

/**
 * Створюємо Pool для підключення до Postgres.
 * Використовуємо ті ж env, що й бекенд (підлаштуй під себе, якщо треба).
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
 * Мапимо заголовки Excel до наших ключів
 */
function buildColumnIndexMap(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const map = {}; // key -> columnIndex

  for (const [field, variants] of Object.entries(HEADER_MAP)) {
    const foundIndex = normalized.findIndex((h) =>
      variants.some((variant) => normalizeHeader(variant) === h),
    );
    if (foundIndex !== -1) {
      map[field] = foundIndex;
    }
  }

  // Мінімум нам потрібен budgetCode + budgetName або omsName
  if (map.budgetCode === undefined) {
    throw new Error(
      'Не знайдено колонку "Код бюджету" (Код бюджету 4). Перевір структуру Excel.',
    );
  }

  if (map.budgetName === undefined && map.omsName === undefined) {
    throw new Error(
      'Не знайдено ні "Найменування бюджету", ні "Найменування органу місцевого самоврядування".',
    );
  }

  return map;
}

/**
 * Читаємо Excel у вигляді масиву рядків (масив масивів)
 */
function readExcelRows(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Файл не знайдено: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  // header: 1 → отримаємо масив масивів, де [0] — заголовки
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  if (!rows.length) {
    throw new Error('Excel-файл порожній або не містить даних.');
  }

  return rows;
}

/**
 * UPSERT громади
 */
async function upsertCommunity(client, row, colIdx) {
  const budgetCode = row[colIdx.budgetCode] ? String(row[colIdx.budgetCode]).trim() : null;
  if (!budgetCode) return null; // не маємо коду бюджету → пропускаємо

  const omsName =
    (colIdx.omsName !== undefined && row[colIdx.omsName]
      ? String(row[colIdx.omsName]).trim()
      : null) || null;

  const budgetName =
    (colIdx.budgetName !== undefined && row[colIdx.budgetName]
      ? String(row[colIdx.budgetName]).trim()
      : null) || null;

  const name = omsName || budgetName || budgetCode;

  const katottg =
    colIdx.katottg !== undefined && row[colIdx.katottg]
      ? String(row[colIdx.katottg]).trim()
      : null;

  const fullAtoName =
    colIdx.fullAtoName !== undefined && row[colIdx.fullAtoName]
      ? String(row[colIdx.fullAtoName]).trim()
      : null;

  const result = await client.query(
    `
      INSERT INTO community (name, code, katottg, full_ato_name)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (code) DO UPDATE
      SET name = EXCLUDED.name,
          katottg = EXCLUDED.katottg,
          full_ato_name = EXCLUDED.full_ato_name
      RETURNING id
    `,
    [name, budgetCode, katottg, fullAtoName],
  );

  return { id: result.rows[0].id, name, code: budgetCode };
}

/**
 * UPSERT бюджету
 */
async function upsertBudget(client, community, row, colIdx, year) {
  const budgetCode = row[colIdx.budgetCode] ? String(row[colIdx.budgetCode]).trim() : null;
  if (!budgetCode || !community?.id) return false;

  const budgetName =
    (colIdx.budgetName !== undefined && row[colIdx.budgetName]
      ? String(row[colIdx.budgetName]).trim()
      : null) || null;

  const omsName =
    (colIdx.omsName !== undefined && row[colIdx.omsName]
      ? String(row[colIdx.omsName]).trim()
      : null) || null;

  const budgetType =
    colIdx.budgetType !== undefined && row[colIdx.budgetType]
      ? String(row[colIdx.budgetType]).trim()
      : null;

  const controlFlag =
    colIdx.controlFlag !== undefined && row[colIdx.controlFlag]
      ? String(row[colIdx.controlFlag]).trim()
      : null;

  const result = await client.query(
    `
      INSERT INTO budget (community_id, year, code, name, oms_name, budget_type, control_flag, last_update)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (community_id, year) DO UPDATE
      SET code = EXCLUDED.code,
          name = EXCLUDED.name,
          oms_name = EXCLUDED.oms_name,
          budget_type = EXCLUDED.budget_type,
          control_flag = EXCLUDED.control_flag,
          last_update = EXCLUDED.last_update
      RETURNING id
    `,
    [community.id, year, budgetCode, budgetName, omsName, budgetType, controlFlag],
  );

  return !!result.rows[0]?.id;
}

/**
 * Основна функція імпорту
 */
async function importBudgets(filePath, year) {
  const absPath = resolve(filePath);
  console.log(`📂 Файл: ${absPath}`);
  console.log(`📅 Рік бюджету: ${year}`);

  const rows = readExcelRows(absPath);
  const headerRow = rows[0];
  const dataRows = rows.slice(1);

  const colIdx = buildColumnIndexMap(headerRow);
  console.log('✅ Знайдено структуру колонок Excel:');
  console.log(colIdx);

  const client = await pool.connect();

  let createdCommunities = 0;
  let processedRows = 0;
  let createdBudgets = 0;
  let skippedRows = 0;

  try {
    await client.query('BEGIN');

    for (const row of dataRows) {
      processedRows += 1;

      const budgetCode = row[colIdx.budgetCode]
        ? String(row[colIdx.budgetCode]).trim()
        : null;

      if (!budgetCode) {
        skippedRows += 1;
        continue;
      }

      try {
        const community = await upsertCommunity(client, row, colIdx);
        if (!community) {
          skippedRows += 1;
          continue;
        }

        const budgetCreatedOrUpdated = await upsertBudget(client, community, row, colIdx, year);
        if (budgetCreatedOrUpdated) {
          createdBudgets += 1;
        }
        createdCommunities += 1; // рахуватимемо як "оброблена громада" (не лише нові)
      } catch (err) {
        console.error(
          `❌ Помилка на рядку ${processedRows} (код бюджету: ${budgetCode}):`,
          err.message,
        );
        throw err; // кидаємо далі, щоб зробити ROLLBACK
      }
    }

    await client.query('COMMIT');

    console.log('✅ Імпорт успішно завершено.');
    console.log(`Оброблено рядків: ${processedRows}`);
    console.log(`Пропущено (без коду бюджету): ${skippedRows}`);
    console.log(`Оброблено громад (insert/update): ${createdCommunities}`);
    console.log(`Оброблено бюджетів (insert/update): ${createdBudgets}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Транзакція відкотилась через помилку:');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * CLI-інтерфейс:
 * node scripts/importBudgetsFromExcel.js import/local-budgets.xlsx 2024
 */
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  const [, , fileArg, yearArg] = process.argv;

  if (!fileArg) {
    console.error('❌ Використання: node scripts/importBudgetsFromExcel.js <excel-file> [year]');
    process.exit(1);
  }

  const year = yearArg ? Number(yearArg) : new Date().getFullYear();

  importBudgets(fileArg, year)
    .then(() => {
      console.log("✨ Готово!");
    })
    .catch((err) => {
      console.error('❌ Критична помилка імпорту:', err);
      process.exit(1);
    });
}
