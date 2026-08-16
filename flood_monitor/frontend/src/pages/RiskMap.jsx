import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getRiskAreas, createRiskArea, updateRiskArea, deleteRiskArea } from '../api/risk';
import { Modal } from '../components/ui/Modal';
import { Card } from '../components/ui/Card';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import lumbanBoundary from '../data/ADM4 Lumban.geojson';

const LUMBAN_CENTER = [14.291969, 121.460112];

const RISK_CONFIG = {
  VERY_HIGH: { color: '#b91c1c', fill: '#ef4444', label: 'Very High Risk', tagalog: 'Napakataas na Panganib', icon: '🔴', desc: 'Mataas na tsansa ng pagbaha. Maaring kailangang mag-evacuate.', bg: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',    text: 'text-red-800 dark:text-red-300'    },
  HIGH:      { color: '#c2410c', fill: '#f97316', label: 'High Risk',      tagalog: 'Mataas na Panganib',     icon: '🟠', desc: 'Prone sa pagbaha lalo na tuwing malakas ang ulan.',          bg: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800', text: 'text-orange-800 dark:text-orange-300' },
  MODERATE:  { color: '#a16207', fill: '#eab308', label: 'Moderate Risk',  tagalog: 'Katamtamang Panganib',   icon: '🟡', desc: 'May posibilidad ng pagbaha sa ilang lugar.',                 bg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800', text: 'text-amber-800 dark:text-yellow-300' },
  LOW:       { color: '#15803d', fill: '#22c55e', label: 'Low Risk',       tagalog: 'Mababang Panganib',      icon: '🟢', desc: 'Mababang panganib ng pagbaha sa lugar na ito.',              bg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-green-900/40  dark:text-green-300 dark:border-green-800',  text: 'text-emerald-800 dark:text-green-300'  },
};

const EMPTY = { name: '', risk_level: 'MODERATE', lat: '', lng: '', radius: '250', note: '' };

function RiskGeoJSON({ areas, boundary }) {
  const riskMap = {};
  areas.forEach(a => { riskMap[a.name] = a; });

  const findArea = (adm4en) => riskMap[adm4en] || null;

  const styleFeature = (feature) => {
    const area = findArea(feature.properties.ADM4_EN);
    if (area) {
      const cfg = RISK_CONFIG[area.risk_level] || RISK_CONFIG.MODERATE;
      return { color: cfg.color, weight: 2, fillColor: cfg.fill, fillOpacity: 0.5 };
    }
    return { color: '#2980b9', weight: 2.5, fillColor: 'transparent', fillOpacity: 0, dashArray: '5 4' };
  };

  const onEachFeature = (feature, layer) => {
    const area = findArea(feature.properties.ADM4_EN);
    if (!area) return;
    const cfg = RISK_CONFIG[area.risk_level] || RISK_CONFIG.MODERATE;
    layer.bindPopup(`
      <div style="min-width:200px;font-family:sans-serif;padding:4px">
        <div style="font-weight:800;font-size:15px;color:${cfg.color};margin-bottom:4px">${area.name}</div>
        <div style="font-size:11px;color:#888;margin-bottom:8px">Lumban, Laguna</div>
        <span style="background:${cfg.fill};color:#fff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700">${cfg.icon} ${cfg.label}</span>
        <div style="margin-top:8px;font-size:11px;color:#555;line-height:1.6">${cfg.desc}</div>
        ${area.note ? `<div style="margin-top:6px;font-size:11px;color:#888">${area.note}</div>` : ''}
      </div>
    `);
  };

  return (
    <>
      <GeoJSON key={areas.map(a => `${a.id}-${a.risk_level}`).join()} data={boundary} style={styleFeature} onEachFeature={onEachFeature} />
      {Object.entries(BRGY_CENTERS).map(([name, pos]) => {
        const area = riskMap[name] || null;
        const cfg = area ? RISK_CONFIG[area.risk_level] : null;
        return (
          <Marker key={name} position={pos} interactive={false}
            icon={L.divIcon({
              className: '',
              iconAnchor: [0, 0],
              html: `<div style="
                font-family:sans-serif;
                pointer-events:none;
                text-align:center;
                transform:translate(-50%,-50%);
                white-space:nowrap;
              ">
                <div style="
                  font-size:10px;
                  font-weight:700;
                  color:#1a1a2e;
                  text-shadow:0 0 3px #fff,0 0 6px #fff,0 0 10px #fff;
                  line-height:1.3;
                ">${name}</div>
                ${cfg ? `<div style="
                  font-size:9px;
                  font-weight:600;
                  color:${cfg.color};
                  text-shadow:0 0 3px #fff,0 0 6px #fff;
                  line-height:1.2;
                ">${cfg.icon} ${cfg.label}</div>` : ''}
              </div>`,
            })}
          />
        );
      })}
    </>
  );
}

function Legend() {
  return (
    <div style={{
      position: 'absolute', bottom: 20, right: 12, zIndex: 1000,
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
          <div style={{ width: 18, height: 14, borderRadius: 3, flexShrink: 0, background: cfg.fill, opacity: 0.55, border: `1.5px solid ${cfg.color}` }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2c3e50', lineHeight: 1.3 }}>{cfg.label}</div>
            <div style={{ fontSize: 9.5, color: '#7f8c8d', lineHeight: 1.3 }}>{cfg.tagalog}</div>
          </div>
        </div>
      ))}
      <div style={{ borderTop: '1px solid #dde', marginTop: 6, paddingTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 18, height: 14, borderRadius: 3, background: 'linear-gradient(135deg,#1d4ed8,#60a5fa)', border: '1.5px solid #1d4ed8', flexShrink: 0 }} />
        <div style={{ fontSize: 10, color: '#2c3e50', fontWeight: 600 }}>📷 Camera</div>
      </div>
    </div>
  );
}

const BRGY_CENTERS = {
  'Bagong Silang':          [14.2951, 121.4648],
  'Balimbingan (Pob.)':     [14.3002, 121.4603],
  'Balubad':                [14.2766, 121.4779],
  'Caliraya':               [14.2968, 121.5562],
  'Concepcion':             [14.2986, 121.4540],
  'Lewin':                  [14.3025, 121.5155],
  'Maracta (Pob.)':         [14.2985, 121.4597],
  'Maytalang I':            [14.2884, 121.4583],
  'Maytalang II':           [14.2968, 121.4345],
  'Primera Parang (Pob.)':  [14.2924, 121.4613],
  'Primera Pulo (Pob.)':    [14.3013, 121.4601],
  'Salac (Pob.)':           [14.2954, 121.4607],
  'Segunda Parang (Pob.)':  [14.2942, 121.4607],
  'Segunda Pulo (Pob.)':    [14.3031, 121.4607],
  'Santo Niño (Pob.)':      [14.2969, 121.4597],
  'Wawa':                   [14.3281, 121.4418],
};

const BARANGAY_NAMES = Object.keys(BRGY_CENTERS);

const inputCls = 'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500 shadow-sm';
const labelCls = 'text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1';

function FieldInput({ label, children }) {
  return <div><span className={labelCls}>{label}</span>{children}</div>;
}

function FormFields({ form, setForm }) {
  return (
    <div className="space-y-3">
      <FieldInput label="Barangay *">
        <select className={inputCls} value={form.name} onChange={e => {
          const name = e.target.value;
          const center = BRGY_CENTERS[name];
          setForm(f => ({ ...f, name, lat: center ? String(center[0]) : f.lat, lng: center ? String(center[1]) : f.lng }));
        }}>
          <option value="">— Select Barangay —</option>
          {BARANGAY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </FieldInput>
      <FieldInput label="Risk Level *">
        <select className={inputCls} value={form.risk_level} onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))}>
          <option value="VERY_HIGH">🔴 Very High Risk</option>
          <option value="HIGH">🟠 High Risk</option>
          <option value="MODERATE">🟡 Moderate Risk</option>
          <option value="LOW">🟢 Low Risk</option>
        </select>
      </FieldInput>
      <FieldInput label="Notes (optional)">
        <textarea className={`${inputCls} resize-none`} rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Additional description..." />
      </FieldInput>
    </div>
  );
}

export default function RiskMapPage() {
  const { user } = useAuthStore();
  const qc       = useQueryClient();
  const isAdmin  = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [showAdd,  setShowAdd]  = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [viewTab,  setViewTab]  = useState('map');

  const { data: areas = [] } = useQuery({ queryKey: ['risk-areas'], queryFn: getRiskAreas });

  const create = useMutation({
    mutationFn: createRiskArea,
    onSuccess: () => { toast.success('Risk area added'); qc.invalidateQueries(['risk-areas']); setShowAdd(false); setForm(EMPTY); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add'),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => updateRiskArea(id, data),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries(['risk-areas']); setShowEdit(false); },
    onError: () => toast.error('Update failed'),
  });

  const remove = useMutation({
    mutationFn: deleteRiskArea,
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries(['risk-areas']); },
  });

  const handleCreate = () => {
    if (!form.name || !form.lat || !form.lng) { toast.error('Name, lat, and lng are required'); return; }
    create.mutate({ name: form.name, risk_level: form.risk_level, lat: parseFloat(form.lat), lng: parseFloat(form.lng), radius: parseInt(form.radius || '250'), note: form.note || null });
  };

  const handleUpdate = () => {
    update.mutate({ id: editItem.id, data: { name: form.name, risk_level: form.risk_level, lat: parseFloat(form.lat), lng: parseFloat(form.lng), radius: parseInt(form.radius || '250'), note: form.note || null } });
  };

  const openEdit = (area) => {
    setEditItem(area);
    setForm({ name: area.name, risk_level: area.risk_level, lat: String(area.lat), lng: String(area.lng), radius: String(area.radius), note: area.note || '' });
    setShowEdit(true);
  };

  const grouped = areas.reduce((acc, a) => { if (!acc[a.risk_level]) acc[a.risk_level] = []; acc[a.risk_level].push(a); return acc; }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Flood Risk Map</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Lumban, Laguna — {areas.length} areas classified</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden p-0.5">
            {['map', 'list'].map(tab => (
              <button key={tab} onClick={() => setViewTab(tab)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors ${viewTab === tab ? 'bg-red-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}>
                {tab === 'map' ? '🗺 Map' : '📋 List'}
              </button>
            ))}
          </div>
          {isAdmin && (
            <button onClick={() => { setForm(EMPTY); setShowAdd(true); }}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
              <Plus size={16} /> Add Area
            </button>
          )}
        </div>
      </div>

      {/* Map Tab */}
      {viewTab === 'map' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-900 dark:text-white">⚠️ Interactive Risk Zone Map</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Click a zone for details</span>
          </div>
          <div style={{ position: 'relative', height: 520 }}>
            <MapContainer center={LUMBAN_CENTER} zoom={12} style={{ height: '100%', width: '100%', background: '#b8d4e8' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                attribution="&copy; OpenStreetMap &copy; CARTO"
              />
              <RiskGeoJSON areas={areas} boundary={lumbanBoundary} />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                attribution=""
              />

              <Marker position={[14.291969, 121.460112]}
                icon={L.divIcon({
                  html: `<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#1d4ed8,#60a5fa);border:2px solid white;box-shadow:0 0 20px rgba(59,130,246,0.9),0 0 40px rgba(59,130,246,0.4);display:flex;align-items:center;justify-content:center;font-size:14px;">📷</div>`,
                  className: '', iconSize: [34, 34], iconAnchor: [17, 17],
                })}>
                <Popup>
                  <div style={{ background: '#0f172a', color: '#e2e8f0', padding: 10, borderRadius: 10, borderLeft: '4px solid #3b82f6' }}>
                    <strong style={{ color: '#60a5fa' }}>📷 CAM-LUMBAN-01</strong><br />
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>Lumban Bridge — Active Monitoring</span>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
            <Legend />
          </div>
        </div>
      )}

      {/* List Tab */}
      {viewTab === 'list' && (
        <div className="space-y-4">
          {Object.entries(RISK_CONFIG).map(([level, cfg]) => {
            const levelAreas = grouped[level] || [];
            if (!levelAreas.length) return null;
            return (
              <Card key={level}>
                <div className="flex items-center gap-3 mb-4">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${cfg.bg}`}>
                    {cfg.icon} {cfg.label}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{cfg.tagalog}</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-auto">{levelAreas.length} areas</span>
                </div>
                <div className="space-y-2">
                  {levelAreas.map(area => (
                    <div key={area.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}88` }} />
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{area.name}</span>
                        </div>
                        {area.note && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 ml-5 truncate font-medium">{area.note}</p>}
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-5 font-mono">📍 {area.lat.toFixed(4)}, {area.lng.toFixed(4)} · r={area.radius}m</p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <button onClick={() => openEdit(area)} className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => window.confirm(`Delete "${area.name}"?`) && remove.mutate(area.id)} className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-3">Data Source</h3>
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
          Risk classifications are based on the Climate and Disaster Risk Assessment (CDRA) included in the Local Disaster Risk Reduction and Management Plan (LDRRMP) of Lumban, Laguna.
        </p>
      </Card>

      {/* Add Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Flood Risk Area">
        <div className="space-y-4">
          <FormFields form={form} setForm={setForm} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-bold py-2.5 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={create.isPending} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl shadow-sm">
              {create.isPending ? 'Adding...' : 'Add Area'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Flood Risk Area">
        <div className="space-y-4">
          <FormFields form={form} setForm={setForm} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowEdit(false)} className="flex-1 bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-bold py-2.5 rounded-xl transition-colors">Cancel</button>
            <button onClick={handleUpdate} disabled={update.isPending} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl shadow-sm">
              {update.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
