import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'db' || 'localhost',
  database: process.env.POSTGRES_DB || 'openbudget',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: 5432,
});

export default pool;
