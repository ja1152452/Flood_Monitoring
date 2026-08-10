import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: parseInt(process.env.DB_POOL_MAX || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
      }
    : {
        host:              process.env.DB_HOST,
        port:              parseInt(process.env.DB_PORT || '5432'),
        database:          process.env.DB_NAME,
        user:              process.env.DB_USER,
        password:          process.env.DB_PASSWORD,
        max:               parseInt(process.env.DB_POOL_MAX || '20'),
        idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
        connectionTimeoutMillis: 5000,
        statement_timeout: 10000,
      }
);

pool.on('error', (err) => {
  console.error('[DB] Unexpected error:', err.message);
});

export const query = (text, params) => pool.query(text, params);

export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const testConnection = async () => {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('[DB] Connection successful');
};

export default pool;