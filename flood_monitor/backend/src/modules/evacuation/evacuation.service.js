import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { writeAuditLog } from '../../middleware/audit.js';

export const getAll = async (onlyOpen = false) => {
  const where = onlyOpen ? 'WHERE ec.is_open = TRUE' : '';
  const { rows } = await query(
    `SELECT ec.*, ec.barangay_id
     FROM evacuation_centers ec
     ${where}
     ORDER BY ec.name`
  );
  return rows;
};

export const getNearest = async (lat, lng, limit = 5) => {
  const { rows } = await query(
    `SELECT ec.*,
            b.name AS barangay_name,
            ROUND((
              6371000 * acos(
                cos(radians($1)) * cos(radians(ec.lat)) *
                cos(radians(ec.lng) - radians($2)) +
                sin(radians($1)) * sin(radians(ec.lat))
              )
            )::numeric, 0) AS distance_m
     FROM evacuation_centers ec
     LEFT JOIN barangays b ON b.id = ec.barangay_id
     WHERE ec.is_open = TRUE AND ec.capacity_current < ec.capacity_total
     ORDER BY distance_m
     LIMIT $3`,
    [lat, lng, limit]
  );
  return rows;
};

export const create = async (dto, actorId) => {
  let barangayId = null;

  if (dto.barangay) {
    const { rows: brgy } = await query(
      'SELECT id FROM barangays WHERE name ILIKE $1 LIMIT 1',
      [dto.barangay]
    );
    if (brgy.length) barangayId = brgy[0].id;

    if (!barangayId) {
      const { rows: newBrgy } = await query(
        `INSERT INTO barangays (name, risk_level) VALUES ($1, 'MODERATE') RETURNING id`,
        [dto.barangay]
      );
      barangayId = newBrgy[0].id;
    }
  }

  const { rows } = await query(
    `INSERT INTO evacuation_centers
       (name, barangay_id, address, lat, lng,
        capacity_total, contact_person, contact_number, is_open, updated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      dto.name,
      barangayId,
      dto.address    || null,
      dto.lat,
      dto.lng,
      dto.capacity_total,
      dto.contact_person || null,
      dto.contact_number || null,
      dto.is_open    || false,
      actorId,
    ]
  );

  const { rows: result } = await query(
    `SELECT ec.*, b.name AS barangay_name
     FROM evacuation_centers ec
     LEFT JOIN barangays b ON b.id = ec.barangay_id
     WHERE ec.id = $1`,
    [rows[0].id]
  );

  await writeAuditLog({
    userId: actorId, action: 'EVAC_CENTER_CREATED',
    entityType: 'evacuation_centers', entityId: rows[0].id,
    after: { name: dto.name, barangay: dto.barangay },
  });

  return result[0];
};

export const update = async (id, dto, actorId) => {
  const { rows: before } = await query(
    'SELECT * FROM evacuation_centers WHERE id = $1', [id]
  );
  if (!before.length) throw ApiError.notFound('Evacuation center not found');

  if (dto.capacity_current !== undefined) {
    const total = dto.capacity_total || before[0].capacity_total;
    if (dto.capacity_current > total) {
      throw ApiError.badRequest('capacity_current cannot exceed capacity_total');
    }
  }

  const allowed = ['name','address','capacity_total','capacity_current',
                   'contact_person','contact_number','is_open'];
  const updates = Object.entries(dto).filter(([k]) => allowed.includes(k));

  if (!updates.length) return before[0];

  const fields    = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
  const values    = updates.map(([, v]) => v);

  const { rows } = await query(
    `UPDATE evacuation_centers
     SET ${fields}, last_updated = NOW(), updated_by = $${values.length + 2}
     WHERE id = $1
     RETURNING *`,
    [id, ...values, actorId]
  );

  await writeAuditLog({
    userId: actorId, action: 'EVAC_CENTER_UPDATED',
    entityType: 'evacuation_centers', entityId: id,
    before: before[0], after: dto,
  });

  return rows[0];
};

export const remove = async (id, actorId) => {
  const { rows } = await query(
    'DELETE FROM evacuation_centers WHERE id = $1 RETURNING *', [id]
  );
  if (!rows.length) throw ApiError.notFound('Evacuation center not found');
  await writeAuditLog({
    userId: actorId, action: 'EVAC_CENTER_DELETED',
    entityType: 'evacuation_centers', entityId: id,
    before: rows[0],
  });
  return rows[0];
};

export const getFamilies = async (centerId) => {
  const { rows } = await query(
    `SELECT ef.*,
            COALESCE(json_agg(efm ORDER BY efm.created_at) FILTER (WHERE efm.id IS NOT NULL), '[]') AS members_list
     FROM evacuation_families ef
     LEFT JOIN evacuation_family_members efm ON efm.family_id = ef.id
     WHERE ef.evacuation_center_id = $1
     GROUP BY ef.id
     ORDER BY ef.created_at DESC`,
    [centerId]
  );
  return rows;
};

export const addFamily = async (centerId, dto, actorId) => {
  const { rows } = await query(
    `INSERT INTO evacuation_families (evacuation_center_id, head_name, members, barangay, contact, notes, age, gender, address, arrival_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [centerId, dto.head_name, dto.members || 1, dto.barangay || null, dto.contact || null, dto.notes || null,
     dto.age || null, dto.gender || null, dto.address || null, dto.arrival_date || new Date(), actorId]
  );
  const family = rows[0];

  if (dto.members_list?.length) {
    for (const m of dto.members_list) {
      if (m.name?.trim()) {
        await query(
          `INSERT INTO evacuation_family_members (family_id, name, age, gender) VALUES ($1,$2,$3,$4)`,
          [family.id, m.name.trim(), m.age || null, m.gender || null]
        );
      }
    }
  }

  await query(
    `UPDATE evacuation_centers SET capacity_current = (
       SELECT COALESCE(SUM(members),0) FROM evacuation_families WHERE evacuation_center_id = $1
     ), last_updated = NOW() WHERE id = $1`,
    [centerId]
  );
  
  await writeAuditLog({
    userId: actorId, action: 'FAMILY_ADDED',
    entityType: 'evacuation_families', entityId: family.id,
    after: { head_name: dto.head_name, members: dto.members, evacuation_center_id: centerId },
  });
  
  return family;
};

export const updateFamily = async (centerId, familyId, dto, actorId) => {
  const { rows } = await query(
    `UPDATE evacuation_families SET head_name=$1, members=$2, barangay=$3, contact=$4, notes=$5, age=$6, gender=$7, address=$8, arrival_date=$9, updated_at=NOW()
     WHERE id=$10 AND evacuation_center_id=$11 RETURNING *`,
    [dto.head_name, dto.members || 1, dto.barangay || null, dto.contact || null, dto.notes || null,
     dto.age || null, dto.gender || null, dto.address || null, dto.arrival_date || null, familyId, centerId]
  );
  if (!rows.length) throw ApiError.notFound('Family record not found');

  if (dto.members_list !== undefined) {
    await query(`DELETE FROM evacuation_family_members WHERE family_id = $1`, [familyId]);
    for (const m of dto.members_list) {
      if (m.name?.trim()) {
        await query(
          `INSERT INTO evacuation_family_members (family_id, name, age, gender) VALUES ($1,$2,$3,$4)`,
          [familyId, m.name.trim(), m.age || null, m.gender || null]
        );
      }
    }
  }

  await query(
    `UPDATE evacuation_centers SET capacity_current = (
       SELECT COALESCE(SUM(members),0) FROM evacuation_families WHERE evacuation_center_id = $1
     ), last_updated = NOW() WHERE id = $1`,
    [centerId]
  );
  
  await writeAuditLog({
    userId: actorId, action: 'FAMILY_UPDATED',
    entityType: 'evacuation_families', entityId: familyId,
    after: { head_name: dto.head_name, members: dto.members },
  });
  
  return rows[0];
};

export const deleteFamily = async (centerId, familyId) => {
  const { rows } = await query(
    `DELETE FROM evacuation_families WHERE id=$1 AND evacuation_center_id=$2 RETURNING *`,
    [familyId, centerId]
  );
  if (!rows.length) throw ApiError.notFound('Family record not found');
  
  await query(
    `UPDATE evacuation_centers SET capacity_current = (
       SELECT COALESCE(SUM(members),0) FROM evacuation_families WHERE evacuation_center_id = $1
     ), last_updated = NOW() WHERE id = $1`,
    [centerId]
  );
  
  await writeAuditLog({
    userId: rows[0].created_by, action: 'FAMILY_DELETED',
    entityType: 'evacuation_families', entityId: familyId,
    before: { head_name: rows[0].head_name, members: rows[0].members },
  });
  
  return rows[0];
};
