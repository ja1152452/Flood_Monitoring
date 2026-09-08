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
    console.log('[DB] Running auto-migrations to ensure all columns, tables & enums exist...');

    // 1. Enums
    const enumQueries = [
      `DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MSWDO'; EXCEPTION WHEN others THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PNP'; EXCEPTION WHEN others THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'BFP'; EXCEPTION WHEN others THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'RHU'; EXCEPTION WHEN others THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MDRRMO_RESPONDER'; EXCEPTION WHEN others THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COAST_GUARD'; EXCEPTION WHEN others THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'BARANGAY_OFFICIAL'; EXCEPTION WHEN others THEN NULL; END $$;`,
      `DO $$ BEGIN ALTER TYPE sos_status ADD VALUE IF NOT EXISTS 'DISPATCHED'; EXCEPTION WHEN others THEN NULL; END $$;`,
    ];
    for (const eq of enumQueries) {
      try { await client.query(eq); } catch (_) {}
    }

    // 2. Users table columns
    try {
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_status VARCHAR(30) DEFAULT 'AVAILABLE';
        ALTER TABLE users ALTER COLUMN responder_status TYPE VARCHAR(30);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_type VARCHAR(30);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat DOUBLE PRECISION;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng DOUBLE PRECISION;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_location_at TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp VARCHAR(6);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_expires_at TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_last_sent_at TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(6);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      `);
    } catch (err) {
      console.warn('[DB] Warning updating users columns:', err.message);
    }

    // 3. Evacuation Families columns & Family Members table
    try {
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
    } catch (err) {
      console.warn('[DB] Warning updating evacuation tables:', err.message);
    }

    // 4. SOS requests columns
    try {
      await client.query(`
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS victim_name VARCHAR(255);
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS victim_contact VARCHAR(20);
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS dispatched_by UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS dispatch_notes TEXT;
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_notes TEXT;
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_responder_id UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_requested_at TIMESTAMPTZ;
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_dispatched_at TIMESTAMPTZ;
        ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS backup_resolved_at TIMESTAMPTZ;
      `);
    } catch (err) {
      console.warn('[DB] Warning updating sos_requests columns:', err.message);
    }

    // 5. SOS Dispatches table & Unique Constraint
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sos_dispatches (
          id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sos_id        UUID NOT NULL REFERENCES sos_requests(id) ON DELETE CASCADE,
          responder_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          dispatched_by UUID REFERENCES users(id) ON DELETE SET NULL,
          dispatch_type VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
          status        VARCHAR(20) NOT NULL DEFAULT 'DISPATCHED',
          notes         TEXT,
          dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          responded_at  TIMESTAMPTZ,
          completed_at  TIMESTAMPTZ
        );
        ALTER TABLE sos_dispatches ADD COLUMN IF NOT EXISTS dispatch_type VARCHAR(20) DEFAULT 'PRIMARY';
        ALTER TABLE sos_dispatches ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'DISPATCHED';
        ALTER TABLE sos_dispatches ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE sos_dispatches ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE sos_dispatches ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
        ALTER TABLE sos_dispatches ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

        -- Deduplicate if any legacy duplicate pairs exist before applying unique constraint
        DELETE FROM sos_dispatches a USING sos_dispatches b
        WHERE a.ctid < b.ctid AND a.sos_id = b.sos_id AND a.responder_id = b.responder_id;

        CREATE UNIQUE INDEX IF NOT EXISTS idx_sos_dispatches_uq ON sos_dispatches (sos_id, responder_id);
      `);
    } catch (err) {
      console.warn('[DB] Warning updating sos_dispatches table:', err.message);
    }

    // 6. Backup Requests table & columns
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS backup_requests (
          id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          requester_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          lat                   DOUBLE PRECISION NOT NULL,
          lng                   DOUBLE PRECISION NOT NULL,
          message               TEXT,
          target_role           VARCHAR(50),
          status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
          created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          resolved_at           TIMESTAMPTZ,
          sos_id                UUID REFERENCES sos_requests(id) ON DELETE SET NULL,
          assigned_responder_id UUID REFERENCES users(id) ON DELETE SET NULL
        );
        ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS sos_id UUID REFERENCES sos_requests(id) ON DELETE SET NULL;
        ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS assigned_responder_id UUID REFERENCES users(id) ON DELETE SET NULL;
        ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS target_role VARCHAR(50);
        ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
      `);
    } catch (err) {
      console.warn('[DB] Warning updating backup_requests table:', err.message);
    }

    // 7. Audit logs table and columns
    try {
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
      `);
    } catch (err) {
      console.warn('[DB] Warning updating audit_logs table:', err.message);
    }

    // 8. Flood Risk Areas table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS flood_risk_areas (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name       VARCHAR(255) NOT NULL,
          risk_level VARCHAR(50) NOT NULL,
          lat        DOUBLE PRECISION NOT NULL,
          lng        DOUBLE PRECISION NOT NULL,
          radius     INTEGER NOT NULL DEFAULT 250,
          note       TEXT,
          is_active  BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
    } catch (err) {
      console.warn('[DB] Warning updating flood_risk_areas table:', err.message);
    }

    // 9. Performance Indexes
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sos_pending            ON sos_requests (created_at DESC) WHERE status = 'PENDING';
        CREATE INDEX IF NOT EXISTS idx_sos_barangay           ON sos_requests (barangay_id, status);
        CREATE INDEX IF NOT EXISTS idx_sos_dispatches_sos     ON sos_dispatches (sos_id);
        CREATE INDEX IF NOT EXISTS idx_sos_dispatches_resp    ON sos_dispatches (responder_id);
        CREATE INDEX IF NOT EXISTS idx_backup_requests_active ON backup_requests (status, created_at DESC) WHERE status = 'ACTIVE';
        CREATE INDEX IF NOT EXISTS idx_backup_requests_requester ON backup_requests (requester_id);
        CREATE INDEX IF NOT EXISTS idx_backup_requests_sos    ON backup_requests (sos_id);
        CREATE INDEX IF NOT EXISTS idx_users_role             ON users (role);
        CREATE INDEX IF NOT EXISTS idx_users_responder_status ON users (responder_status);
        CREATE INDEX IF NOT EXISTS idx_audit_time             ON audit_logs (created_at DESC);
      `);
    } catch (err) {
      console.warn('[DB] Warning creating indexes:', err.message);
    }

    console.log('[DB] Auto-migrations completed successfully.');
  } catch (err) {
    console.error('[DB] Auto-migration error:', err.message);
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