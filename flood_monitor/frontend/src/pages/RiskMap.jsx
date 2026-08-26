import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getRiskAreas, createRiskArea, updateRiskArea, deleteRiskArea } from '../api/risk';
import { useRainRadar } from '../hooks/useRainRadar';
import { Modal } from '../components/ui/Modal';
import { Card } from '../components/ui/Card';
import toast from 'react-hot-toast';
import {
  Plus, Edit2, Trash2, Layers, Search, Compass,
  Maximize2, Minimize2, RotateCcw, ShieldAlert,
  Waves, Route, Sliders, ChevronDown,
  ChevronUp, X, Filter, Info, Navigation, Shield,
  CloudRain
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

// Datasets
import lumbanBoundary from '../data/ADM4 Lumban.geojson';
import lumbanBorder from '../data/lumban-border.geojson';
import lumbanFlood from '../data/Lumban Flood/Lumban Flood.geojson';
import lumbanRoads from '../data/Road/Lumban Roads.geojson';

const LUMBAN_CENTER = [14.291969, 121.460112];
const DEFAULT_ZOOM = 13;

const createBarangayBeaconIcon = (area) => {
  const cfg = area ? (RISK_CONFIG[area.risk_level] || RISK_CONFIG.MODERATE) : RISK_CONFIG.MODERATE;
  const isHigh = area?.risk_level === 'VERY_HIGH' || area?.risk_level === 'HIGH';

  return L.divIcon({
    className: 'custom-brgy-beacon',
    html: `
      <div style="position:relative; width:26px; height:26px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
        ${isHigh ? `
          <div style="
            position:absolute; inset:-4px; border-radius:50%;
            background:${cfg.fill}; opacity:0.4;
            animation:ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
        ` : ''}
        <div style="
          width:20px; height:20px; border-radius:50%;
          background:${cfg.fill};
          border:2px solid #ffffff;
          box-shadow:0 0 0 2px ${cfg.color}88, 0 3px 8px rgba(0,0,0,0.5);
          display:flex; align-items:center; justify-content:center;
          color:#ffffff; font-size:10px; font-weight:900;
        ">
          ${cfg.icon}
        </div>
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
};

// -------------------------------------------------------------
// CONFIGURATIONS
// -------------------------------------------------------------

export const RISK_CONFIG = {
  VERY_HIGH: {
    color: '#b91c1c', fill: '#ef4444', label: 'Very High Risk', tagalog: 'Napakataas na Panganib',
    icon: '🔴', desc: 'Mataas na tsansa ng pagbaha. Maaring kailangang mag-evacuate.',
    bg: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
    text: 'text-red-800 dark:text-red-300',
  },
  HIGH: {
    color: '#c2410c', fill: '#f97316', label: 'High Risk', tagalog: 'Mataas na Panganib',
    icon: '🟠', desc: 'Prone sa pagbaha lalo na tuwing malakas ang ulan.',
    bg: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800',
    text: 'text-orange-800 dark:text-orange-300',
  },
  MODERATE: {
    color: '#a16207', fill: '#eab308', label: 'Moderate Risk', tagalog: 'Katamtamang Panganib',
    icon: '🟡', desc: 'May posibilidad ng pagbaha sa ilang lugar.',
    bg: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800',
    text: 'text-amber-800 dark:text-yellow-300',
  },
  LOW: {
    color: '#15803d', fill: '#22c55e', label: 'Low Risk', tagalog: 'Mababang Panganib',
    icon: '🟢', desc: 'Mababang panganib ng pagbaha sa lugar na ito.',
    bg: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
    text: 'text-emerald-800 dark:text-green-300',
  },
};

export const FLOOD_HAZARD_CONFIG = {
  3: {
    levelKey: 'high',
    label: 'High Flood Hazard',
    tagalog: 'Mataas na Hazard (Lagpas-tao)',
    depth: '> 1.5 meters',
    depthDesc: 'Deep & rapid inundation (>1.5m)',
    color: '#991b1b',
    fill: '#dc2626',
    icon: '🔴',
    badge: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300',
    advisory: 'Critical flood zone. High risk to life and structures. Urgent evacuation advised.',
  },
  2: {
    levelKey: 'moderate',
    label: 'Moderate Flood Hazard',
    tagalog: 'Katamtamang Hazard (Tuhod–Baywang)',
    depth: '0.5m – 1.5m',
    depthDesc: 'Medium depth (0.5m – 1.5m)',
    color: '#ea580c',
    fill: '#f97316',
    icon: '🟠',
    badge: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300',
    advisory: 'Moderate hazard. Impassable to light vehicles. Prepare emergency kit & monitor alerts.',
  },
  1: {
    levelKey: 'low',
    label: 'Low Flood Hazard',
    tagalog: 'Mababang Hazard (Bukong-bukong)',
    depth: '0.1m – 0.5m',
    depthDesc: 'Shallow floodwater (0.1m – 0.5m)',
    color: '#ca8a04',
    fill: '#facc15',
    icon: '🟡',
    badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-yellow-950/60 dark:text-yellow-300',
    advisory: 'Low hazard. Localized ankle-deep pooling. Be vigilant during continuous heavy rain.',
  },
};

export const ROAD_CLASS_CONFIG = {
  'National Road': {
    color: '#dc2626',
    weight: 3.5,
    tagalog: 'Pambansang Daanan',
    desc: 'Pangunahing ruta para sa relief at emergency vehicles.',
  },
  'Provincial Road': {
    color: '#f59e0b',
    weight: 2.5,
    tagalog: 'Panlalawigang Daanan',
    desc: 'Pangunahing koneksyon sa pagitan ng mga bayan.',
  },
  'Municipal Road': {
    color: '#3b82f6',
    weight: 2.0,
    tagalog: 'Munisipal na Daanan',
    desc: 'Lokal na daanan sa loob ng kabayanan ng Lumban.',
  },
  'Barangay Road': {
    color: '#10b981',
    weight: 1.5,
    tagalog: 'Barangay Road',
    desc: 'Panloob na kalsada sa bawat barangay.',
  },
  'Other': {
    color: '#94a3b8',
    weight: 1.2,
    tagalog: 'Iba pang Daanan',
    desc: 'Alley, pathway, o unclassified street.',
  },
};

export const BASEMAPS = {
  dark: {
    id: 'dark',
    name: 'Dark Tactical',
    icon: '🌙',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    labelsUrl: null,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxNativeZoom: 19,
  },
  streets: {
    id: 'streets',
    name: 'Voyager Light',
    icon: '🗺️',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    labelsUrl: null,
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxNativeZoom: 19,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite HD',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    labelsUrl: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; Esri &copy; OpenStreetMap',
    maxNativeZoom: 19,
  },
  topo: {
    id: 'topo',
    name: 'Terrain Elevation',
    icon: '⛰️',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    labelsUrl: null,
    attribution: '&copy; OpenTopoMap &copy; OpenStreetMap',
    maxNativeZoom: 17,
  },
};

export const BRGY_CENTERS = {
  'Bagong Silang':         [14.2951, 121.4648],
  'Balimbingan (Pob.)':    [14.3002, 121.4603],
  'Balubad':               [14.2766, 121.4779],
  'Caliraya':              [14.2968, 121.5562],
  'Concepcion':            [14.2986, 121.4540],
  'Lewin':                 [14.3025, 121.5155],
  'Maracta (Pob.)':        [14.2985, 121.4597],
  'Maytalang I':           [14.2884, 121.4583],
  'Maytalang II':          [14.2968, 121.4345],
  'Primera Parang (Pob.)': [14.2924, 121.4613],
  'Primera Pulo (Pob.)':   [14.3013, 121.4601],
  'Salac (Pob.)':          [14.2954, 121.4607],
  'Segunda Parang (Pob.)': [14.2942, 121.4607],
  'Segunda Pulo (Pob.)':   [14.3031, 121.4607],
  'Santo Niño (Pob.)':     [14.2969, 121.4597],
  'Wawa':                  [14.3281, 121.4418],
};

const BARANGAY_NAMES = Object.keys(BRGY_CENTERS);

function cleanName(n) {
  return (n || '').replace(/\s*\(.*?\)/g, '').trim().toLowerCase();
}

// -------------------------------------------------------------
// MAP CONTROLLER (Fly-To & Bounds & Fullscreen Resize Helper)
// -------------------------------------------------------------
function MapController({ targetCenter, targetZoom, isFullScreen }) {
  const map = useMap();

  useEffect(() => {
    if (targetCenter) {
      map.flyTo(targetCenter, targetZoom || 15, { duration: 1.2 });
    }
  }, [targetCenter, targetZoom, map]);

  useEffect(() => {
    const handleResize = () => {
      map.invalidateSize();
    };

    handleResize();
    const t1 = setTimeout(handleResize, 100);
    const t2 = setTimeout(handleResize, 350);

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', handleResize);
    };
  }, [isFullScreen, map]);

  return null;
}

// -------------------------------------------------------------
// COMPONENT: MAIN PAGE
// -------------------------------------------------------------
export default function RiskMapPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  // Tab & View States
  const [viewTab, setViewTab] = useState('map');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [targetView, setTargetView] = useState(null);

  // Layer Visibility Toggles (Risk & Hazard Map Layers)
  const [layerVisibility, setLayerVisibility] = useState({
    municipalBorder: true,
    riskMap: true,
    riskLabels: true,
    floodMap: true,
    roads: true,
    rainRadar: false,
  });

  // Layer Sub-Filters
  const [riskFilters, setRiskFilters] = useState({
    VERY_HIGH: true,
    HIGH: true,
    MODERATE: true,
    LOW: true,
  });

  const [floodFilters, setFloodFilters] = useState({
    3: true, // High
    2: true, // Moderate
    1: true, // Low
  });

  const [roadFilters, setRoadFilters] = useState({
    'National Road': true,
    'Provincial Road': true,
    'Municipal Road': true,
    'Barangay Road': true,
    'Other': true,
  });

  // Layer Opacities
  const [riskOpacity, setRiskOpacity] = useState(0.5);
  const [floodOpacity, setFloodOpacity] = useState(0.65);
  const [radarOpacity, setRadarOpacity] = useState(0.7);
  const [basemap, setBasemap] = useState('dark');

  // Escape key handler to exit Fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullScreen]);

  // Modal / Form States
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', risk_level: 'MODERATE', lat: '', lng: '', radius: '250', note: '' });

  // Data Queries
  const { data: areas = [] } = useQuery({ queryKey: ['risk-areas'], queryFn: getRiskAreas });
  const { tileUrl: radarTileUrl, radarTimestamp, lastUpdated: radarUpdated, loading: radarLoading } = useRainRadar(layerVisibility.rainRadar);

  // Mutations
  const create = useMutation({
    mutationFn: createRiskArea,
    onSuccess: () => { toast.success('Risk area added'); qc.invalidateQueries(['risk-areas']); setShowAdd(false); setForm({ name: '', risk_level: 'MODERATE', lat: '', lng: '', radius: '250', note: '' }); },
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

  // Area Lookup Map
  const riskMapByName = useMemo(() => {
    const map = {};
    areas.forEach(a => {
      map[cleanName(a.name)] = a;
      map[a.name] = a;
    });
    return map;
  }, [areas]);

  // Filtered Datasets
  const filteredRiskGeoJSON = useMemo(() => {
    if (!layerVisibility.riskMap) return null;
    const filteredFeatures = lumbanBoundary.features.filter(f => {
      const name = f.properties.ADM4_EN;
      const area = riskMapByName[cleanName(name)] || riskMapByName[name];
      const level = area ? area.risk_level : 'MODERATE';
      return riskFilters[level];
    });
    return { ...lumbanBoundary, features: filteredFeatures };
  }, [layerVisibility.riskMap, riskFilters, riskMapByName]);

  const filteredFloodGeoJSON = useMemo(() => {
    if (!layerVisibility.floodMap) return null;
    const filteredFeatures = lumbanFlood.features.filter(f => floodFilters[f.properties.Var]);
    return { ...lumbanFlood, features: filteredFeatures };
  }, [layerVisibility.floodMap, floodFilters]);

  const filteredRoadsGeoJSON = useMemo(() => {
    if (!layerVisibility.roads) return null;
    const filteredFeatures = lumbanRoads.features.filter(f => {
      const cls = f.properties.Road_Class || 'Other';
      return roadFilters[cls];
    });
    return { ...lumbanRoads, features: filteredFeatures };
  }, [layerVisibility.roads, roadFilters]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results = [];

    // Search Barangays
    BARANGAY_NAMES.forEach(name => {
      if (name.toLowerCase().includes(q)) {
        const area = riskMapByName[cleanName(name)] || riskMapByName[name];
        results.push({
          type: 'barangay',
          title: name,
          subtitle: `Barangay • ${area?.risk_level ? RISK_CONFIG[area.risk_level]?.label : 'Classified Zone'}`,
          coords: BRGY_CENTERS[name],
          data: area,
        });
      }
    });

    // Search Named Roads
    const roadSeen = new Set();
    lumbanRoads.features.forEach(f => {
      const roadName = f.properties.name;
      if (roadName && roadName.toLowerCase().includes(q) && !roadSeen.has(roadName)) {
        roadSeen.add(roadName);
        const coords = f.geometry.type === 'LineString'
          ? [f.geometry.coordinates[0][1], f.geometry.coordinates[0][0]]
          : [f.geometry.coordinates[0][0][1], f.geometry.coordinates[0][0][0]];
        results.push({
          type: 'road',
          title: roadName,
          subtitle: `${f.properties.Road_Class || 'Road'} • ${f.properties.surface || 'Paved'}`,
          coords,
          data: f.properties,
        });
      }
    });

    return results.slice(0, 6);
  }, [searchQuery, riskMapByName]);

  // Handlers
  const handleSelectSearchResult = (res) => {
    setTargetView({ center: res.coords, zoom: 16 });
    setSearchQuery('');
    if (res.type === 'barangay') {
      setSelectedFeature({
        type: 'barangay',
        title: res.title,
        data: res.data,
      });
    } else if (res.type === 'road') {
      setSelectedFeature({
        type: 'road',
        title: res.title,
        data: res.data,
      });
    }
  };

  const handleResetView = () => {
    setTargetView({ center: LUMBAN_CENTER, zoom: DEFAULT_ZOOM });
    setSelectedFeature(null);
  };

  const handleCreate = () => {
    if (!form.name || !form.lat || !form.lng) { toast.error('Name, lat, and lng are required'); return; }
    create.mutate({
      name: form.name,
      risk_level: form.risk_level,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      radius: parseInt(form.radius || '250'),
      note: form.note || null,
    });
  };

  const handleUpdate = () => {
    update.mutate({
      id: editItem.id,
      data: {
        name: form.name,
        risk_level: form.risk_level,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        radius: parseInt(form.radius || '250'),
        note: form.note || null,
      },
    });
  };

  const openEdit = (area) => {
    setEditItem(area);
    setForm({
      name: area.name,
      risk_level: area.risk_level,
      lat: String(area.lat),
      lng: String(area.lng),
      radius: String(area.radius),
      note: area.note || '',
    });
    setShowEdit(true);
  };

  const grouped = areas.reduce((acc, a) => {
    if (!acc[a.risk_level]) acc[a.risk_level] = [];
    acc[a.risk_level].push(a);
    return acc;
  }, {});

  const activeRoadCount = lumbanRoads.features.length;

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------------- */}
      {/* TOP HEADER & CONTROLS */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="p-2 bg-red-600 text-white rounded-xl shadow-md">
                <Waves size={20} />
              </span>
              Flood Risk & Hazard Map
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <Compass size={13} className="text-blue-500" />
              Lumban, Laguna
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1">
            Integrated multi-layer GIS overlay: Scientific Flood Model, Road Network & LDRRMP Risk Assessment
          </p>
        </div>

        {/* View Mode & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Search */}
          <div className="relative min-w-[220px] sm:min-w-[260px]">
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm shadow-sm focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500 transition-all">
              <Search size={16} className="text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                placeholder="Search Barangay or Road..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[2000] overflow-hidden">
                <div className="p-1.5 space-y-1">
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectSearchResult(res)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {res.type === 'barangay' ? '📍' : '🛣️'} {res.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{res.subtitle}</div>
                      </div>
                      <Navigation size={13} className="text-blue-500 opacity-60" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* View Tab Switcher */}
          <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-0.5">
            <button
              onClick={() => setViewTab('map')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                viewTab === 'map' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🗺️ Map View
            </button>
            <button
              onClick={() => setViewTab('list')}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                viewTab === 'list' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              📋 Risk List ({areas.length})
            </button>
          </div>

          {/* Admin Add Button */}
          {isAdmin && (
            <button
              onClick={() => { setForm({ name: '', risk_level: 'MODERATE', lat: '', lng: '', radius: '250', note: '' }); setShowAdd(true); }}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Plus size={15} /> Add Area
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TELEMETRY KPI STATUS STRIP */}
      {/* ------------------------------------------------------------- */}
      {viewTab === 'map' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
              <Shield size={18} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Monitored Zones</div>
              <div className="text-base font-black text-slate-900 dark:text-white">16 Barangays</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center font-black">
              <ShieldAlert size={18} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority Risk Zones</div>
              <div className="text-base font-black text-red-600 dark:text-red-400">
                {areas.filter(a => ['VERY_HIGH', 'HIGH'].includes(a.risk_level)).length || 5} High / Critical
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
              <Route size={18} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Road Arteries</div>
              <div className="text-base font-black text-slate-900 dark:text-white">{activeRoadCount} Segments</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/90 backdrop-blur-md border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black">
              <CloudRain size={18} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Weather Radar</div>
              <div className="text-xs font-black text-sky-600 dark:text-sky-400 flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${layerVisibility.rainRadar ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {layerVisibility.rainRadar ? 'Radar Stream Online' : 'Standby Mode'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* QUICK LAYER FILTER PILL BAR */}
      {/* ------------------------------------------------------------- */}
      {viewTab === 'map' && (
        <div className="flex flex-wrap items-center gap-2 p-2 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-sm backdrop-blur-md">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1.5">
            <Layers size={14} /> Layers:
          </span>

          {/* 1. Municipal Border Pill */}
          <button
            onClick={() => setLayerVisibility(v => ({ ...v, municipalBorder: !v.municipalBorder }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              layerVisibility.municipalBorder
                ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 shadow-sm'
                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
            }`}
          >
            <Shield size={13} className={layerVisibility.municipalBorder ? 'text-blue-600' : 'text-slate-400'} />
            Municipal Border
          </button>

          {/* 2. Flood Map Layer Pill */}
          <button
            onClick={() => setLayerVisibility(v => ({ ...v, floodMap: !v.floodMap }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              layerVisibility.floodMap
                ? 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 shadow-sm'
                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
            }`}
          >
            <Waves size={13} className={layerVisibility.floodMap ? 'text-red-600' : 'text-slate-400'} />
            Flood Hazard Map
            {layerVisibility.floodMap && (
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            )}
          </button>

          {/* 3. Live Doppler Rain Radar Pill */}
          <button
            onClick={() => setLayerVisibility(v => ({ ...v, rainRadar: !v.rainRadar }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              layerVisibility.rainRadar
                ? 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800 shadow-sm'
                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
            }`}
          >
            <CloudRain size={13} className={layerVisibility.rainRadar ? 'text-sky-600' : 'text-slate-400'} />
            Rain Radar (Live)
            {layerVisibility.rainRadar && (
              <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
            )}
          </button>

          {/* 4. Road Network Layer Pill */}
          <button
            onClick={() => setLayerVisibility(v => ({ ...v, roads: !v.roads }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              layerVisibility.roads
                ? 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 shadow-sm'
                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
            }`}
          >
            <Route size={13} className={layerVisibility.roads ? 'text-purple-600' : 'text-slate-400'} />
            Roads ({activeRoadCount})
          </button>

          {/* 5. Barangay Risk Zones Layer Pill */}
          <button
            onClick={() => setLayerVisibility(v => ({ ...v, riskMap: !v.riskMap }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              layerVisibility.riskMap
                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800 shadow-sm'
                : 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700'
            }`}
          >
            <ShieldAlert size={13} className={layerVisibility.riskMap ? 'text-amber-600' : 'text-slate-400'} />
            Barangay Risk Map
          </button>

          <div className="ml-auto flex items-center gap-2">
            {/* Filter Drawer Toggle */}
            <button
              onClick={() => setShowFilterDrawer(d => !d)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                showFilterDrawer
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter size={13} />
              Filter Options
              {showFilterDrawer ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* FILTER & OPACITY DRAWER */}
      {/* ------------------------------------------------------------- */}
      {viewTab === 'map' && showFilterDrawer && (
        <div className="bg-white dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-lg space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-red-600" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">Map Layer Customization & Filters</span>
            </div>
            <button
              onClick={() => {
                setRiskFilters({ VERY_HIGH: true, HIGH: true, MODERATE: true, LOW: true });
                setFloodFilters({ 3: true, 2: true, 1: true });
                setRoadFilters({ 'National Road': true, 'Provincial Road': true, 'Municipal Road': true, 'Barangay Road': true, 'Other': true });
                setRiskOpacity(0.5);
                setFloodOpacity(0.65);
                toast.success('All filters reset');
              }}
              className="text-xs font-bold text-slate-500 hover:text-red-600 dark:hover:text-red-400 flex items-center gap-1"
            >
              <RotateCcw size={12} /> Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Basemap Style Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                🗺️ Basemap Style
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(BASEMAPS).map(bm => (
                  <button
                    key={bm.id}
                    onClick={() => setBasemap(bm.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left ${
                      basemap === bm.id
                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{bm.icon}</span>
                    <span className="truncate">{bm.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Flood Hazard Map Sub-Filters */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Waves size={13} className="text-red-500" /> Flood Hazard (NOAH)
                </label>
                <span className="text-[11px] font-mono text-slate-400">Opacity: {Math.round(floodOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={floodOpacity}
                onChange={(e) => setFloodOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-600"
              />
              <div className="space-y-1.5 pt-1">
                {[3, 2, 1].map(varKey => {
                  const cfg = FLOOD_HAZARD_CONFIG[varKey];
                  const active = floodFilters[varKey];
                  return (
                    <button
                      key={varKey}
                      onClick={() => setFloodFilters(f => ({ ...f, [varKey]: !f[varKey] }))}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        active
                          ? 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                          : 'opacity-40 line-through bg-transparent border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.fill }} />
                        <span>{cfg.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{cfg.depth}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Road Classification Sub-Filters */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Route size={13} className="text-purple-500" /> Road Filter ({activeRoadCount})
              </label>
              <div className="space-y-1.5">
                {Object.entries(ROAD_CLASS_CONFIG).map(([clsKey, cfg]) => {
                  const active = roadFilters[clsKey];
                  return (
                    <button
                      key={clsKey}
                      onClick={() => setRoadFilters(r => ({ ...r, [clsKey]: !r[clsKey] }))}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        active
                          ? 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                          : 'opacity-40 line-through bg-transparent border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-1 rounded" style={{ backgroundColor: cfg.color }} />
                        <span>{clsKey}</span>
                      </div>
                      <span className="text-[11px]">{cfg.icon}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Barangay Risk Assessment Filters */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert size={13} className="text-amber-500" /> Barangay Risk Level
                </label>
                <span className="text-[11px] font-mono text-slate-400">Opacity: {Math.round(riskOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={riskOpacity}
                onChange={(e) => setRiskOpacity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="space-y-1.5 pt-1">
                {Object.entries(RISK_CONFIG).map(([lvlKey, cfg]) => {
                  const active = riskFilters[lvlKey];
                  const count = (grouped[lvlKey] || []).length;
                  return (
                    <button
                      key={lvlKey}
                      onClick={() => setRiskFilters(rf => ({ ...rf, [lvlKey]: !rf[lvlKey] }))}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        active
                          ? 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600'
                          : 'opacity-40 line-through bg-transparent border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cfg.fill }} />
                        <span>{cfg.label}</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MAP VIEW TAB */}
      {/* ------------------------------------------------------------- */}
      {viewTab === 'map' && (
        <div className={`relative bg-slate-950 border border-slate-300 dark:border-slate-700 overflow-hidden shadow-xl transition-all ${
          isFullScreen ? 'fixed inset-0 z-[5000] w-screen h-screen rounded-none' : 'h-[620px] rounded-3xl'
        }`}>
          {/* Map Viewport */}
          <MapContainer
            center={LUMBAN_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: '100%', width: '100%', background: '#09101d' }}
          >
            {/* Map Controller for programmatic movement & Fullscreen auto-resize */}
            <MapController targetCenter={targetView?.center} targetZoom={targetView?.zoom} isFullScreen={isFullScreen} />

            {/* Active Base Tile Layer */}
            <TileLayer
              key={basemap}
              url={BASEMAPS[basemap].url}
              attribution={BASEMAPS[basemap].attribution}
              maxZoom={19}
              maxNativeZoom={BASEMAPS[basemap].maxNativeZoom || 19}
            />

            {/* 1. LUMBAN MUNICIPAL OUTER BORDER OVERLAY */}
            {layerVisibility.municipalBorder && (
              <GeoJSON
                key="lumban-border"
                data={lumbanBorder}
                style={{
                  color: '#2563eb',
                  weight: 3,
                  fillColor: 'transparent',
                  fillOpacity: 0,
                  dashArray: '6 4',
                }}
                interactive={false}
              />
            )}

            {/* 2. FLOOD HAZARD GEOJSON OVERLAY */}
            {filteredFloodGeoJSON && (
              <GeoJSON
                key={`flood-${floodOpacity}-${Object.values(floodFilters).join()}`}
                data={filteredFloodGeoJSON}
                style={(feature) => {
                  const cfg = FLOOD_HAZARD_CONFIG[feature.properties.Var] || FLOOD_HAZARD_CONFIG[2];
                  return {
                    color: cfg.color,
                    weight: 1.5,
                    fillColor: cfg.fill,
                    fillOpacity: floodOpacity,
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const cfg = FLOOD_HAZARD_CONFIG[feature.properties.Var] || FLOOD_HAZARD_CONFIG[2];
                  layer.on({
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      setSelectedFeature({
                        type: 'flood',
                        title: cfg.label,
                        data: { ...feature.properties, ...cfg },
                      });
                    },
                    mouseover: () => layer.setStyle({ fillOpacity: Math.min(1.0, floodOpacity + 0.25), weight: 2.5 }),
                    mouseout: () => layer.setStyle({ fillOpacity: floodOpacity, weight: 1.5 }),
                  });
                  layer.bindPopup(`
                    <div style="min-width:210px;font-family:sans-serif;padding:6px 4px;">
                      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                        <span style="font-size:16px">${cfg.icon}</span>
                        <div style="font-weight:900;font-size:14px;color:${cfg.fill}">${cfg.label}</div>
                      </div>
                      <div style="background:${cfg.fill}22;color:${cfg.color};border:1px solid ${cfg.fill}55;padding:4px 8px;border-radius:8px;font-size:11px;font-weight:800;margin-bottom:8px;">
                        Depth: ${cfg.depth} (${cfg.depthDesc})
                      </div>
                      <div style="font-size:11px;color:#cbd5e1;line-height:1.5">${cfg.advisory}</div>
                    </div>
                  `);
                }}
              />
            )}

            {/* 3. BARANGAY RISK BOUNDARY GEOJSON OVERLAY */}
            {filteredRiskGeoJSON && (
              <GeoJSON
                key={`risk-${riskOpacity}-${areas.map(a => `${a.id}-${a.risk_level}`).join()}-${Object.values(riskFilters).join()}`}
                data={filteredRiskGeoJSON}
                style={(feature) => {
                  const name = feature.properties.ADM4_EN;
                  const area = riskMapByName[cleanName(name)] || riskMapByName[name];
                  if (area) {
                    const cfg = RISK_CONFIG[area.risk_level] || RISK_CONFIG.MODERATE;
                    return {
                      color: cfg.color,
                      weight: 2,
                      fillColor: cfg.fill,
                      fillOpacity: riskOpacity,
                    };
                  }
                  return { color: '#0ea5e9', weight: 2, fillColor: 'transparent', fillOpacity: 0, dashArray: '5 4' };
                }}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties.ADM4_EN;
                  const area = riskMapByName[cleanName(name)] || riskMapByName[name];
                  const cfg = area ? (RISK_CONFIG[area.risk_level] || RISK_CONFIG.MODERATE) : null;

                  layer.on({
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      setSelectedFeature({
                        type: 'barangay',
                        title: name,
                        data: area || { name, risk_level: 'MODERATE' },
                      });
                    },
                    mouseover: () => layer.setStyle({ fillOpacity: Math.min(1.0, riskOpacity + 0.25), weight: 3 }),
                    mouseout: () => layer.setStyle({ fillOpacity: riskOpacity, weight: 2 }),
                  });

                  if (cfg) {
                    layer.bindPopup(`
                      <div style="min-width:210px;font-family:sans-serif;padding:6px 4px;">
                        <div style="font-weight:900;font-size:15px;color:${cfg.color};margin-bottom:2px">${name}</div>
                        <div style="font-size:11px;color:#94a3b8;margin-bottom:8px">Lumban, Laguna • CDRA Classified</div>
                        <span style="background:${cfg.fill};color:#fff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800">${cfg.icon} ${cfg.label}</span>
                        <div style="margin-top:8px;font-size:11px;color:#cbd5e1;line-height:1.5">${cfg.desc}</div>
                        ${area.note ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #334155;font-size:11px;color:#94a3b8;font-style:italic">Note: ${area.note}</div>` : ''}
                      </div>
                    `);
                  }
                }}
              />
            )}

            {/* 4. ROAD NETWORK GEOJSON OVERLAY */}
            {filteredRoadsGeoJSON && (
              <GeoJSON
                key={`roads-${Object.values(roadFilters).join()}`}
                data={filteredRoadsGeoJSON}
                style={(feature) => {
                  const cls = feature.properties.Road_Class || 'Other';
                  const cfg = ROAD_CLASS_CONFIG[cls] || ROAD_CLASS_CONFIG.Other;
                  return {
                    color: cfg.color,
                    weight: cfg.weight,
                    opacity: 0.95,
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const p = feature.properties;
                  const cls = p.Road_Class || 'Other';
                  const cfg = ROAD_CLASS_CONFIG[cls] || ROAD_CLASS_CONFIG.Other;
                  const title = p.name || `${cls} Segment`;

                  layer.on({
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      setSelectedFeature({
                        type: 'road',
                        title,
                        data: p,
                      });
                    },
                    mouseover: () => layer.setStyle({ weight: cfg.weight + 3, color: '#f59e0b' }),
                    mouseout: () => layer.setStyle({ weight: cfg.weight, color: cfg.color }),
                  });

                  layer.bindPopup(`
                    <div style="min-width:200px;font-family:sans-serif;padding:6px 4px;">
                      <div style="font-weight:900;font-size:13px;color:#0f172a;margin-bottom:2px">🛣️ ${title}</div>
                      <div style="font-size:11px;font-weight:700;color:${cfg.color};margin-bottom:6px">${cls}</div>
                      <div style="font-size:11px;color:#475569;line-height:1.6">
                        ${p.surface ? `<b>Surface:</b> ${p.surface}<br/>` : ''}
                        ${p.highway ? `<b>Type:</b> ${p.highway}<br/>` : ''}
                        ${p.lanes ? `<b>Lanes:</b> ${p.lanes}<br/>` : ''}
                        ${p.ref ? `<b>Route Ref:</b> ${p.ref}<br/>` : ''}
                      </div>
                    </div>
                  `);
                }}
              />
            )}

            {/* Labels Base Tile Layer (Overlay on top of polygons) */}
            {BASEMAPS[basemap].labelsUrl && (
              <TileLayer key={`labels-${basemap}`} url={BASEMAPS[basemap].labelsUrl} maxZoom={19} maxNativeZoom={19} />
            )}

            {/* 5. LIVE METEOROLOGICAL RAIN RADAR (RainViewer API) */}
            {layerVisibility.rainRadar && radarTileUrl && (
              <TileLayer
                key={`radar-${radarTimestamp}-${radarOpacity}`}
                url={radarTileUrl}
                opacity={radarOpacity}
                zIndex={450}
                maxZoom={19}
                maxNativeZoom={18}
              />
            )}

            {/* Centroid Barangay Label Pins (Sleek non-overlapping glowing beacons with hover tooltips) */}
            {layerVisibility.riskLabels && Object.entries(BRGY_CENTERS).map(([name, pos]) => {
              const area = riskMapByName[cleanName(name)] || riskMapByName[name];
              const cfg = area ? RISK_CONFIG[area.risk_level] : RISK_CONFIG.MODERATE;
              if (cfg && !riskFilters[area?.risk_level || 'MODERATE']) return null;

              return (
                <Marker
                  key={name}
                  position={pos}
                  icon={createBarangayBeaconIcon(area)}
                  eventHandlers={{
                    click: () => {
                      setSelectedFeature({
                        type: 'barangay',
                        title: name,
                        data: area || { name, risk_level: 'MODERATE' },
                      });
                    },
                  }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -12]}
                    opacity={0.98}
                    sticky
                  >
                    <div style={{ fontFamily: 'sans-serif', padding: '2px 4px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, fontSize: 11, color: '#0f172a' }}>
                        {name.replace(/\s*\(.*?\)/g, '')}
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: cfg.fill, marginTop: 1 }}>
                        {cfg.icon} {cfg.label}
                      </div>
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>

          {/* ------------------------------------------------------------- */}
          {/* FLOATING MAP CONTROLS OVERLAY */}
          {/* ------------------------------------------------------------- */}
          <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 flex-wrap justify-end">
            {/* Basemap Switcher */}
            <div className="flex bg-white/95 dark:bg-slate-900/95 p-1 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700/80 backdrop-blur-md">
              {Object.values(BASEMAPS).map(bm => (
                <button
                  key={bm.id}
                  onClick={() => setBasemap(bm.id)}
                  title={bm.name}
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

            {/* Action Tools */}
            <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 p-1 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700/80 backdrop-blur-md">
              <button
                onClick={handleResetView}
                title="Reset View to Lumban Center"
                className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={() => setIsFullScreen(f => !f)}
                title={isFullScreen ? 'Exit Full Screen' : 'Full Screen Map'}
                className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                onClick={() => setShowLegend(l => !l)}
                title="Toggle Legend"
                className={`p-1.5 rounded-lg transition-all ${
                  showLegend
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Info size={15} />
              </button>
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* SELECTED FEATURE INSPECTOR CARD */}
          {/* ------------------------------------------------------------- */}
          {selectedFeature && (
            <div className="absolute bottom-6 left-6 z-[1000] max-w-sm sm:max-w-md w-full bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {selectedFeature.type === 'flood' && <Waves size={18} className="text-red-500" />}
                  {selectedFeature.type === 'road' && <Route size={18} className="text-blue-500" />}
                  {selectedFeature.type === 'barangay' && <ShieldAlert size={18} className="text-amber-500" />}

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {selectedFeature.type === 'flood' && 'Flood Hazard Model'}
                      {selectedFeature.type === 'road' && 'Road Network'}
                      {selectedFeature.type === 'barangay' && 'Barangay Risk Profile'}
                    </span>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                      {selectedFeature.title}
                    </h4>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedFeature(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Inspector Content by Type */}
              <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                {selectedFeature.type === 'flood' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                        Estimated Depth: {selectedFeature.data.depth}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                      {selectedFeature.data.advisory}
                    </p>
                  </div>
                )}

                {selectedFeature.type === 'road' && (
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        {selectedFeature.data.Road_Class || 'Road'}
                      </span>
                      {selectedFeature.data.surface && (
                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          Surface: {selectedFeature.data.surface}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      {selectedFeature.data.highway ? `Type: ${selectedFeature.data.highway}` : 'Maintained transportation artery in Lumban.'}
                    </p>
                  </div>
                )}

                {selectedFeature.type === 'barangay' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const lvl = selectedFeature.data.risk_level || 'MODERATE';
                        const cfg = RISK_CONFIG[lvl] || RISK_CONFIG.MODERATE;
                        return (
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${cfg.bg}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                        );
                      })()}
                    </div>
                    {selectedFeature.data.note && (
                      <p className="text-slate-700 dark:text-slate-300 font-medium">
                        <b>Advisory:</b> {selectedFeature.data.note}
                      </p>
                    )}
                    {isAdmin && (
                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => openEdit(selectedFeature.data)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1"
                        >
                          <Edit2 size={12} /> Edit Risk Level
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {selectedFeature.type === 'evacuation' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {selectedFeature.data.barangay || 'Lumban Central'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Capacity: {selectedFeature.data.current_evacuees || 0} / {selectedFeature.data.capacity || 100}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 space-y-1">
                      {selectedFeature.data.contact_person && (
                        <div className="flex items-center gap-1.5 font-medium">
                          <Users size={12} className="text-blue-500 shrink-0" />
                          <span>Manager: {selectedFeature.data.contact_person}</span>
                        </div>
                      )}
                      {selectedFeature.data.contact_number && (
                        <div className="flex items-center gap-1.5 font-medium">
                          <Phone size={12} className="text-emerald-500 shrink-0" />
                          <span>Hotline: {selectedFeature.data.contact_number}</span>
                        </div>
                      )}
                    </div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedFeature.data.latitude || selectedFeature.data.lat},${selectedFeature.data.longitude || selectedFeature.data.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      <Navigation size={12} /> Get Directions
                    </a>
                  </div>
                )}

                {selectedFeature.type === 'responder' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                        {selectedFeature.data.role?.replace('_', ' ') || 'RESCUE'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md font-bold text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {selectedFeature.data.status || 'AVAILABLE'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 space-y-1">
                      {selectedFeature.data.phone && (
                        <div className="flex items-center gap-1.5 font-medium">
                          <Phone size={12} className="text-emerald-500 shrink-0" />
                          <span>Radio/Phone: {selectedFeature.data.phone}</span>
                        </div>
                      )}
                      {selectedFeature.data.unit_type && (
                        <div><b>Assigned Vehicle:</b> {selectedFeature.data.unit_type}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------- */}
          {/* DYNAMIC MULTI-LAYER MAP LEGEND */}
          {/* ------------------------------------------------------------- */}
          {showLegend && (
            <div className="absolute bottom-6 right-6 z-[1000] bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-4 shadow-xl backdrop-blur-md max-w-xs w-full max-h-[360px] overflow-y-auto space-y-3 font-sans">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Layers size={13} className="text-red-500" /> Active Map Legend
                </span>
                <button onClick={() => setShowLegend(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                  <X size={13} />
                </button>
              </div>

              {/* Municipal Border Legend */}
              {layerVisibility.municipalBorder && (
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-0.5 border-t-2 border-dashed border-blue-600 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">Lumban Municipal Border</span>
                  </div>
                </div>
              )}

              {/* Flood Hazard Legend Section */}
              {layerVisibility.floodMap && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    🌊 Flood Inundation Hazard
                  </div>
                  <div className="space-y-1">
                    {[3, 2, 1].map(k => {
                      const cfg = FLOOD_HAZARD_CONFIG[k];
                      return (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <div className="w-3.5 h-3 rounded shrink-0" style={{ backgroundColor: cfg.fill, opacity: floodOpacity, border: `1px solid ${cfg.color}` }} />
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">{cfg.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono ml-auto">{cfg.depth}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Road Class Legend Section */}
              {layerVisibility.roads && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    🛣️ Road Classification
                  </div>
                  <div className="space-y-1">
                    {Object.entries(ROAD_CLASS_CONFIG).slice(0, 4).map(([cls, cfg]) => (
                      <div key={cls} className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-1.5 rounded shrink-0" style={{ backgroundColor: cfg.color }} />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] truncate">{cls}</span>
                        <span className="text-[11px] ml-auto">{cfg.icon}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Level Legend Section */}
              {layerVisibility.riskMap && (
                <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    🛡️ Barangay Disaster Risk (CDRA)
                  </div>
                  <div className="space-y-1">
                    {Object.entries(RISK_CONFIG).map(([k, cfg]) => (
                      <div key={k} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cfg.fill, opacity: riskOpacity, border: `1px solid ${cfg.color}` }} />
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">{cfg.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* LIST VIEW TAB */}
      {/* ------------------------------------------------------------- */}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {levelAreas.map(area => (
                    <div key={area.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color, boxShadow: `0 0 6px ${cfg.color}88` }} />
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{area.name}</span>
                        </div>
                        {area.note && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 ml-4 truncate font-medium">{area.note}</p>}
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-4 font-mono">📍 {area.lat.toFixed(4)}, {area.lng.toFixed(4)} · r={area.radius}m</p>
                      </div>
                      <div className="flex items-center gap-1.5 ml-3 shrink-0">
                        <button
                          onClick={() => {
                            setViewTab('map');
                            setTargetView({ center: [area.lat, area.lng], zoom: 16 });
                            setSelectedFeature({ type: 'barangay', title: area.name, data: area });
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                          title="Locate on Map"
                        >
                          <Navigation size={14} />
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => openEdit(area)} className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => window.confirm(`Delete "${area.name}"?`) && remove.mutate(area.id)} className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* METADATA & SCIENTIFIC SOURCES CARD */}
      {/* ------------------------------------------------------------- */}
      <Card>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 flex items-center gap-2">
          <Info size={16} className="text-blue-500" /> Scientific & Administrative Data Sources
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium pt-2">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
            <b className="text-slate-900 dark:text-white block mb-1">🌊 Flood Hazard Modeling</b>
            Project NOAH / Mines and Geosciences Bureau (MGB) 100-year return period scientific flood simulation with 3-tier depth classification.
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
            <b className="text-slate-900 dark:text-white block mb-1">🛣️ Road Network GIS</b>
            OpenStreetMap & DPWH vector layers categorized into National Highways, Provincial Arterials, Municipal, and Barangay streets.
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
            <b className="text-slate-900 dark:text-white block mb-1">🛡️ Local Risk Assessment (CDRA)</b>
            Local Disaster Risk Reduction and Management Plan (LDRRMP) of Lumban, Laguna municipal government disaster preparedness index.
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------------- */}
      {/* ADD MODAL */}
      {/* ------------------------------------------------------------- */}
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

      {/* ------------------------------------------------------------- */}
      {/* EDIT MODAL */}
      {/* ------------------------------------------------------------- */}
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

// -------------------------------------------------------------
// FORM FIELDS HELPER
// -------------------------------------------------------------
function FormFields({ form, setForm }) {
  const inputCls = 'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500 shadow-sm';
  const labelCls = 'text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1';

  return (
    <div className="space-y-3">
      <div>
        <span className={labelCls}>Barangay *</span>
        <select
          className={inputCls}
          value={form.name}
          onChange={e => {
            const name = e.target.value;
            const center = BRGY_CENTERS[name];
            setForm(f => ({ ...f, name, lat: center ? String(center[0]) : f.lat, lng: center ? String(center[1]) : f.lng }));
          }}
        >
          <option value="">— Select Barangay —</option>
          {BARANGAY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div>
        <span className={labelCls}>Risk Level *</span>
        <select
          className={inputCls}
          value={form.risk_level}
          onChange={e => setForm(f => ({ ...f, risk_level: e.target.value }))}
        >
          <option value="VERY_HIGH">🔴 Very High Risk</option>
          <option value="HIGH">🟠 High Risk</option>
          <option value="MODERATE">🟡 Moderate Risk</option>
          <option value="LOW">🟢 Low Risk</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className={labelCls}>Latitude *</span>
          <input
            type="text"
            inputMode="decimal"
            className={inputCls}
            value={form.lat}
            onChange={e => setForm(f => ({ ...f, lat: e.target.value.replace(/[^\d.-]/g, '') }))}
            placeholder="14.29xx"
          />
        </div>
        <div>
          <span className={labelCls}>Longitude *</span>
          <input
            type="text"
            inputMode="decimal"
            className={inputCls}
            value={form.lng}
            onChange={e => setForm(f => ({ ...f, lng: e.target.value.replace(/[^\d.-]/g, '') }))}
            placeholder="121.46xx"
          />
        </div>
      </div>

      <div>
        <span className={labelCls}>Notes (optional)</span>
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          value={form.note}
          onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
          placeholder="Additional local description or critical notes..."
        />
      </div>
    </div>
  );
}
