import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, Minimize2 } from 'lucide-react';
import { formatDateTime } from '../../utils/floodUtils';
import lumbanBoundary from '../../data/lumban-border.geojson';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function MapResizeController({ isFullScreen }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isFullScreen, map]);
  return null;
}

const BASEMAPS = {
  streets: {
    id: 'streets',
    name: 'Street',
    icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    labelsUrl: null,
    attribution: '&copy; OpenStreetMap contributors',
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &copy; OpenStreetMap',
  },
  topo: {
    id: 'topo',
    name: 'Topographic',
    icon: '⛰️',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    labelsUrl: null,
    attribution: '&copy; OpenTopoMap &copy; OpenStreetMap',
  },
  dark: {
    id: 'dark',
    name: 'Dark',
    icon: '🌙',
    url: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap',
  },
};

const ROLE_CFG = {
  PNP: { color: '#1e40af', emoji: '👮', label: 'PNP' },
  BFP: { color: '#f97316', emoji: '🚒', label: 'BFP' },
  COAST_GUARD: { color: '#0284c7', emoji: '⚓', label: 'Coast Guard' },
  RHU: { color: '#16a34a', emoji: '🏥', label: 'RHU' },
  MDRRMO: { color: '#dc2626', emoji: '🚨', label: 'MDRRMO Official' },
  MDRRMO_RESPONDER: { color: '#dc2626', emoji: '🚨', label: 'MDRRMO Official' },
  BARANGAY_OFFICIAL: { color: '#6b21a8', emoji: '🏛', label: 'Barangay' },
  RESCUE: { color: '#38bdf8', emoji: '⛑', label: 'Rescue' },
};

