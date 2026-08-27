import { query } from './src/config/db.js';

async function seedAuditLogs() {
  try {
    const adminId = '82c2dbd7-74fa-4d51-9607-0feb079c08aa'; // mdrrmo@lumban.gov.ph

    const auditEntries = [
      // ==========================================
      // 1. NIGHT DRILL: Aug 26, 2026 (9:30 PM - 10:00 PM)
      // ==========================================
      {
        user_id: adminId,
        action: 'SIMULATION_STARTED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: { mode: 'simulation', flood_level: 'NORMAL', water_level_m: 2.00, start_time: '2026-08-26T21:30:00+08:00' },
        created_at: new Date('2026-08-26T21:30:00+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_SCENARIO_STARTED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          scenario_name: 'Night Evacuation Drill (2.0m ➔ 5.85m)',
          start_time: '09:30:00 PM',
          start_level_m: 2.00,
          target_level_m: 5.85,
          duration_sec: 60,
          is_cycle: true,
        },
        created_at: new Date('2026-08-26T21:30:02+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_THRESHOLD_BREACHED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          level: 'MONITOR',
          threshold_m: 3.10,
          current_level_m: 3.25,
          elapsed_sec: 12,
          siren_activated: true,
          fcm_push_dispatched: true,
        },
        created_at: new Date('2026-08-26T21:30:12+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_THRESHOLD_BREACHED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          level: 'ALERT',
          threshold_m: 4.10,
          current_level_m: 4.25,
          elapsed_sec: 24,
          siren_activated: true,
          fcm_push_dispatched: true,
        },
        created_at: new Date('2026-08-26T21:30:24+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_THRESHOLD_BREACHED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          level: 'EVACUATION',
          threshold_m: 5.10,
          current_level_m: 5.45,
          elapsed_sec: 42,
          siren_activated: true,
          evacuation_centers_opened: true,
          fcm_push_dispatched: true,
        },
        created_at: new Date('2026-08-26T21:30:42+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_SCENARIO_COMPLETED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          scenario_name: 'Night Evacuation Drill (2.0m ➔ 5.85m)',
          started_at: '2026-08-26T21:30:00+08:00',
          completed_at: '2026-08-26T22:00:00+08:00',
          peak_level_m: 5.85,
          peak_category: 'EVACUATION',
          duration_sec: 60,
          total_points_logged: 31,
          status: 'SUCCESSFUL_DRILL',
        },
        created_at: new Date('2026-08-26T22:00:00+08:00').toISOString(),
      },

      // ==========================================
      // 2. MORNING DRILL: Aug 27, 2026 (9:00 AM - 9:30 AM)
      // ==========================================
      {
        user_id: adminId,
        action: 'SIMULATION_STARTED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: { mode: 'simulation', flood_level: 'NORMAL', water_level_m: 2.00, start_time: '2026-08-27T09:00:00+08:00' },
        created_at: new Date('2026-08-27T09:00:00+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_SCENARIO_STARTED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          scenario_name: 'Morning Flash Flood Drill (2.0m ➔ 6.25m)',
          start_time: '09:00:00 AM',
          start_level_m: 2.00,
          target_level_m: 6.25,
          duration_sec: 60,
          is_cycle: true,
        },
        created_at: new Date('2026-08-27T09:00:02+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_THRESHOLD_BREACHED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          level: 'MONITOR',
          threshold_m: 3.10,
          current_level_m: 3.25,
          elapsed_sec: 8,
          siren_activated: true,
          fcm_push_dispatched: true,
        },
        created_at: new Date('2026-08-27T09:00:08+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_THRESHOLD_BREACHED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          level: 'ALERT',
          threshold_m: 4.10,
          current_level_m: 4.30,
          elapsed_sec: 16,
          siren_activated: true,
          fcm_push_dispatched: true,
        },
        created_at: new Date('2026-08-27T09:00:16+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_THRESHOLD_BREACHED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          level: 'EVACUATION',
          threshold_m: 5.10,
          current_level_m: 5.35,
          elapsed_sec: 24,
          siren_activated: true,
          evacuation_orders: 'MANDATORY_DISPATCHED',
          fcm_push_dispatched: true,
        },
        created_at: new Date('2026-08-27T09:00:24+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_THRESHOLD_BREACHED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          level: 'CRITICAL',
          threshold_m: 6.10,
          current_level_m: 6.25,
          elapsed_sec: 28,
          siren_activated: true,
          emergency_broadcast: true,
          fcm_push_dispatched: true,
        },
        created_at: new Date('2026-08-27T09:00:28+08:00').toISOString(),
      },
      {
        user_id: adminId,
        action: 'DRILL_SCENARIO_COMPLETED',
        entity_type: 'FLOOD_SIMULATION',
        after_state: {
          scenario_name: 'Morning Flash Flood Drill (2.0m ➔ 6.25m)',
          started_at: '2026-08-27T09:00:00+08:00',
          completed_at: '2026-08-27T09:30:00+08:00',
          peak_level_m: 6.25,
          peak_category: 'CRITICAL',
          duration_sec: 60,
          total_points_logged: 31,
          status: 'SUCCESSFUL_DRILL',
        },
        created_at: new Date('2026-08-27T09:30:00+08:00').toISOString(),
      },
    ];

    console.log(`Inserting ${auditEntries.length} drill audit log entries into PostgreSQL...`);
    for (const e of auditEntries) {
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, after_state, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [e.user_id, e.action, e.entity_type, JSON.stringify(e.after_state), '127.0.0.1', e.created_at]
      );
    }
    console.log('Successfully inserted all simulation drill audit logs!');
    process.exit(0);
  } catch (err) {
    console.error('Audit log seed error:', err);
    process.exit(1);
  }
}

seedAuditLogs();
