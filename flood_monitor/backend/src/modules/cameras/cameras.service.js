import bcrypt from 'bcrypt';
import { query, withTransaction } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAuditLog } from '../../middleware/audit.js';

export const create = async (dto, actorId) => {
  const { rows: existing } = await query(
    'SELECT id FROM cameras WHERE camera_code = $1',
    [dto.camera_code]
  );
  if (existing.length) throw ApiError.conflict('Camera code already registered');

  const apiKeyHash = await bcrypt.hash(dto.api_key, 12);

  const { rows } = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO cameras
         (camera_code, api_key_hash, location_name, barangay, lat, lng,
          baseline_meters, baseline_pixel_y, px_per_meter, stream_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, camera_code, location_name, barangay, lat, lng,
                 baseline_meters, baseline_pixel_y, px_per_meter,
                 stream_url, is_active, created_at`,
      [
        dto.camera_code, apiKeyHash, dto.location_name, dto.barangay,
        dto.lat, dto.lng, dto.baseline_meters, dto.baseline_pixel_y,
        dto.px_per_meter, dto.stream_url || null,
      ]
    );

    await client.query(
      `INSERT INTO flood_thresholds (camera_id, flood_level, min_meters, max_meters)
       VALUES
         ($1,'NORMAL',    0.0, 1.0),
         ($1,'MONITOR',   1.0, 1.5),
         ($1,'ALERT',     1.5, 2.0),
         ($1,'EVACUATION',2.0, 2.5),
         ($1,'CRITICAL',  2.5, 99.0)`,
      [rows[0].id]
    );

    return { rows };
  });

  await writeAuditLog({
    userId: actorId, action: 'CAMERA_CREATED',
    entityType: 'cameras', entityId: rows[0].id,
    after: { camera_code: dto.camera_code, location_name: dto.location_name },
  });

  return rows[0];
};

export const getAll = async () => {
  const { rows } = await query(
    `SELECT c.id, c.camera_code, c.location_name, c.barangay,
            c.lat, c.lng, c.is_active, c.last_heartbeat_at,
            c.stream_url,
            r.water_level_m, r.flood_level, r.captured_at AS last_reading_at
     FROM cameras c
     LEFT JOIN LATERAL (
       SELECT water_level_m, flood_level, captured_at
       FROM water_level_readings
       WHERE camera_id = c.id
       ORDER BY captured_at DESC
       LIMIT 1
     ) r ON TRUE
     ORDER BY c.location_name`
  );
  return rows;
};

export const getById = async (id) => {
  const { rows } = await query(
    `SELECT c.*,
            json_agg(t ORDER BY t.min_meters) AS thresholds
     FROM cameras c
     LEFT JOIN flood_thresholds t ON t.camera_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [id]
  );
  if (!rows.length) throw ApiError.notFound('Camera not found');
  return rows[0];
};

export const getCalibration = async (cameraCode) => {
  const { rows } = await query(
    `SELECT id, camera_code, baseline_meters, baseline_pixel_y, px_per_meter
     FROM cameras
     WHERE camera_code = $1 AND is_active = TRUE`,
    [cameraCode]
  );
  if (!rows.length) throw ApiError.notFound('Camera not found');
  return rows[0];
};

export const update = async (id, dto, actorId) => {
  const { rows: before } = await query('SELECT * FROM cameras WHERE id = $1', [id]);
  if (!before.length) throw ApiError.notFound('Camera not found');

  const fields  = Object.keys(dto);
  const values  = Object.values(dto);
  const setClause = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

  const { rows } = await query(
    `UPDATE cameras SET ${setClause}, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [id, ...values]
  );

  await writeAuditLog({
    userId: actorId, action: 'CAMERA_UPDATED',
    entityType: 'cameras', entityId: id,
    before: before[0], after: rows[0],
  });

  return rows[0];
};

export const updateCalibration = async (id, dto, actorId) => {
  const { rows: before } = await query(
    'SELECT baseline_meters, baseline_pixel_y, px_per_meter FROM cameras WHERE id = $1',
    [id]
  );
  if (!before.length) throw ApiError.notFound('Camera not found');

  const { rows } = await query(
    `UPDATE cameras
     SET baseline_meters = $2, baseline_pixel_y = $3, px_per_meter = $4, updated_at = NOW()
     WHERE id = $1
     RETURNING id, camera_code, baseline_meters, baseline_pixel_y, px_per_meter`,
    [id, dto.baseline_meters, dto.baseline_pixel_y, dto.px_per_meter]
  );

  await writeAuditLog({
    userId: actorId, action: 'CAMERA_CALIBRATED',
    entityType: 'cameras', entityId: id,
    before: before[0], after: dto,
  });

  return rows[0];
};

export const updateThresholds = async (cameraId, thresholds, actorId) => {
  await withTransaction(async (client) => {
    for (const t of thresholds) {
      await client.query(
        `UPDATE flood_thresholds
         SET min_meters = $3, max_meters = $4, updated_at = NOW(), updated_by = $5
         WHERE camera_id = $1 AND flood_level = $2::flood_level`,
        [cameraId, t.flood_level, t.min_meters, t.max_meters, actorId]
      );
    }
  });

  await writeAuditLog({
    userId: actorId, action: 'THRESHOLDS_UPDATED',
    entityType: 'cameras', entityId: cameraId,
    after: { thresholds },
  });
};