/* eslint-disable no-console */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// PostgreSQL
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

// fetch for CJS
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN_BACKEND;
if (!MAPBOX_TOKEN) {
  console.error("❌ Missing MAPBOX_TOKEN_BACKEND");
  process.exit(1);
}

const DELAY_MS = 150;

// Normalize region name if needed
function cleanRegionName(name) {
  if (!name) return "";
  return name
    .replace(/область/gi, "область")
    .replace(/Автономна Республіка Крим/gi, "Автономна Республіка Крим")
    .replace(/м\.\s*Київ/gi, "Київ")
    .trim();
}

// Mapbox geocode
async function geocode(q) {
  const url =
    "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
    encodeURIComponent(q) +
    `.json?limit=1&language=uk&access_token=${MAPBOX_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox error ${res.status}`);

  const data = await res.json();
  if (!data.features || !data.features.length) return null;

  return data.features[0];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("📍 Завантаження центрів областей…");

  const { rows: regions } = await pool.query(`
    SELECT id, name, code 
    FROM region
    WHERE center_lat IS NULL OR center_lng IS NULL
    ORDER BY id
  `);

  console.log(`🔢 Необхідно знайти: ${regions.length} регіонів`);

  let ok = 0, fail = 0;

  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const name = cleanRegionName(r.name);
    const q = `${name}, Україна`;

    console.log(`\n[${i + 1}/${regions.length}] 🗺️ ${q}`);

    try {
      const f = await geocode(q);

      if (!f) {
        console.log("   ❌ Не знайдено");
        fail++;
        await sleep(DELAY_MS);
        continue;
      }

      const [lng, lat] = f.center;

      await pool.query(
        `UPDATE region SET center_lat=$1, center_lng=$2 WHERE id=$3`,
        [lat, lng, r.id]
      );

      console.log(`   ✅ OK: lat=${lat}, lng=${lng}`);
      ok++;

    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
      fail++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n✨ Готово!`);
  console.log(`   ✔ Успішно: ${ok}`);
  console.log(`   ❌ Помилки: ${fail}`);

  await pool.end();
}

main();
