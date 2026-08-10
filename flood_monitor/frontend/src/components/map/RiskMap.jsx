import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import lumbanBoundary from '../../lumban-boundary.geojson';

const LUMBAN_CENTER = [14.291969, 121.460112];

// Each level has its own fixed color — political map style
const RISK_CONFIG = {
  VERY_HIGH: {
    color:   '#c0392b',
    fill:    '#e74c3c',
    label:   'Napakataas na Panganib',
    english: 'Very High Risk',
    icon:    '🔴',
    desc:    'Mataas na tsansa ng pagbaha. Maaring kailangang mag-evacuate.',
  },
  HIGH: {
    color:   '#d35400',
    fill:    '#e67e22',
    label:   'Mataas na Panganib',
    english: 'High Risk',
    icon:    '🟠',
    desc:    'Prone sa pagbaha lalo na tuwing malakas ang ulan.',
  },
  MODERATE: {
    color:   '#b7950b',
    fill:    '#f1c40f',
    label:   'Katamtamang Panganib',
    english: 'Moderate Risk',
    icon:    '🟡',
    desc:    'May posibilidad ng pagbaha sa ilang lugar.',
  },
  LOW: {
    color:   '#1e8449',
    fill:    '#27ae60',
    label:   'Mababang Panganib',
    english: 'Low Risk',
    icon:    '🟢',
    desc:    'Mababang panganib ng pagbaha sa lugar na ito.',
  },
};

const FLOOD_RISK_AREAS = [
  { name: 'Concepcion',               level: 'VERY_HIGH', lat: 14.2965, lng: 121.4620, radius: 280 },
  { name: 'Wawa',                     level: 'VERY_HIGH', lat: 14.2935, lng: 121.4580, radius: 300 },
  { name: 'Bagong Silang',            level: 'VERY_HIGH', lat: 14.2950, lng: 121.4645, radius: 250 },
  { name: 'Balimbingan',              level: 'VERY_HIGH', lat: 14.2990, lng: 121.4615, radius: 220 },
  { name: 'Balubad',                  level: 'VERY_HIGH', lat: 14.2975, lng: 121.4590, radius: 200 },
  { name: 'Maracta',                  level: 'VERY_HIGH', lat: 14.3005, lng: 121.4600, radius: 210 },
  { name: 'Primera Pulo',             level: 'VERY_HIGH', lat: 14.2945, lng: 121.4635, radius: 190 },
  { name: 'Salac',                    level: 'VERY_HIGH', lat: 14.2920, lng: 121.4610, radius: 200 },
  { name: 'Segunda Pulo',             level: 'VERY_HIGH', lat: 14.2930, lng: 121.4650, radius: 185 },
  { name: 'Maytalang I',              level: 'HIGH',      lat: 14.2870, lng: 121.4680, radius: 320 },
  { name: 'Primera Parang',           level: 'HIGH',      lat: 14.3020, lng: 121.4580, radius: 240 },
  { name: 'Segunda Parang',           level: 'HIGH',      lat: 14.3035, lng: 121.4565, radius: 220 },
  { name: 'Maytalang II',             level: 'MODERATE',  lat: 14.2840, lng: 121.4710, radius: 300 },
  { name: 'Santo Niño',               level: 'MODERATE',  lat: 14.3010, lng: 121.4555, radius: 210 },
  { name: 'Lewin',                    level: 'MODERATE',  lat: 14.3050, lng: 121.4530, radius: 280 },
  { name: 'Caliraya',                 level: 'LOW',       lat: 14.2680, lng: 121.4820, radius: 400 },
  { name: 'Upland Lewin',             level: 'LOW',       lat: 14.3080, lng: 121.4490, radius: 350 },
];

