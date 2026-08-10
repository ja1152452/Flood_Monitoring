import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function resetPasswords() {
  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash('Admin@1234', 12);
    console.log('Generated hash:', hash);

    await client.query(
      `UPDATE users SET password_hash = $1`,
      [hash]
    );

    console.log('All user passwords reset to: Admin@1234');

    const { rows } = await client.query(
      'SELECT email, role FROM users ORDER BY role'
    );
    console.log('');
    console.log('Users in database:');
    rows.forEach(r => console.log(`  ${r.email}  (${r.role})`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

resetPasswords();