function responderIcon(role, status) {
  const cfg = ROLE_CFG[role] || { color: '#64748b', emoji: '👤', label: role };
  const borderColor = status === 'DISPATCHED' ? '#f59e0b' : '#ffffff';
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${cfg.color};border:3px solid ${borderColor};box-shadow:0 0 0 3px ${cfg.color}55,0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:16px;">${cfg.emoji}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function getSosIcon(status) {
  let color = '#ef4444'; // default red
  if (status === 'DISPATCHED') color = '#f59e0b'; // amber
  if (status === 'RESPONDING') color = '#3b82f6'; // blue
  if (status === 'RESOLVED') color = '#10b981'; // green

  return L.divIcon({
    html: `
      <div style="position:relative;width:48px;height:48px;">
        <div style="
          position:absolute;top:0;left:0;
          width:48px;height:48px;border-radius:50%;
          background:${color}55;
          animation:sosPulse 1.2s ease-out infinite;
        "></div>
        <div style="
          position:absolute;top:8px;left:8px;
          width:32px;height:32px;border-radius:50%;
          background:${color}88;
        "></div>
        <div style="
          position:absolute;top:14px;left:14px;
          width:20px;height:20px;border-radius:50%;
          background:${color};
          border:3px solid #fff;
          box-shadow:0 0 10px ${color};
        "></div>
      </div>`,
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

const CAMERA_ICON = L.divIcon({
  html: `<div style="
    width:22px;height:22px;border-radius:50%;
    background:#3b82f6;border:3px solid white;
    box-shadow:0 0 0 4px rgba(59,130,246,0.4);
    display:flex;align-items:center;justify-content:center;
    font-size:10px;color:white;
  ">📷</div>`,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  });

const LUMBAN_CENTER = [14.291969, 121.460112];

export function RescueMap({ sosList = [], evacuationCenters = [], responders = [], onRespond, onComplete }) {
  const [basemap, setBasemap] = useState('streets');
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Compute vector lines for dispatched responders to SOS location
  const vectorLines = [];
  sosList.forEach(sos => {
    if (['DISPATCHED', 'RESPONDING'].includes(sos.status) && sos.dispatched_responders) {
      sos.dispatched_responders.forEach(dr => {
        const responder = responders.find(r => r.id === dr.responder_id);
        if (responder && responder.last_lat && responder.last_lng) {
          const isBackup = dr.dispatch_type === 'BACKUP';
          vectorLines.push({
            id: `${sos.id}-${responder.id}`,
            positions: [
              [responder.last_lat, responder.last_lng],
              [sos.lat, sos.lng]
            ],
            color: isBackup ? '#f59e0b' : '#dc2626',
            dashArray: isBackup ? '8 8' : '12 12',
            weight: isBackup ? 4 : 5
          });
        }
      });
    }
  });

  return (
    <div className={`relative w-full overflow-hidden shadow-lg border border-slate-200 dark:border-slate-700 transition-all ${
      isFullScreen ? 'fixed inset-0 z-[5000] w-screen h-screen rounded-none bg-slate-950' : 'rounded-2xl'
    }`}>
      {/* Fullscreen Mode Top Status Indicator */}
      {isFullScreen && (
        <div className="absolute top-3 left-3 z-[1100] flex items-center gap-2 bg-slate-900/90 text-white px-3.5 py-1.5 rounded-xl border border-slate-700/80 shadow-2xl backdrop-blur-md">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-black uppercase tracking-wider text-slate-100">Fullscreen Rescue Map</span>
          <button
            onClick={() => {
              setIsFullScreen(false);
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            }}
            className="ml-2 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-all flex items-center gap-1 shadow-sm active:scale-95">
            <Minimize2 size={12} /> Exit (Esc)
          </button>
        </div>
      )}

      {/* Floating Basemap Switcher & Fullscreen Button */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 p-1 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700/80 backdrop-blur-md">
        <button
          onClick={() => {
            const next = !isFullScreen;
            setIsFullScreen(next);
            try {
              if (next && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else if (!next && document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              }
            } catch {}
          }}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
            isFullScreen
              ? 'bg-red-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title="Toggle Fullscreen Map View (Entire Monitor)"
        >
          {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span>{isFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

        {Object.values(BASEMAPS).map(bm => (
          <button
            key={bm.id}
            onClick={() => setBasemap(bm.id)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
              basemap === bm.id
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>{bm.icon}</span>
            <span className="hidden sm:inline">{bm.name}</span>
          </button>
        ))}
      </div>

      <MapContainer
        center={LUMBAN_CENTER}
        zoom={14}
        style={{ height: isFullScreen ? '100%' : '490px', width: '100%', background: '#09101d' }}
      >
        <MapResizeController isFullScreen={isFullScreen} />
        <TileLayer
          key={basemap}
          url={BASEMAPS[basemap].url}
          attribution={BASEMAPS[basemap].attribution}
          maxZoom={19}
        />

        {BASEMAPS[basemap].labelsUrl && (
          <TileLayer url={BASEMAPS[basemap].labelsUrl} maxZoom={19} />
        )}

        <GeoJSON
          key="lumban-border"
          data={lumbanBoundary}
          style={{ color: '#ef4444', weight: 2, fillOpacity: 0, dashArray: '6 3' }}
          interactive={false}
        />

        <Marker position={[14.291969, 121.460112]} icon={CAMERA_ICON}>
          <Popup>
            <div style={{ fontSize: '13px' }}>
              <strong>📷 CAM-LUMBAN-01</strong><br />
              Lumban Bridge<br />
              Pagsanjan–Lumban River<br />
              <span style={{ color: '#16a34a', fontWeight: 'bold' }}>● Active Monitoring</span>
            </div>
          </Popup>
        </Marker>

        {/* Vector connecting lines for active operations */}
        {vectorLines.map(line => (
          <Polyline
            key={line.id}
            positions={line.positions}
            pathOptions={{ color: line.color, weight: line.weight, dashArray: line.dashArray, opacity: 0.9 }}
          />
        ))}

        {evacuationCenters.map(center => (
          <Marker
            key={center.id}
            position={[center.lat, center.lng]}
            icon={L.divIcon({
              html: `<div style="
                width:28px;height:28px;border-radius:6px;
                background:${center.is_open ? '#22c55e' : '#6b7280'};
                border:2px solid white;
                box-shadow:0 2px 8px rgba(0,0,0,0.3);
                display:flex;align-items:center;justify-content:center;
                font-size:14px;
              ">🏠</div>`,
              className: '',
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            })}
          >
            <Popup>
              <div style={{ minWidth: '180px', fontSize: '13px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                  🏠 {center.name}
                </div>
                <div style={{ color: '#666', marginBottom: '2px' }}>
                  Barangay: {center.barangay_name || center.barangay || '--'}
                </div>
                <div style={{ marginBottom: '2px' }}>
                  Capacity: {center.capacity_current} / {center.capacity_total}
                </div>
                <div style={{ marginBottom: '4px' }}>
                  Contact: {center.contact_person || '--'}
                </div>
                <div style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  background: center.is_open ? '#dcfce7' : '#f3f4f6',
                  color: center.is_open ? '#16a34a' : '#6b7280',
                }}>
                  {center.is_open ? '✓ OPEN' : '✗ CLOSED'}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {sosList.map(sos => (
          <Marker key={sos.id} position={[sos.lat, sos.lng]} icon={getSosIcon(sos.status)}>
            <Popup>
              <div style={{ minWidth: '200px', fontSize: '13px' }}>
                <div style={{ fontWeight: 'bold', color: sos.status === 'PENDING' ? '#dc2626' : '#2563eb', marginBottom: '4px' }}>
                  🆘 SOS Rescue Request
                </div>
                <div><strong>Status:</strong> {sos.status === 'PENDING' ? 'Pending MDRRMO Dispatch' : sos.status}</div>
                <div><strong>Victim:</strong> {sos.citizen_name || 'Unknown'}</div>
                <div><strong>Phone:</strong> {sos.citizen_phone || '--'}</div>
                <div><strong>Barangay:</strong> {sos.barangay_name || '--'}</div>
                <div><strong>Submitted:</strong> {formatDateTime(sos.created_at)}</div>
                {sos.message && <div style={{ fontStyle: 'italic', marginTop: '4px' }}>"{sos.message}"</div>}

                <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
                  {['PENDING', 'DISPATCHED'].includes(sos.status) && (
                    <button
                      onClick={() => onRespond?.(sos.id)}
                      style={{
                        background: '#dc2626', color: 'white',
                        border: 'none', borderRadius: '6px',
                        padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold'
                      }}>
                      Dispatch Responder
                    </button>
                  )}
                  {sos.status === 'RESPONDING' && (
                    <button
                      onClick={() => onComplete?.(sos.id)}
                      style={{
                        background: '#16a34a', color: 'white',
                        border: 'none', borderRadius: '6px',
                        padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold'
                      }}>
                      ✓ Rescue Completed
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {responders.map(r => {
          const cfg = ROLE_CFG[r.role] || { color: '#64748b', label: r.role };
          if (!r.last_lat || !r.last_lng) return null;

          return (
            <Marker
              key={`${r.id}-${r.last_lat}-${r.last_lng}`}
              position={[r.last_lat, r.last_lng]}
              icon={responderIcon(r.role, r.responder_status)}>
            <Popup>
              <div style={{ minWidth: '170px', fontSize: '13px', lineHeight: '1.6' }}>
                <div style={{ fontWeight: 'bold', color: cfg.color, marginBottom: '2px' }}>
                  {r.full_name}
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ background: cfg.color + '22', color: cfg.color, padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 'bold', border: `1px solid ${cfg.color}` }}>
                    {cfg.label}
                  </span>
                  <span style={{ background: r.responder_status === 'OFF_DUTY' ? '#f3f4f6' : '#dcfce7', color: r.responder_status === 'OFF_DUTY' ? '#6b7280' : '#16a34a', padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 'bold' }}>
                    {r.responder_status || 'AVAILABLE'}
                  </span>
                </div>
                {r.phone_number && <div>📞 {r.phone_number}</div>}
                <div style={{ color: '#888', fontSize: '11px', marginTop: '4px' }}>
                  Last ping: {r.last_location_at ? new Date(r.last_location_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : 'Online'}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
      </MapContainer>
    </div>
  );
}
