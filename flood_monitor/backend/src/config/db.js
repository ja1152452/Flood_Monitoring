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

export const runAutoMigrations = async () => {
  const client = await pool.connect();
  try {
    console.log('[DB] Running auto-migrations to ensure all columns & enums exist...');

    // Enums
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MSWDO'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PNP'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'BFP'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'RHU'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MDRRMO_RESPONDER'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COAST_GUARD'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'BARANGAY_OFFICIAL'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE sos_status ADD VALUE IF NOT EXISTS 'DISPATCHED'; EXCEPTION WHEN others THEN NULL; END $$;`);

    // Evacuation Families columns
    await client.query(`
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS age INTEGER;
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS arrival_date TIMESTAMPTZ NOT NULL DEFAULT NOW();
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS serial_number VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS region VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS province VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS city_municipality VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS district VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_last_name VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_first_name VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_middle_name VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_name_ext VARCHAR(20);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_dob DATE;
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_place_of_birth VARCHAR(255);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_civil_status VARCHAR(50);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_mothers_maiden_name VARCHAR(255);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_religion VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_occupation VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_monthly_income VARCHAR(50);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_id_card_presented VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS head_id_card_number VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS contact_alternate VARCHAR(50);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS house_lot_no VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS street VARCHAR(255);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS subd_village VARCHAR(255);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS is_4ps_beneficiary BOOLEAN DEFAULT FALSE;
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS is_ip BOOLEAN DEFAULT FALSE;
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS ethnicity VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS bank_ewallet VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS account_type VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS account_number VARCHAR(100);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS house_ownership VARCHAR(50);
      ALTER TABLE evacuation_families ADD COLUMN IF NOT EXISTS shelter_damage VARCHAR(50);
    `);

    // Evacuation Family Members table and columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS evacuation_family_members (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id   UUID NOT NULL REFERENCES evacuation_families(id) ON DELETE CASCADE,
        name        VARCHAR(255) NOT NULL,
        age         INTEGER,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE evacuation_family_members ADD COLUMN IF NOT EXISTS relation_to_head VARCHAR(100);
      ALTER TABLE evacuation_family_members ADD COLUMN IF NOT EXISTS birthdate DATE;
      ALTER TABLE evacuation_family_members ADD COLUMN IF NOT EXISTS sex VARCHAR(20);
      ALTER TABLE evacuation_family_members ADD COLUMN IF NOT EXISTS educational_attainment VARCHAR(100);
      ALTER TABLE evacuation_family_members ADD COLUMN IF NOT EXISTS occupation VARCHAR(100);
      ALTER TABLE evacuation_family_members ADD COLUMN IF NOT EXISTS vulnerability_type VARCHAR(100);
    `);

    // SOS backup columns
    await client.query(`
      ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_notes TEXT;
      ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_responder_id UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_requested_at TIMESTAMPTZ;
      ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_dispatched_at TIMESTAMPTZ;
      ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_resolved_at TIMESTAMPTZ;
    `);

    // Audit logs table and columns
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
        action       VARCHAR(100) NOT NULL,
        entity_type  VARCHAR(100),
        entity_id    VARCHAR(100),
        description  TEXT,
        before_state JSONB,
        after_state  JSONB,
        ip_address   VARCHAR(45),
        user_agent   TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE audit_logs ALTER COLUMN entity_id TYPE VARCHAR(100);
      CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs (created_at DESC);
    `);

    console.log('[DB] Auto-migrations completed successfully.');
  } catch (err) {
    console.error('[DB] Auto-migration warning:', err.message);
  } finally {
    client.release();
  }
};

export const testConnection = async () => {
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('[DB] Connection successful');
  await runAutoMigrations();
};

export default pool;