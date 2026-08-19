import bcrypt from 'bcrypt';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:ecTJQSRRoprHwtCWknkkupIXUqKYxxgG@altaria.proxy.rlwy.net:50744/railway',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const hash = await bcrypt.hash('Admin@1234', 10);
  const result = await pool.query(
    `UPDATE users 
     SET password_hash = $1, is_active = true, email_verified = true 
     WHERE email IN ('mdrrmo@lumban.gov.ph', 'superadmin@lumban.gov.ph', 'rescue1@lumban.gov.ph', 'mswdo@lumban.gov.ph')`,
    [hash]
  );
  console.log(`Updated ${result.rowCount} users with password Admin@1234`);
  await pool.end();
}

run().catch(console.error);
