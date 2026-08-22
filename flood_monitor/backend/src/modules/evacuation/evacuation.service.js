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

const safeParseDate = (val) => {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const str = String(val).trim();
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(am|pm))?)?$/i);
  if (dmyMatch) {
    const [, day, month, year, rawHours, mins, secs, ampm] = dmyMatch;
    let hours = rawHours ? parseInt(rawHours, 10) : 0;
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hours < 12) hours += 12;
      if (ampm.toLowerCase() === 'am' && hours === 12) hours = 0;
    }
    const parsed = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), hours, mins ? parseInt(mins, 10) : 0, secs ? parseInt(secs, 10) : 0);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

export const addFamily = async (centerId, dto, actorId) => {
  const { rows: centerCheck } = await query(
    'SELECT name, capacity_total, capacity_current FROM evacuation_centers WHERE id = $1',
    [centerId]
  );
  if (!centerCheck.length) throw ApiError.notFound('Evacuation center not found');

  const centerName = centerCheck[0].name;
  const capacityTotal = centerCheck[0].capacity_total || 0;
  const capacityCurrent = centerCheck[0].capacity_current || 0;
  const newMembers = parseInt(dto.members_list?.length ? dto.members_list.length + 1 : (dto.members || 1), 10);

  if (capacityTotal > 0 && (capacityCurrent + newMembers > capacityTotal)) {
    const available = Math.max(0, capacityTotal - capacityCurrent);
    throw ApiError.badRequest(
      `Capacity Exceeded! "${centerName}" has a maximum capacity of ${capacityTotal} evacuees (${available} spot(s) remaining). Cannot add ${newMembers} evacuee(s).`
    );
  }

  const headName = dto.head_name || [dto.head_first_name, dto.head_middle_name, dto.head_last_name, dto.head_name_ext].filter(Boolean).join(' ') || 'N/A';
  const fullAddress = dto.address || [dto.house_lot_no, dto.street, dto.subd_village, dto.barangay, dto.city_municipality, dto.province].filter(Boolean).join(', ');

  const headDob = safeParseDate(dto.head_dob);
  const arrivalDate = safeParseDate(dto.arrival_date) || new Date();
  const headAge = (dto.age && !isNaN(parseInt(dto.age, 10))) ? parseInt(dto.age, 10) : null;

  const { rows } = await query(
    `INSERT INTO evacuation_families (
       evacuation_center_id, head_name, members, barangay, contact, notes, age, gender, address, arrival_date, created_by,
       serial_number, region, province, city_municipality, district,
       head_last_name, head_first_name, head_middle_name, head_name_ext, head_dob, head_place_of_birth,
       head_civil_status, head_mothers_maiden_name, head_religion, head_occupation, head_monthly_income,
       head_id_card_presented, head_id_card_number, contact_alternate,
       house_lot_no, street, subd_village, zip_code, is_4ps_beneficiary, is_ip, ethnicity,
       bank_ewallet, account_name, account_type, account_number, house_ownership, shelter_damage
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
       $12,$13,$14,$15,$16,
       $17,$18,$19,$20,$21,$22,
       $23,$24,$25,$26,$27,
       $28,$29,$30,
       $31,$32,$33,$34,$35,$36,$37,
       $38,$39,$40,$41,$42,$43
     ) RETURNING *`,
    [
      centerId, headName, newMembers, dto.barangay || null, dto.contact || null, dto.notes || null,
      headAge, dto.gender || null, fullAddress || null, arrivalDate, actorId || null,
      dto.serial_number || null, dto.region || 'Region IV-A', dto.province || 'Laguna', dto.city_municipality || 'Lumban', dto.district || null,
      dto.head_last_name || null, dto.head_first_name || null, dto.head_middle_name || null, dto.head_name_ext || null, headDob, dto.head_place_of_birth || null,
      dto.head_civil_status || null, dto.head_mothers_maiden_name || null, dto.head_religion || null, dto.head_occupation || null, dto.head_monthly_income || null,
      dto.head_id_card_presented || null, dto.head_id_card_number || null, dto.contact_alternate || null,
      dto.house_lot_no || null, dto.street || null, dto.subd_village || null, dto.zip_code || null, Boolean(dto.is_4ps_beneficiary), Boolean(dto.is_ip), dto.ethnicity || null,
      dto.bank_ewallet || null, dto.account_name || null, dto.account_type || null, dto.account_number || null, dto.house_ownership || null, dto.shelter_damage || null
    ]
  );
  const family = rows[0];

  if (dto.members_list?.length) {
    for (const m of dto.members_list) {
      if (m.name?.trim()) {
        const mAge = (m.age && !isNaN(parseInt(m.age, 10))) ? parseInt(m.age, 10) : null;
        const mBirthdate = safeParseDate(m.birthdate);

        await query(
          `INSERT INTO evacuation_family_members (
             family_id, name, age, gender, relation_to_head, birthdate, sex, educational_attainment, occupation, vulnerability_type
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            family.id, m.name.trim(), mAge, m.gender || m.sex || null,
            m.relation_to_head || null, mBirthdate, m.sex || m.gender || null,
            m.educational_attainment || null, m.occupation || null, m.vulnerability_type || null
          ]
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
    after: { head_name: headName, members: newMembers, evacuation_center_id: centerId },
  });
  
  return family;
};

export const updateFamily = async (centerId, familyId, dto, actorId) => {
  const { rows: centerCheck } = await query(
    'SELECT name, capacity_total, capacity_current FROM evacuation_centers WHERE id = $1',
    [centerId]
  );
  if (!centerCheck.length) throw ApiError.notFound('Evacuation center not found');

  const { rows: oldFamily } = await query(
    'SELECT members FROM evacuation_families WHERE id = $1 AND evacuation_center_id = $2',
    [familyId, centerId]
  );
  if (!oldFamily.length) throw ApiError.notFound('Family record not found');

  const capacityTotal = centerCheck[0].capacity_total || 0;
  const capacityCurrent = centerCheck[0].capacity_current || 0;
  const oldMembers = oldFamily[0].members || 1;
  const newMembers = parseInt(dto.members_list?.length ? dto.members_list.length + 1 : (dto.members || 1), 10);

  if (capacityTotal > 0 && (capacityCurrent - oldMembers + newMembers > capacityTotal)) {
    const available = Math.max(0, capacityTotal - (capacityCurrent - oldMembers));
    throw ApiError.badRequest(
      `Capacity Exceeded! "${centerCheck[0].name}" has a maximum capacity of ${capacityTotal} evacuees (${available} spot(s) remaining). Cannot accommodate ${newMembers} evacuee(s).`
    );
  }

  const headName = dto.head_name || [dto.head_first_name, dto.head_middle_name, dto.head_last_name, dto.head_name_ext].filter(Boolean).join(' ') || 'N/A';
  const fullAddress = dto.address || [dto.house_lot_no, dto.street, dto.subd_village, dto.barangay, dto.city_municipality, dto.province].filter(Boolean).join(', ');

  const headDob = safeParseDate(dto.head_dob);
  const arrivalDate = safeParseDate(dto.arrival_date);
  const headAge = (dto.age && !isNaN(parseInt(dto.age, 10))) ? parseInt(dto.age, 10) : null;

  const { rows } = await query(
    `UPDATE evacuation_families SET
       head_name=$1, members=$2, barangay=$3, contact=$4, notes=$5, age=$6, gender=$7, address=$8, arrival_date=COALESCE($9, arrival_date),
       serial_number=$10, region=$11, province=$12, city_municipality=$13, district=$14,
       head_last_name=$15, head_first_name=$16, head_middle_name=$17, head_name_ext=$18, head_dob=$19, head_place_of_birth=$20,
       head_civil_status=$21, head_mothers_maiden_name=$22, head_religion=$23, head_occupation=$24, head_monthly_income=$25,
       head_id_card_presented=$26, head_id_card_number=$27, contact_alternate=$28,
       house_lot_no=$29, street=$30, subd_village=$31, zip_code=$32, is_4ps_beneficiary=$33, is_ip=$34, ethnicity=$35,
       bank_ewallet=$36, account_name=$37, account_type=$38, account_number=$39, house_ownership=$40, shelter_damage=$41,
       updated_at=NOW()
     WHERE id=$42 AND evacuation_center_id=$43 RETURNING *`,
    [
      headName, newMembers, dto.barangay || null, dto.contact || null, dto.notes || null,
      headAge, dto.gender || null, fullAddress || null, arrivalDate,
      dto.serial_number || null, dto.region || 'Region IV-A', dto.province || 'Laguna', dto.city_municipality || 'Lumban', dto.district || null,
      dto.head_last_name || null, dto.head_first_name || null, dto.head_middle_name || null, dto.head_name_ext || null, headDob, dto.head_place_of_birth || null,
      dto.head_civil_status || null, dto.head_mothers_maiden_name || null, dto.head_religion || null, dto.head_occupation || null, dto.head_monthly_income || null,
      dto.head_id_card_presented || null, dto.head_id_card_number || null, dto.contact_alternate || null,
      dto.house_lot_no || null, dto.street || null, dto.subd_village || null, dto.zip_code || null, Boolean(dto.is_4ps_beneficiary), Boolean(dto.is_ip), dto.ethnicity || null,
      dto.bank_ewallet || null, dto.account_name || null, dto.account_type || null, dto.account_number || null, dto.house_ownership || null, dto.shelter_damage || null,
      familyId, centerId
    ]
  );
  if (!rows.length) throw ApiError.notFound('Family record not found');

  if (dto.members_list !== undefined) {
    await query(`DELETE FROM evacuation_family_members WHERE family_id = $1`, [familyId]);
    for (const m of dto.members_list) {
      if (m.name?.trim()) {
        await query(
          `INSERT INTO evacuation_family_members (
             family_id, name, age, gender, relation_to_head, birthdate, sex, educational_attainment, occupation, vulnerability_type
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            familyId, m.name.trim(), m.age || null, m.gender || m.sex || null,
            m.relation_to_head || null, m.birthdate || null, m.sex || m.gender || null,
            m.educational_attainment || null, m.occupation || null, m.vulnerability_type || null
          ]
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
    after: { head_name: headName, members: dto.members },
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