export function RiskMap({ height = '500px' }) {
  const mapRef = useRef(null);
  const mapObj = useRef(null);

  useEffect(() => {
    if (mapObj.current) return;

    const map = L.map(mapRef.current, { zoomControl: true });
    mapObj.current = map;
    map.setView(LUMBAN_CENTER, 14);

    // Light political-style base tile
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', maxZoom: 19,
    }).addTo(map);

    // Lumban boundary outline from real GeoJSON
    L.geoJSON(lumbanBoundary, {
      style: { color: '#2980b9', weight: 2.5, fillOpacity: 0, dashArray: '5 4' },
      interactive: false,
    }).addTo(map);

    // Draw each barangay zone as a solid political-map polygon
    FLOOD_RISK_AREAS.forEach(area => {
      const cfg = RISK_CONFIG[area.level];

      L.circle([area.lat, area.lng], {
        radius:      area.radius,
        color:       cfg.color,
        fillColor:   cfg.fill,
        fillOpacity: 0.82,
        weight:      2,
      }).addTo(map).bindPopup(`
        <div style="min-width:200px;font-family:sans-serif;padding:4px;">
          <div style="font-weight:800;font-size:15px;color:${cfg.color};margin-bottom:4px;">${area.name}</div>
          <div style="font-size:11px;color:#888;margin-bottom:8px;">Lumban, Laguna</div>
          <span style="background:${cfg.fill};color:#fff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;">
            ${cfg.icon} ${cfg.english}
          </span>
          <div style="margin-top:8px;font-size:11px;color:#555;line-height:1.6;">${cfg.desc}</div>
        </div>
      `);

      // Zone name label — dark text with white glow
      L.marker([area.lat, area.lng], {
        icon: L.divIcon({
          html: `<div style="color:#1a1a2e;font-size:9px;font-weight:800;white-space:nowrap;font-family:sans-serif;pointer-events:none;text-shadow:0 0 3px #fff,0 0 6px #fff,0 0 9px #fff;letter-spacing:0.3px;">${area.name}</div>`,
          className: '',
          iconAnchor: [0, 0],
        }),
        interactive: false,
        zIndexOffset: 200,
      }).addTo(map);
    });

    // Labels on top
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
      attribution: '', maxZoom: 19,
    }).addTo(map);

    // Camera marker
    L.marker(LUMBAN_CENTER, {
      icon: L.divIcon({
        html: `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1d4ed8,#60a5fa);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:14px;">📷</div>`,
        className: '', iconSize: [32, 32], iconAnchor: [16, 16],
      }),
    }).addTo(map).bindPopup(`
      <div style="font-family:sans-serif;padding:4px;">
        <b style="color:#1d4ed8">📷 CAM-LUMBAN-01</b><br/>
        <span style="color:#888;font-size:11px">Lumban Bridge — Active Monitoring</span>
      </div>
    `);

    return () => { map.remove(); mapObj.current = null; };
  }, []);

  return (
    <div style={{ position: 'relative', height }}>
      <div ref={mapRef} style={{ height: '100%', width: '100%', borderRadius: 12 }} />

      {/* Top-left title */}
      <div style={{
        position: 'absolute', top: 14, left: 14, zIndex: 1000,
        background: 'rgba(255,255,255,0.95)', border: '1px solid #c8d8e0',
        borderRadius: 8, padding: '7px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)', fontFamily: 'sans-serif',
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#c0392b', letterSpacing: 0.5 }}>⚠️ FLOOD RISK MAP</div>
        <div style={{ fontSize: 10, color: '#7f8c8d', marginTop: 2 }}>Lumban, Laguna · Click zone for details</div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 24, right: 16, zIndex: 1000,
        background: 'rgba(255,255,255,0.96)', border: '1px solid #c8d8e0',
        borderRadius: 10, padding: '12px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.15)', minWidth: 185,
        fontFamily: 'sans-serif',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#4a6572', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1.2 }}>
          Flood Risk Level
        </div>
        {Object.entries(RISK_CONFIG).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 18, height: 14, borderRadius: 3, flexShrink: 0, background: cfg.fill, border: `1.5px solid ${cfg.color}` }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#2c3e50', lineHeight: 1.3 }}>{cfg.icon} {cfg.english}</div>
              <div style={{ fontSize: 9.5, color: '#7f8c8d', lineHeight: 1.3 }}>{cfg.label}</div>
            </div>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #dde', marginTop: 6, paddingTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 18, height: 14, borderRadius: 3, background: 'linear-gradient(135deg,#1d4ed8,#60a5fa)', border: '1.5px solid #1d4ed8', flexShrink: 0 }} />
          <div style={{ fontSize: 10, color: '#2c3e50', fontWeight: 600 }}>📷 Camera</div>
        </div>
      </div>
    </div>
  );
}
