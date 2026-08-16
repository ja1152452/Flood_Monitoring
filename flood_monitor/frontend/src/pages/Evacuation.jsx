import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import lumbanBoundary from '../data/lumban-border.geojson';
import { getEvacuationCenters, updateEvacuationCenter, deleteEvacuationCenter } from '../api/evacuation';
import api from '../api/axios';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { Plus, Edit2, Users, Trash2, Download, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const LUMBAN_CENTER = [14.291969, 121.460112];

const EMPTY_FORM = {
  name: '', barangay: '', address: '',
  lat: '', lng: '', capacity_total: '',
  contact_person: '', contact_number: '', is_open: false,
};

const BARANGAYS = [
  'Bagong Silang', 'Balimbingan', 'Balubad', 'Caliraya',
  'Concepcion', 'Lewin', 'Maracta', 'Maytalang I', 'Maytalang II',
  'Poblacion', 'Primera Parang', 'Primera Pulo', 'Salac',
  'Segunda Parang', 'Segunda Pulo', 'Santo Niño', 'Wawa',
];

const inputClass = "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500 shadow-sm";

function Field({ label, required, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete="off"
      className={inputClass}
    />
  );
}

function LocationPicker({ onPick }) {
  useMapEvents({
    click(e) { onPick(e.latlng.lat, e.latlng.lng); },
  });
  return null;
}

export default function Evacuation() {
  const qc = useQueryClient();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pinned, setPinned] = useState(null);
  const [activeTab, setActiveTab] = useState('centers');
  const [pdfPreview, setPdfPreview] = useState(null);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [filterGender, setFilterGender] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');

  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn: getEvacuationCenters,
    refetchInterval: 30000,
  });

  const { data: allFamilies = [] } = useQuery({
    queryKey: ['all-families'],
    queryFn: () => api.get('/evacuation/all-families').then(r => r.data.data),
    refetchInterval: 15000,
  });

  const addCenter = useMutation({
    mutationFn: (data) => api.post('/evacuation', data).then(r => r.data.data),
    onSuccess: () => {
      toast.success('Evacuation center added');
      qc.invalidateQueries(['evacuation']);
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      setPinned(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add'),
  });

  const updateCenter = useMutation({
    mutationFn: ({ id, data }) => updateEvacuationCenter(id, data),
    onSuccess: () => {
      toast.success('Center updated');
      qc.invalidateQueries(['evacuation']);
      setShowEditModal(false);
    },
    onError: () => toast.error('Update failed'),
  });

  const removeCenter = useMutation({
    mutationFn: (id) => deleteEvacuationCenter(id),
    onSuccess: () => { toast.success('Center deleted'); qc.invalidateQueries(['evacuation']); },
    onError: () => toast.error('Delete failed'),
  });

  const handleAddSubmit = () => {
    if (!form.name || !form.barangay || !form.lat || !form.lng || !form.capacity_total) {
      toast.error('Fill in all required fields and pick a location on the map');
      return;
    }
    addCenter.mutate({
      name: form.name,
      barangay: form.barangay,
      address: form.address,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
      capacity_total: parseInt(form.capacity_total),
      contact_person: form.contact_person,
      contact_number: form.contact_number,
      is_open: form.is_open,
    });
  };

  const openEdit = (center) => {
    setEditTarget(center);
    setForm({
      name: center.name,
      barangay: center.barangay_name || '',
      address: center.address || '',
      lat: center.lat,
      lng: center.lng,
      capacity_total: center.capacity_total,
      capacity_current: center.capacity_current,
      contact_person: center.contact_person || '',
      contact_number: center.contact_number || '',
      is_open: center.is_open,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = () => {
    updateCenter.mutate({
      id: editTarget.id,
      data: {
        name: form.name,
        address: form.address,
        capacity_total: parseInt(form.capacity_total),
        capacity_current: parseInt(form.capacity_current || 0),
        contact_person: form.contact_person,
        contact_number: form.contact_number,
        is_open: form.is_open,
      },
    });
  };

  const exportCentersPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('MDRRMO — Evacuation Centers', 14, 16);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${now}`, 14, 23);
    doc.text(`Total Centers: ${centers.length}   Open: ${centers.filter(c => c.is_open).length}`, 14, 29);
    autoTable(doc, {
      startY: 34,
      head: [['#', 'Center Name', 'Barangay', 'Address', 'Capacity', 'Occupancy', 'Contact Person', 'Contact Number', 'Status']],
      body: centers.map((c, i) => [
        i + 1,
        c.name,
        c.barangay_name || '—',
        c.address || '—',
        c.capacity_total,
        `${c.capacity_current} (${c.capacity_total > 0 ? Math.round((c.capacity_current / c.capacity_total) * 100) : 0}%)`,
        c.contact_person || '—',
        c.contact_number || '—',
        c.is_open ? 'OPEN' : 'CLOSED',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
    });
    const filename = `evacuation_centers_${new Date().toISOString().slice(0, 10)}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  const exportAllPDF = () => {
    const familiesToExport = selectedCenter
      ? allFamilies.filter(f => f.evacuation_center_id === selectedCenter.id)
      : allFamilies;

    const centerName = selectedCenter ? selectedCenter.name : 'All Centers';

    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(`MDRRMO — Evacuee Records${selectedCenter ? ` — ${centerName}` : ''}`, 14, 16);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${now}`, 14, 23);
    doc.text(`Total Families: ${familiesToExport.length}   Total Members: ${familiesToExport.reduce((s, f) => s + (f.members || 0), 0)}`, 14, 29);
    autoTable(doc, {
      startY: 34,
      head: [['#', 'Head of Family', 'Age', 'Address', 'Barangay', 'Members', 'Family Members List', 'Contact', 'Arrival Date', selectedCenter ? '' : 'Center']].map(row => row.filter(h => h !== '')),
      body: familiesToExport.map((f, i) => {
        const membersList = f.members_list && Array.isArray(f.members_list) && f.members_list.length > 0
          ? f.members_list.map(m => `${m.name}${m.age ? ` (${m.age})` : ''}`).join(', ')
          : '—';

        const row = [
          i + 1, f.head_name, f.age || '—', f.address || '—', f.barangay || '—',
          f.members, membersList, f.contact || '—',
          f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH') : '—',
        ];
        if (!selectedCenter) row.push(f.center_name || '—');
        return row;
      }),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: { 6: { cellWidth: 50 } },
    });
    const filename = `evacuees_${selectedCenter ? selectedCenter.name.replace(/\s+/g, '_') : 'all'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Evacuation Centers</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {centers.filter(c => c.is_open).length} open · {centers.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCentersPDF}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> Export Centers PDF
          </button>
          <button
            onClick={() => { setForm(EMPTY_FORM); setPinned(null); setShowAddModal(true); }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={16} />
            Add Center
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 w-fit shadow-sm dark:shadow-none">
        {[['centers', 'Centers'], ['evacuees', 'Evacuee Records']].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === key ? 'bg-red-600 text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}>{label}</button>
        ))}
      </div>

      {activeTab === 'evacuees' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              {selectedCenter ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedCenter(null)}
                    className="text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedCenter.name}</h3>
                    <p className="text-slate-400 text-sm">
                      {allFamilies.filter(f => f.evacuation_center_id === selectedCenter.id).length} families · {allFamilies.filter(f => f.evacuation_center_id === selectedCenter.id).reduce((s, f) => s + (f.members || 0), 0)} members
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">
                  {allFamilies.length} families · {allFamilies.reduce((s, f) => s + (f.members || 0), 0)} total members across all centers
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
                className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <input type="number" min="0" max="120" placeholder="Age min" value={filterAgeMin}
                onChange={e => setFilterAgeMin(e.target.value)}
                className="w-20 bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" min="0" max="120" placeholder="Age max" value={filterAgeMax}
                onChange={e => setFilterAgeMax(e.target.value)}
                className="w-20 bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {(filterGender || filterAgeMin || filterAgeMax) && (
                <button onClick={() => { setFilterGender(''); setFilterAgeMin(''); setFilterAgeMax(''); }}
                  className="text-xs text-slate-700 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 dark:text-slate-400 dark:hover:text-white px-2 py-1.5 dark:bg-slate-700 rounded-lg transition-colors">Clear</button>
              )}
              <button onClick={exportAllPDF}
                className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                <Download size={15} /> Export PDF
              </button>
            </div>
          </div>

          {/* Show center cards if no center selected */}
          {!selectedCenter ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {centers.map(center => {
                const centerFamilies = allFamilies.filter(f => f.evacuation_center_id === center.id);
                const totalMembers = centerFamilies.reduce((s, f) => s + (f.members || 0), 0);

                return (
                  <button
                    key={center.id}
                    onClick={() => setSelectedCenter(center)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 text-left hover:border-red-500 transition-all hover:shadow-lg hover:shadow-red-500/10 shadow-sm dark:shadow-none"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{center.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">📍 {center.barangay_name}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${center.is_open ? 'bg-emerald-100 text-emerald-800 dark:bg-green-900 dark:text-green-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                        {center.is_open ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-900 dark:text-white font-semibold">{center.capacity_current} <span className="text-slate-400 text-xs font-normal">/ {center.capacity_total}</span></span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Total Members</span>
                        <span className="text-blue-400 font-semibold">{totalMembers}</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 text-center">
                      Click to view details →
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (() => {
            const rows = allFamilies.filter(f => {
              if (f.evacuation_center_id !== selectedCenter.id) return false;
              if (filterGender && f.gender !== filterGender) return false;
              const age = f.age ? parseInt(f.age) : null;
              if (filterAgeMin && (age === null || age < parseInt(filterAgeMin))) return false;
              if (filterAgeMax && (age === null || age > parseInt(filterAgeMax))) return false;
              return true;
            });
            return (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        {['#', 'Head of Family', 'Age', 'Gender', 'Address', 'Barangay', 'Members', 'Family Members List', 'Contact', 'Arrival Date'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                      {rows.length === 0 ? (
                        <tr><td colSpan={10} className="px-5 py-10 text-center text-slate-500 font-semibold">No families match the current filters</td></tr>
                      ) : rows.map((f, i) => (
                        <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 text-slate-500 text-xs font-medium">{i + 1}</td>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{f.head_name}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{f.age || '—'}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{f.gender || '—'}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[140px] truncate font-medium">{f.address || '—'}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">{f.barangay || '—'}</td>
                          <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-bold">{f.members}</td>
                          <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                            {f.members_list && Array.isArray(f.members_list) && f.members_list.length > 0 ? (
                              <div className="space-y-1">
                                {f.members_list.map((member, idx) => (
                                  <div key={idx} className="text-xs font-medium">
                                    {member.name}{member.age ? ` (${member.age}yo)` : ''}{member.gender ? ` [${member.gender}]` : ''}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-mono font-medium">{f.contact || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs whitespace-nowrap font-medium">
                            {f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {!selectedCenter && allFamilies.length === 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center text-slate-500 shadow-sm dark:shadow-none">
              No evacuee records yet
            </div>
          )}
        </div>
      )}

      {activeTab === 'centers' && (<>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-300">Map — Lumban, Laguna</h3>
            <p className="text-xs text-slate-500 mt-0.5">Click a marker to see details</p>
          </div>
          <MapContainer center={LUMBAN_CENTER} zoom={15} style={{ height: '420px', width: '100%' }}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <GeoJSON key="lumban-border" data={lumbanBoundary} style={{ color: '#ef4444', weight: 1, fillOpacity: 0, dashArray: '6 3' }} interactive={false} />
            {centers.map(center => (
              <Marker
                key={center.id}
                position={[center.lat, center.lng]}
                icon={L.divIcon({
                  html: `<div style="width:32px;height:32px;border-radius:8px;background:${center.is_open ? '#16a34a' : '#6b7280'};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;font-size:15px;">🏠</div>`,
                  className: '', iconSize: [32, 32], iconAnchor: [16, 32],
                })}
              >
                <Popup>
                  <div style={{ minWidth: '200px', fontSize: '13px', lineHeight: '1.6' }}>
                    <strong style={{ fontSize: '14px' }}>{center.name}</strong><br />
                    📍 {center.barangay_name}<br />
                    {center.address && <>{center.address}<br /></>}
                    👥 {center.capacity_current} / {center.capacity_total}<br />
                    {center.contact_person && <>👤 {center.contact_person}<br /></>}
                    {center.contact_number && <>📞 {center.contact_number}<br /></>}
                    <span style={{
                      background: center.is_open ? '#dcfce7' : '#f3f4f6',
                      color: center.is_open ? '#16a34a' : '#6b7280',
                      padding: '2px 10px', borderRadius: '999px',
                      fontSize: '11px', fontWeight: 'bold',
                    }}>
                      {center.is_open ? '✓ OPEN' : '✗ CLOSED'}
                    </span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {centers.map(center => {
            const pct = center.capacity_total > 0 ? Math.round((center.capacity_current / center.capacity_total) * 100) : 0;
            const full = pct >= 100;
            return (
              <div key={center.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm dark:shadow-none">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 pr-2">
                    <h4 className="font-semibold text-slate-900 dark:text-white text-base">{center.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">📍 {center.barangay_name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${center.is_open ? full ? 'bg-rose-100 text-rose-800 dark:bg-red-900 dark:text-red-300' : 'bg-emerald-100 text-emerald-800 dark:bg-green-900 dark:text-green-300' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-400'}`}>
                      {center.is_open ? (full ? 'FULL' : 'OPEN') : 'CLOSED'}
                    </span>
                    <button onClick={() => openEdit(center)} className="text-slate-400 hover:text-blue-400 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => { if (window.confirm(`Delete "${center.name}"?`)) removeCenter.mutate(center.id); }}
                      className="text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Users size={13} className="text-slate-500" />
                  <span className="text-xs text-slate-400">{center.capacity_current} / {center.capacity_total} evacuees</span>
                </div>
                <div className="mb-3">
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
                {center.contact_person && (
                  <div className="text-xs text-slate-500">👤 {center.contact_person}{center.contact_number && ` · ${center.contact_number}`}</div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => updateCenter.mutate({ id: center.id, data: { is_open: !center.is_open } })}
                    className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${center.is_open ? 'bg-red-100 hover:bg-red-200 text-red-800 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-200' : 'bg-green-100 hover:bg-green-200 text-green-800 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-200'}`}>
                    {center.is_open ? 'Close Center' : 'Open Center'}
                  </button>
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max={center.capacity_total}
                      defaultValue={center.capacity_current}
                      className="w-16 text-xs bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-2 text-slate-900 dark:text-white text-center"
                      onBlur={e => updateCenter.mutate({ id: center.id, data: { capacity_current: parseInt(e.target.value) || 0 } })}
                    />
                    <span className="text-xs text-slate-500">evacuees</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </>)}

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-sm font-semibold text-slate-800 dark:text-white">PDF Preview — {pdfPreview.filename}</span>
              <div className="flex items-center gap-2">
                <a href={pdfPreview.url} download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <Download size={13} /> Download
                </a>
                <button onClick={() => setPdfPreview(null)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors p-1">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe src={pdfPreview.url} className="flex-1 w-full rounded-b-2xl" title="PDF Preview" />
          </div>
        </div>
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Evacuation Center">
        <div className="space-y-4">
          <div className="bg-blue-900/30 border border-blue-700 rounded-xl p-3 text-xs text-blue-300">
            📌 <span className="text-blue-900 font-bold px-1 rounded">Click on the map below to pin the exact location.</span>
          </div>

          <MapContainer center={LUMBAN_CENTER} zoom={15} style={{ height: '220px', width: '100%', borderRadius: '10px' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
            <LocationPicker onPick={(lat, lng) => {
              setPinned({ lat, lng });
              setForm(f => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
            }} />
            {pinned && <Marker position={[pinned.lat, pinned.lng]}><Popup>📍 Selected location</Popup></Marker>}
          </MapContainer>

          {form.lat && (
            <div className="text-xs text-green-400 bg-green-900/20 rounded-lg px-3 py-2">
              ✓ Pinned: {parseFloat(form.lat).toFixed(5)}, {parseFloat(form.lng).toFixed(5)}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Center Name" required>
              <Input value={form.name} placeholder="e.g. Wawa Covered Court"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Barangay" required>
              <select value={form.barangay}
                onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))}
                className={inputClass}>
                <option value="">Select barangay</option>
                {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Address / Landmark">
            <Input value={form.address} placeholder="e.g. Brgy. Hall Compound"
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" required>
              <Input value={form.lat} placeholder="Click map to set"
                onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
            </Field>
            <Field label="Longitude" required>
              <Input value={form.lng} placeholder="Click map to set"
                onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Capacity" required>
              <Input type="number" value={form.capacity_total} placeholder="e.g. 200"
                onChange={e => setForm(f => ({ ...f, capacity_total: e.target.value }))} />
            </Field>
            <Field label="Contact Person">
              <Input value={form.contact_person} placeholder="Brgy. Captain name"
                onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
            </Field>
          </div>

          <Field label="Contact Number">
            <Input value={form.contact_number} placeholder="+639XXXXXXXXX"
              onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} />
          </Field>

          <div className="flex items-center gap-3">
            <input type="checkbox" checked={form.is_open}
              onChange={e => setForm(f => ({ ...f, is_open: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-sm text-slate-300">Open immediately after adding</span>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowAddModal(false)}
              className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm py-2.5 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleAddSubmit} disabled={addCenter.isPending}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              {addCenter.isPending ? 'Adding...' : 'Add Center'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Evacuation Center">
        <div className="space-y-4">
          <Field label="Center Name">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Total Capacity">
              <Input type="number" value={form.capacity_total} onChange={e => setForm(f => ({ ...f, capacity_total: e.target.value }))} />
            </Field>
            <Field label="Current Evacuees">
              <Input type="number" value={form.capacity_current} onChange={e => setForm(f => ({ ...f, capacity_current: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact Person">
              <Input value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
            </Field>
            <Field label="Contact Number">
              <Input value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={form.is_open}
              onChange={e => setForm(f => ({ ...f, is_open: e.target.checked }))}
              className="w-4 h-4 rounded" />
            <span className="text-sm text-slate-300">Center is Open</span>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowEditModal(false)}
              className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm py-2.5 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleEditSubmit} disabled={updateCenter.isPending}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              {updateCenter.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}