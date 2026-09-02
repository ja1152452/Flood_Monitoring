import { query } from './src/config/db.js';

async function seed() {
  try {
    const camId = '3b7e2b66-d4d5-4ae9-be3f-1c7c31e5b03f';
    const readings = [];

    // 1. Kagabi: Aug 26, 2026 (20:30 to 22:30) - Simulation Drill Run (Peak at 21:30 @ 5.85m EVACUATION)
    const startLastNight = new Date('2026-08-26T20:30:00+08:00');
    for (let i = 0; i <= 60; i++) {
      const dt = new Date(startLastNight.getTime() + i * 2 * 60 * 1000); // every 2 mins
      let lvl = 2.00;
      let trend = 'STABLE';
      if (i <= 20) {
        lvl = 2.00 + (5.85 - 2.00) * (i / 20);
        trend = 'RISING';
      } else if (i <= 30) {
        lvl = 5.85;
        trend = 'STABLE';
      } else {
        lvl = 5.85 - (5.85 - 2.00) * ((i - 30) / 30);
        trend = 'RECEDING';
      }
      lvl = parseFloat(lvl.toFixed(3));
      const floodLvl = lvl >= 6.0 ? 'CRITICAL' : lvl >= 5.0 ? 'EVACUATION' : lvl >= 4.0 ? 'ALERT' : lvl >= 3.1 ? 'MONITOR' : 'NORMAL';
      readings.push([camId, lvl, floodLvl, trend, dt.toISOString(), dt.toISOString()]);
    }

    // 2. Kaninang Umaga: Aug 27, 2026 (08:30 to 10:30) - Simulation Drill Run (Peak at 09:00 - 09:30 @ 6.25m CRITICAL)
    const startThisMorning = new Date('2026-08-27T08:30:00+08:00');
    for (let i = 0; i <= 60; i++) {
      const dt = new Date(startThisMorning.getTime() + i * 2 * 60 * 1000); // every 2 mins
      let lvl = 2.00;
      let trend = 'STABLE';
      if (i <= 20) {
        lvl = 2.00 + (6.25 - 2.00) * (i / 20);
        trend = 'RISING';
      } else if (i <= 30) {
        lvl = 6.25;
        trend = 'STABLE';
      } else {
        lvl = 6.25 - (6.25 - 2.00) * ((i - 30) / 30);
        trend = 'RECEDING';
      }
      lvl = parseFloat(lvl.toFixed(3));
      const floodLvl = lvl >= 6.0 ? 'CRITICAL' : lvl >= 5.0 ? 'EVACUATION' : lvl >= 4.0 ? 'ALERT' : lvl >= 3.1 ? 'MONITOR' : 'NORMAL';
      readings.push([camId, lvl, floodLvl, trend, dt.toISOString(), dt.toISOString()]);
    }

    // 3. Hourly baseline for Aug 26 & Aug 27
    const baseStart = new Date('2026-08-26T00:00:00+08:00');
    const baseEnd = new Date('2026-08-27T20:50:00+08:00');
    for (let t = baseStart.getTime(); t <= baseEnd.getTime(); t += 3600000) {
      const dt = new Date(t);
      const isDuringLastNight = (dt >= new Date('2026-08-26T20:30:00+08:00') && dt <= new Date('2026-08-26T22:30:00+08:00'));
      const isDuringThisMorning = (dt >= new Date('2026-08-27T08:30:00+08:00') && dt <= new Date('2026-08-27T10:30:00+08:00'));
      if (!isDuringLastNight && !isDuringThisMorning) {
        readings.push([camId, 2.000, 'NORMAL', 'STABLE', dt.toISOString(), dt.toISOString()]);
      }
    }

    console.log(`Inserting ${readings.length} readings into PostgreSQL database...`);
    for (const r of readings) {
      await query(
        `INSERT INTO water_level_readings (camera_id, water_level_m, flood_level, trend, captured_at, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        r
      );
    }
    console.log('Successfully inserted all drill and baseline readings!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
