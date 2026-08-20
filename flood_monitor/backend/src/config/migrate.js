import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      }
    : {
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      }
);

async function migrate() {
  const client = await pool.connect();
  console.log('Connected to database.');
  console.log('Running migrations...');
  try {
    await client.query('BEGIN');

    await client.query(`DO $$ BEGIN CREATE TYPE user_role AS ENUM ('SUPER_ADMIN','ADMIN','RESCUE','CITIZEN','MSWDO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MSWDO'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PNP'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'BFP'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'RHU'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MDRRMO_RESPONDER'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'BARANGAY_OFFICIAL'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE flood_level AS ENUM ('NORMAL','MONITOR','ALERT','EVACUATION','CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE alert_trigger AS ENUM ('THRESHOLD_BREACH','FORECAST_WARNING','MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE dispatch_channel AS ENUM ('FCM','SMS','IN_APP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE dispatch_status AS ENUM ('PENDING','SENT','FAILED','DELIVERED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE sos_status AS ENUM ('PENDING','ACKNOWLEDGED','DISPATCHED','RESPONDING','RESOLVED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN ALTER TYPE sos_status ADD VALUE IF NOT EXISTS 'DISPATCHED'; EXCEPTION WHEN others THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE risk_level AS ENUM ('VERY_HIGH','HIGH','MODERATE','LOW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE contact_category AS ENUM ('EMERGENCY','LGU','MEDICAL','POLICE','DISASTER','FIRE','UTILITIES'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE announcement_type AS ENUM ('GENERAL','FLOOD_WARNING','EVACUATION_ORDER','ALL_CLEAR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    console.log('  OK enum types');

    await client.query(`
      CREATE TABLE IF NOT EXISTS barangays (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(100) UNIQUE NOT NULL,
        risk_level  risk_level NOT NULL DEFAULT 'LOW',
        lat         DOUBLE PRECISION,
        lng         DOUBLE PRECISION,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  OK barangays');

    await client.query(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        number      VARCHAR(50) NOT NULL,
        category    contact_category NOT NULL,
        is_active   BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  OK emergency_contacts');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email                VARCHAR(255) UNIQUE NOT NULL,
        password_hash        VARCHAR(255) NOT NULL,
        role                 user_role NOT NULL DEFAULT 'CITIZEN',
        full_name            VARCHAR(255),
        barangay_id          UUID REFERENCES barangays(id) ON DELETE SET NULL,
        evacuation_center_id UUID,
        phone_number         VARCHAR(20),
        responder_type       VARCHAR(30),
        fcm_token            TEXT,
        is_active            BOOLEAN NOT NULL DEFAULT TRUE,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Add responder_type column if it doesn't exist (for existing DBs)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_type VARCHAR(30);
    `);
    // Add email verification columns if they don't exist
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp VARCHAR(6);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_expires_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_attempts INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_last_sent_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp VARCHAR(6);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_otp_expires_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
    `);
    console.log('  OK users');

    await client.query(`
      CREATE TABLE IF NOT EXISTS cameras (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        camera_code       VARCHAR(50) UNIQUE NOT NULL,
        api_key_hash      VARCHAR(255) NOT NULL,
        location_name     VARCHAR(255) NOT NULL,
        barangay_id       UUID REFERENCES barangays(id) ON DELETE SET NULL,
        lat               DOUBLE PRECISION NOT NULL,
        lng               DOUBLE PRECISION NOT NULL,
        baseline_meters   DOUBLE PRECISION NOT NULL DEFAULT 0.0,
        baseline_pixel_y  INTEGER NOT NULL DEFAULT 0,
        px_per_meter      DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        stream_url        TEXT,
        stream_active     BOOLEAN NOT NULL DEFAULT FALSE,
        is_active         BOOLEAN NOT NULL DEFAULT TRUE,
        last_heartbeat_at TIMESTAMPTZ,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  OK cameras');

    await client.query(`
      CREATE TABLE IF NOT EXISTS flood_thresholds (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        camera_id   UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
        flood_level flood_level NOT NULL,
        min_meters  DOUBLE PRECISION NOT NULL,
        max_meters  DOUBLE PRECISION NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT uq_threshold_camera_level UNIQUE (camera_id, flood_level),
        CONSTRAINT chk_threshold_range CHECK (min_meters < max_meters)
      );
    `);
    console.log('  OK flood_thresholds');

    await client.query(`
      CREATE TABLE IF NOT EXISTS water_level_readings (
        id                UUID NOT NULL DEFAULT gen_random_uuid(),
        camera_id         UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
        water_level_m     DOUBLE PRECISION NOT NULL,
        flood_level       flood_level NOT NULL,
        trend             VARCHAR(10) NOT NULL DEFAULT 'STABLE',
        waterline_pixel_y INTEGER,
        confidence        DOUBLE PRECISION,
        frame_url         TEXT,
        captured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, captured_at)
      );
    `);
    console.log('  OK water_level_readings');

    await client.query(`
      CREATE TABLE IF NOT EXISTS water_level_forecasts (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        camera_id             UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
        hours_ahead           SMALLINT NOT NULL,
        predicted_level_m     DOUBLE PRECISION NOT NULL,
        predicted_flood_level flood_level NOT NULL,
        model_confidence      DOUBLE PRECISION,
        forecast_run_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        valid_at              TIMESTAMPTZ NOT NULL
      );
    `);
    console.log('  OK water_level_forecasts');

    await client.query(`
      CREATE TABLE IF NOT EXISTS flood_alerts (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        camera_id      UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
        reading_id     UUID,
        flood_level    flood_level NOT NULL,
        trigger_type   alert_trigger NOT NULL DEFAULT 'THRESHOLD_BREACH',
        siren_active   BOOLEAN NOT NULL DEFAULT FALSE,
        is_active      BOOLEAN NOT NULL DEFAULT TRUE,
        triggered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at    TIMESTAMPTZ,
        resolved_by    UUID REFERENCES users(id) ON DELETE SET NULL,
        notes          TEXT
      );
    `);
    console.log('  OK flood_alerts');

    await client.query(`
      CREATE TABLE IF NOT EXISTS alert_dispatches (
        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_id       UUID NOT NULL REFERENCES flood_alerts(id) ON DELETE CASCADE,
        channel        dispatch_channel NOT NULL,
        recipient_role user_role NOT NULL,
        recipient_ref  VARCHAR(255) NOT NULL,
        message_sent   TEXT,
        status         dispatch_status NOT NULL DEFAULT 'PENDING',
        error_message  TEXT,
        dispatched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  OK alert_dispatches');

    await client.query(`
      CREATE TABLE IF NOT EXISTS evacuation_centers (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name             VARCHAR(255) NOT NULL,
        barangay_id      UUID REFERENCES barangays(id) ON DELETE SET NULL,
        address          TEXT,
        lat              DOUBLE PRECISION NOT NULL,
        lng              DOUBLE PRECISION NOT NULL,
        capacity_total   INTEGER NOT NULL DEFAULT 0,
        capacity_current INTEGER NOT NULL DEFAULT 0,
        contact_person   VARCHAR(255),
        contact_number   VARCHAR(20),
        is_open          BOOLEAN NOT NULL DEFAULT FALSE,
        last_updated     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by       UUID REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT chk_capacity CHECK (capacity_current <= capacity_total)
      );
    `);
    console.log('  OK evacuation_centers');

    await client.query(`
      CREATE TABLE IF NOT EXISTS evacuation_families (
        id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evacuation_center_id UUID NOT NULL REFERENCES evacuation_centers(id) ON DELETE CASCADE,
        head_name            VARCHAR(255) NOT NULL,
        members              INTEGER NOT NULL DEFAULT 1,
        barangay             VARCHAR(100),
        contact              VARCHAR(20),
        notes                TEXT,
        created_by           UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  OK evacuation_families');

    // Add age and address columns to evacuation_families
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
    console.log('  OK evacuation_families columns');

    // Family members table
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
    console.log('  OK evacuation_family_members');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sos_requests (
        id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        barangay_id        UUID REFERENCES barangays(id) ON DELETE SET NULL,
        lat                DOUBLE PRECISION NOT NULL,
        lng                DOUBLE PRECISION NOT NULL,
        message            TEXT,
        status             sos_status NOT NULL DEFAULT 'PENDING',
        assigned_rescue_id UUID REFERENCES users(id) ON DELETE SET NULL,
        dispatched_by      UUID REFERENCES users(id) ON DELETE SET NULL,
        dispatched_at      TIMESTAMPTZ,
        dispatch_notes     TEXT,
        victim_name        VARCHAR(255),
        victim_contact     VARCHAR(20),
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        acknowledged_at    TIMESTAMPTZ,
        responded_at       TIMESTAMPTZ,
        resolved_at        TIMESTAMPTZ
      );
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS responder_status VARCHAR(30) DEFAULT 'AVAILABLE';
      ALTER TABLE users ALTER COLUMN responder_status TYPE VARCHAR(30);
      ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS dispatched_by UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
      ALTER TABLE sos_requests ADD COLUMN IF NOT EXISTS dispatch_notes TEXT;
    `);
    console.log('  OK sos_requests');

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
        completed_at  TIMESTAMPTZ,
        CONSTRAINT uq_sos_responder UNIQUE (sos_id, responder_id)
      );
      ALTER TABLE sos_dispatches ADD COLUMN IF NOT EXISTS dispatch_type VARCHAR(20) DEFAULT 'PRIMARY';
    `);
    console.log('  OK sos_dispatches');

    await client.query(`
      CREATE TABLE IF NOT EXISTS backup_requests (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        lat           DOUBLE PRECISION NOT NULL,
        lng           DOUBLE PRECISION NOT NULL,
        message       TEXT,
        target_role   VARCHAR(50),
        status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at   TIMESTAMPTZ
      );
      ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS sos_id UUID REFERENCES sos_requests(id) ON DELETE SET NULL;
      ALTER TABLE backup_requests ADD COLUMN IF NOT EXISTS assigned_responder_id UUID REFERENCES users(id);
    `);
    console.log('  OK backup_requests');

    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_by        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title             VARCHAR(255) NOT NULL,
        message           TEXT NOT NULL,
        type              announcement_type NOT NULL DEFAULT 'GENERAL',
        target_roles      TEXT[] NOT NULL DEFAULT ARRAY['RESCUE','CITIZEN'],
        target_barangays  TEXT[],
        is_active         BOOLEAN NOT NULL DEFAULT TRUE,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at        TIMESTAMPTZ
      );
    `);
    console.log('  OK announcements');

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
        action       VARCHAR(100) NOT NULL,
        entity_type  VARCHAR(100),
        entity_id    UUID,
        before_state JSONB,
        after_state  JSONB,
        ip_address   VARCHAR(45),
        user_agent   TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  OK audit_logs');

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
    console.log('  OK flood_risk_areas');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_readings_camera_time   ON water_level_readings (camera_id, captured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_readings_flood_level   ON water_level_readings (flood_level, captured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_active          ON flood_alerts (is_active, triggered_at DESC) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_sos_pending            ON sos_requests (created_at DESC) WHERE status = 'PENDING';
      CREATE INDEX IF NOT EXISTS idx_sos_barangay           ON sos_requests (barangay_id, status);
      CREATE INDEX IF NOT EXISTS idx_backup_requests_active ON backup_requests (status, created_at DESC) WHERE status = 'ACTIVE';
      CREATE INDEX IF NOT EXISTS idx_backup_requests_requester ON backup_requests (requester_id);
      CREATE INDEX IF NOT EXISTS idx_backup_requests_target_role ON backup_requests (target_role, status);
      CREATE INDEX IF NOT EXISTS idx_users_role             ON users (role);
      CREATE INDEX IF NOT EXISTS idx_users_barangay         ON users (barangay_id);
      CREATE INDEX IF NOT EXISTS idx_evac_barangay          ON evacuation_centers (barangay_id);
      CREATE INDEX IF NOT EXISTS idx_evac_open              ON evacuation_centers (is_open) WHERE is_open = TRUE;
      CREATE INDEX IF NOT EXISTS idx_evac_families_center    ON evacuation_families (evacuation_center_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_time             ON audit_logs (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_announcements_active   ON announcements (is_active, created_at DESC) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_forecasts_camera       ON water_level_forecasts (camera_id, valid_at DESC);
    `);
    console.log('  OK indexes');

    // Clean up outdated barangay names not in the official list
    await client.query(`
      DELETE FROM barangays
      WHERE name NOT IN (
        'Bagong Silang', 'Balimbingan', 'Balubad', 'Caliraya',
        'Concepcion', 'Lewin', 'Maracta', 'Maytalang I',
        'Maytalang II', 'Primera Parang', 'Primera Pulo', 'Salac',
        'Segunda Parang', 'Segunda Pulo', 'Santo Niño', 'Wawa'
      );
    `);

    await client.query(`
      INSERT INTO barangays (name, risk_level, lat, lng) VALUES
        ('Bagong Silang',            'VERY_HIGH', 14.1660, 121.4960),
        ('Balimbingan',              'VERY_HIGH', 14.1700, 121.4950),
        ('Balubad',                  'VERY_HIGH', 14.1690, 121.4970),
        ('Caliraya',                 'LOW',       14.1500, 121.5100),
        ('Concepcion',               'VERY_HIGH', 14.1670, 121.4940),
        ('Lewin',                    'MODERATE',  14.1720, 121.4930),
        ('Maracta',                  'VERY_HIGH', 14.1710, 121.4930),
        ('Maytalang I',              'HIGH',      14.1600, 121.5010),
        ('Maytalang II',             'MODERATE',  14.1590, 121.5020),
        ('Primera Parang',           'HIGH',      14.1730, 121.4920),
        ('Primera Pulo',             'VERY_HIGH', 14.1680, 121.4945),
        ('Salac',                    'VERY_HIGH', 14.1720, 121.4955),
        ('Segunda Parang',           'HIGH',      14.1740, 121.4910),
        ('Segunda Pulo',             'VERY_HIGH', 14.1665, 121.4935),
        ('Santo Niño',               'MODERATE',  14.1750, 121.4900),
        ('Wawa',                     'VERY_HIGH', 14.1650, 121.4980)
      ON CONFLICT (name) DO UPDATE SET risk_level = EXCLUDED.risk_level;
    `);
    console.log('  OK barangays seed (Official 16 barangays)');

    await client.query(`
      DELETE FROM emergency_contacts;
      INSERT INTO emergency_contacts (name, number, category, sort_order) VALUES
        ('Emergency 911 (National Hotline)', '911',                         'EMERGENCY', 1),
        ('LGU – Lumban',                     '0917-164-2190',               'LGU',       2),
        ('RHU Lumban (Rural Health Unit)',   '0951-246-8199',               'MEDICAL',   3),
        ('Lumban MPS (Municipal Police)',    '0998-598-5651, 0963-420-1016', 'POLICE',    4),
        ('LDRRMO',                           '0917-193-8983',               'DISASTER',  5),
        ('Bureau of Fire Protection (BFP)',  '557-0771, 0951-244-9285',     'FIRE',      6),
        ('FLECO Emergency Hotline',          '0951-570-4206, 0933-816-8117', 'UTILITIES', 7);
    `);
    console.log('  OK emergency contacts seed');

    const defaultHash = await bcrypt.hash('Admin@1234', 10);

    await client.query(`
      INSERT INTO users (email, password_hash, role, full_name, is_active, email_verified)
      VALUES
        ('superadmin@lumban.gov.ph', $1, 'SUPER_ADMIN', 'System Administrator', true, true),
        ('mdrrmo@lumban.gov.ph',     $1, 'ADMIN',       'MDRRMO Officer',        true, true),
        ('rescue1@lumban.gov.ph',    $1, 'RESCUE',      'Rescue Team Alpha',     true, true),
        ('mswdo@lumban.gov.ph',      $1, 'MSWDO',       'MSWDO Officer',         true, true)
      ON CONFLICT (email) DO UPDATE 
        SET password_hash = EXCLUDED.password_hash,
            is_active = true,
            email_verified = true;
    `, [defaultHash]);
    console.log('  OK seed users');

    await client.query(`
      UPDATE users SET barangay_id = (
        SELECT id FROM barangays WHERE name = 'Wawa' LIMIT 1
      ) WHERE email = 'rescue1@lumban.gov.ph';
    `);
    console.log('  OK rescue user barangay assigned');

    await client.query(`
      INSERT INTO cameras (
        camera_code, api_key_hash, location_name, barangay_id,
        lat, lng, baseline_meters, baseline_pixel_y, px_per_meter, stream_url
      )
      SELECT
        'CAM-LUMBAN-01',
        $1,
        'Pagsanjan-Lumban River Bridge',
        b.id,
        14.1688, 121.4956,
        3.1, 827, 191.82,
        'rtsp://FloodMonitoring:FloodCam2026!@192.168.0.103:554/stream1'
      FROM barangays b WHERE b.name = 'Wawa'
      ON CONFLICT (camera_code) DO UPDATE SET api_key_hash = EXCLUDED.api_key_hash;
    `, [defaultHash]);
    console.log('  OK seed camera');

    await client.query(`
      INSERT INTO flood_thresholds (camera_id, flood_level, min_meters, max_meters)
      SELECT id,
        unnest(ARRAY['NORMAL','MONITOR','ALERT','EVACUATION','CRITICAL']::flood_level[]),
        unnest(ARRAY[0.0, 3.1, 4.1, 5.1, 6.1]),
        unnest(ARRAY[3.1, 4.1, 5.1, 6.1, 99.0])
      FROM cameras WHERE camera_code = 'CAM-LUMBAN-01'
      ON CONFLICT ON CONSTRAINT uq_threshold_camera_level DO NOTHING;
    `);
    console.log('  OK flood thresholds');

    await client.query(`
      INSERT INTO evacuation_centers (name, barangay_id, lat, lng, capacity_total, contact_person, contact_number)
      SELECT 'Lumban Central School', b.id, 14.1700, 121.4950, 500, 'Principal Santos', '+639191234567'
      FROM barangays b WHERE b.name = 'Poblacion' ON CONFLICT DO NOTHING;

      INSERT INTO evacuation_centers (name, barangay_id, lat, lng, capacity_total, contact_person, contact_number)
      SELECT 'Wawa Barangay Hall', b.id, 14.1650, 121.4980, 150, 'Brgy. Captain Reyes', '+639201234567'
      FROM barangays b WHERE b.name = 'Wawa' ON CONFLICT DO NOTHING;

      INSERT INTO evacuation_centers (name, barangay_id, lat, lng, capacity_total, contact_person, contact_number)
      SELECT 'Lewin Covered Court', b.id, 14.1720, 121.4930, 200, 'Brgy. Captain Cruz', '+639211234567'
      FROM barangays b WHERE b.name = 'Lewin' ON CONFLICT DO NOTHING;

      INSERT INTO evacuation_centers (name, barangay_id, lat, lng, capacity_total, contact_person, contact_number)
      SELECT 'Maytalang I Multi-purpose Hall', b.id, 14.1600, 121.5010, 180, 'Brgy. Captain Dela Rosa', '+639221234567'
      FROM barangays b WHERE b.name = 'Maytalang I' ON CONFLICT DO NOTHING;

      INSERT INTO evacuation_centers (name, barangay_id, lat, lng, capacity_total, contact_person, contact_number)
      SELECT 'Concepcion Barangay Hall', b.id, 14.1670, 121.4940, 120, 'Brgy. Captain Santos', '+639231234567'
      FROM barangays b WHERE b.name = 'Concepcion' ON CONFLICT DO NOTHING;

      INSERT INTO evacuation_centers (name, barangay_id, lat, lng, capacity_total, contact_person, contact_number)
      SELECT 'Maytalang II Covered Court', b.id, 14.1590, 121.5020, 150, 'Brgy. Captain Ramos', '+639241234567'
      FROM barangays b WHERE b.name = 'Maytalang II' ON CONFLICT DO NOTHING;
    `);
    console.log('  OK evacuation centers');

    await client.query('COMMIT');

    console.log('');
    console.log('========================================');
    console.log('  Migration complete!');
    console.log('========================================');
    console.log('');
    console.log('  Tables created:');
    console.log('    barangays, emergency_contacts, users');
    console.log('    cameras, flood_thresholds');
    console.log('    water_level_readings, water_level_forecasts');
    console.log('    flood_alerts, alert_dispatches');
    console.log('    evacuation_centers, evacuation_families');
    console.log('    sos_requests, backup_requests');
    console.log('    announcements, audit_logs');
    console.log('');
    console.log('  Seed data:');
    console.log('    16 barangays with risk levels');
    console.log('    10 emergency hotlines');
    console.log('    3 user accounts (password: Admin@1234)');
    console.log('    1 camera (CAM-LUMBAN-01)');
    console.log('    5 flood thresholds');
    console.log('    6 evacuation centers');
    console.log('');
    console.log('  Login accounts:');
    console.log('    superadmin@lumban.gov.ph  SUPER_ADMIN');
    console.log('    mdrrmo@lumban.gov.ph      ADMIN');
    console.log('    rescue1@lumban.gov.ph     RESCUE (Wawa)');
    console.log('    All passwords: Admin@1234');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();