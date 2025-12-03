/* eslint-disable no-console */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// -------------------------------
// PostgreSQL
// -------------------------------
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.DB_HOST || process.env.POSTGRES_HOST || 'db',
  port: Number(process.env.DB_PORT || process.env.POSTGRES_PORT || 5432),
  database: process.env.DB_NAME || process.env.POSTGRES_DB || 'postgres',
  user: process.env.DB_USER || process.env.POSTGRES_USER || 'postgres',
  password: process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// -------------------------------
// Fetch (CommonJS)
// -------------------------------
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// -------------------------------
// Mapbox settings
// -------------------------------
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN_BACKEND;
if (!MAPBOX_TOKEN) {
  console.error("❌ ERROR: Missing MAPBOX_TOKEN_BACKEND env variable");
  process.exit(1);
}

// Mapbox rate-limit: up to 10 rps safely
const DELAY_MS = 120; // ~8 req/sec


// -------------------------------
// NORMALIZATION of names
// -------------------------------
function normalizeName(raw) {
  if (!raw) return null;

  let s = raw.trim();

  // remove descriptors
  s = s
    .replace(/селище міського типу/gi, "")
    .replace(/місто республіканського значення/gi, "")
    .replace(/місто обласного значення/gi, "")
    .replace(/місто районного значення/gi, "")
    .replace(/місто/gi, "")
    .replace(/смт/gi, "")
    .replace(/с. /gi, "")
    .replace(/селищні бюджети/gi, "")
    .replace(/бюджети районів у/gi, "")
    .replace(/бюджети/gi, "")
    .replace(/зведений бюджет/gi, "")
    .replace(/в автентичній республіці крим/gi, "")
    .replace(/ в .*$/gi, "") // cut after "в ..."
    .replace(/\s+/g, " ")
    .trim();

  // capitalise first letter
  if (s.length > 0) {
    s = s[0].toUpperCase() + s.slice(1);
  }

  return s;
}

// -------------------------------
// Mapbox Geocoding
// -------------------------------
async function geocode(query) {
  const url =
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
    encodeURIComponent(query) +
    `.json?language=uk&limit=1&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Mapbox error ${res.status}`);
  }

  const data = await res.json();
  if (!data.features || data.features.length === 0) return null;

  return data.features[0];
}

// -------------------------------
// Delay helper
// -------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -------------------------------
// MAIN LOGIC
// -------------------------------
async function main() {
  console.log("📍 Завантаження координат (Mapbox)...");

  const { rows } = await pool.query(`
    SELECT id, name, full_ato_name, katottg
    FROM community
    WHERE lat IS NULL OR lng IS NULL
    ORDER BY id
  `);

  console.log(`🔢 Потрібно знайти координати для: ${rows.length} громад\n`);

  let success = 0;
  let fail = 0;

  for (let i = 0; i < rows.length; i++) {
    const c = rows[i];

    console.log(`[${i + 1}/${rows.length}] 🗺️ ID=${c.id}`);

    const rawName = c.full_ato_name || c.name || "";
    const norm = normalizeName(rawName);
    const queryBase = `${norm}, Україна`;

    console.log(`   🔎 Base query: ${queryBase}`);

    try {
      // Attempt 1: normalized name
      let res = await geocode(queryBase);

      if (!res) {
        console.log("   ↪ Not found, trying fallback #1");
        const fallbackQuery1 = `${norm}, ${extractRegionFromName(rawName)}, Україна`;
        res = await geocode(fallbackQuery1);

        if (!res) {
          console.log("   ↪ Not found, trying fallback #2");
          const shortName = norm.split(" ")[0];
          const fallbackQuery2 = `${shortName}, Україна`;
          res = await geocode(fallbackQuery2);
        }
      }

      if (!res) {
        console.log("   ❌ No results from Mapbox");
        fail++;
        await sleep(DELAY_MS);
        continue;
      }

      const [lng, lat] = res.center;

      await pool.query(
        `UPDATE community SET lat = $1, lng = $2 WHERE id = $3`,
        [lat, lng, c.id]
      );

      console.log(`   ✅ Found: lat=${lat}, lng=${lng}`);
      success++;

    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      fail++;
    }

    await sleep(DELAY_MS);
  }

  console.log("\n✨ Готово!");
  console.log(`   Успішно: ${success}`);
  console.log(`   Помилки: ${fail}`);

  await pool.end();
}

// -------------------------------
// Extract region name from long full_ato_name
// e.g. "селище ... Залізничного району у Миколаївській області"
// → "Миколаївська область"
// -------------------------------
function extractRegionFromName(str) {
  if (!str) return "";

  const m = str.match(/([А-ЯІЇЄҐа-яіїєґ]+ська область)/);
  if (m) return m[1];

  if (/київ/i.test(str)) return "Київ";
  if (/крим/i.test(str)) return "Автономна Республіка Крим";

  return "";
}

// -------------------------------
main().catch((err) => {
  console.error("💥 Критична помилка:", err);
  process.exit(1);
});
