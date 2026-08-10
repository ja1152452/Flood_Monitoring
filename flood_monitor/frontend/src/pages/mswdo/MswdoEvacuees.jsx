import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEvacuationCenters } from '../../api/evacuation';
import { useAuthStore } from '../../store/authStore';
import { Modal } from '../../components/ui/Modal';
import { formatDateTime } from '../../utils/floodUtils';
import { Plus, Edit2, Trash2, Users, Search, Download, Filter, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BARANGAYS = [
  'Bagong Silang', 'Balimbingan', 'Balubad', 'Caliraya', 'Concepcion',
  'Lewin', 'Maracta', 'Maytalang I', 'Maytalang II', 'Poblacion',
  'Primera Parang', 'Primera Pulo', 'Salac', 'Segunda Parang',
  'Segunda Pulo', 'Santo Niño', 'Wawa',
];

const EMPTY = {
  head_name: '', age: '', gender: '', members: 1, address: '',
  barangay: '', contact: '', arrival_date: new Date().toISOString().slice(0, 16), notes: '',
  members_list: [{ name: '', age: '', gender: '' }],
};

const inputClass = 'w-full bg-slate-100 border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500';

export default function MswdoEvacuees() {
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterBrgy, setFilterBrgy] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const [expandedRow, setExpandedRow] = useState(null);
  const [pdfPreview, setPdfPreview] = useState(null);

  const now = new Date();
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const [wlFilter, setWlFilter] = useState({
    type: 'month',
    month: now.getMonth(),
    year: now.getFullYear(),
    date: now.toISOString().slice(0, 10),
    week: `${now.getFullYear()}-W${String(Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 604800000)).padStart(2, '0')}`,
  });

  function getWeekRange(weekStr) {
    const [year, w] = weekStr.split('-W');
    const jan4 = new Date(year, 0, 4);
    const s1 = new Date(jan4);
    s1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
    const start = new Date(s1);
    start.setDate(s1.getDate() + (parseInt(w) - 1) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn: getEvacuationCenters,
    refetchInterval: 15000,
  });

  const center = centers.find(c => c.id === user?.evacuation_center_id) || centers[0];

  const { data: families = [], isLoading } = useQuery({
    queryKey: ['families', center?.id],
    queryFn: () => api.get(`/evacuation/${center?.id}/families`).then(r => r.data.data),
    enabled: !!center?.id,
    refetchInterval: 10000,
  });

  const dateFiltered = useMemo(() => {
    return (Array.isArray(families) ? families : []).filter(f => {
      if (!f.arrival_date) return false;
      const d = new Date(f.arrival_date);
      if (wlFilter.type === 'date') return d.toISOString().slice(0, 10) === wlFilter.date;
      if (wlFilter.type === 'week') {
        const { start, end } = getWeekRange(wlFilter.week);
        return d >= start && d <= end;
      }
      return d.getFullYear() === wlFilter.year && d.getMonth() === wlFilter.month;
    });
  }, [families, wlFilter]);

  const saveFamily = useMutation({
    mutationFn: (data) => editing
      ? api.patch(`/evacuation/${center?.id}/families/${editing.id}`, data).then(r => r.data.data)
      : api.post(`/evacuation/${center?.id}/families`, data).then(r => r.data.data),
    onSuccess: () => {
      toast.success(editing ? 'Record updated' : 'Evacuee record added');
      qc.invalidateQueries(['families']);
      qc.invalidateQueries(['evacuation']);
      setShowModal(false);
      setForm(EMPTY);
      setEditing(null);
    },
    onError: () => toast.error('Failed to save record'),
  });

  const deleteFamily = useMutation({
    mutationFn: (id) => api.delete(`/evacuation/${center?.id}/families/${id}`),
    onSuccess: () => {
      toast.success('Record removed');
      qc.invalidateQueries(['families']);
      qc.invalidateQueries(['evacuation']);
    },
    onError: () => toast.error('Failed to delete'),
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY); setShowModal(true); };
  const openEdit = (f) => {
    setEditing(f);
    setForm({
      head_name: f.head_name,
      age: f.age || '',
      gender: f.gender || '',
      members: f.members,
      address: f.address || '',
      barangay: f.barangay || '',
      contact: f.contact || '',
      arrival_date: f.arrival_date ? new Date(f.arrival_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      notes: f.notes || '',
      members_list: f.members_list?.length ? f.members_list.map(m => ({ name: m.name, age: m.age || '', gender: m.gender || '' })) : [{ name: '', age: '', gender: '' }],
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.head_name.trim()) { toast.error('Head of Family is required'); return; }
    const validMembers = form.members_list.filter(m => m.name.trim());
    saveFamily.mutate({
      ...form,
      age: form.age ? parseInt(form.age) : null,
      gender: form.gender || null,
      members: parseInt(form.members) || 1,
      members_list: validMembers.map(m => ({ name: m.name.trim(), age: m.age ? parseInt(m.age) : null, gender: m.gender || null })),
    });
  };

  const addMemberRow = () => setForm(f => ({ ...f, members_list: [...f.members_list, { name: '', age: '', gender: '' }], members: f.members_list.length + 1 }));
  const removeMemberRow = (i) => setForm(f => ({ ...f, members_list: f.members_list.filter((_, idx) => idx !== i), members: Math.max(1, f.members_list.length - 1) }));
  const updateMember = (i, field, val) => setForm(f => ({
    ...f,
    members_list: f.members_list.map((m, idx) => idx === i ? { ...m, [field]: val } : m),
  }));

  const filtered = (Array.isArray(families) ? families : []).filter(f => {
    const matchSearch = !search ||
      f.head_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.barangay?.toLowerCase().includes(search.toLowerCase()) ||
      f.address?.toLowerCase().includes(search.toLowerCase());
    const matchBrgy = !filterBrgy || f.barangay === filterBrgy;
    const matchGender = !filterGender || f.gender === filterGender;
    const age = f.age ? parseInt(f.age) : null;
    const matchAge = (!filterAgeMin || (age !== null && age >= parseInt(filterAgeMin))) &&
      (!filterAgeMax || (age !== null && age <= parseInt(filterAgeMax)));
    return matchSearch && matchBrgy && matchGender && matchAge;
  });

  const totalMembers = filtered.reduce((s, f) => s + (f.members || 0), 0);

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const nowStr = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
    const periodLabel = wlFilter.type === 'date' ? wlFilter.date
      : wlFilter.type === 'week' ? `Week ${wlFilter.week}`
        : `${MONTHS[wlFilter.month]} ${wlFilter.year}`;
    const exportRows = dateFiltered.filter(f => {
      const matchSearch = !search ||
        f.head_name?.toLowerCase().includes(search.toLowerCase()) ||
        f.barangay?.toLowerCase().includes(search.toLowerCase()) ||
        f.address?.toLowerCase().includes(search.toLowerCase());
      const matchBrgy = !filterBrgy || f.barangay === filterBrgy;
      return matchSearch && matchBrgy;
    });
    const exportTotal = exportRows.reduce((s, f) => s + (f.members || 0), 0);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('MSWDO — Evacuee Registry', 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Evacuation Center: ${center?.name || '—'}`, 14, 23);
    doc.text(`Period: ${periodLabel}`, 14, 29);
    doc.text(`Generated: ${nowStr}`, 14, 35);
    if (filterBrgy) doc.text(`Filter: Barangay ${filterBrgy}`, 14, 41);
    doc.text(`Total Families: ${exportRows.length}   Total Members: ${exportTotal}`, 14, filterBrgy ? 47 : 41);

    autoTable(doc, {
      startY: filterBrgy ? 52 : 46,
      head: [['#', 'Head of Family', 'Age', 'Gender', 'Address', 'Barangay', 'Members', 'Contact', 'Arrival Date', 'Family Members List']],
      body: exportRows.map((f, i) => [
        i + 1,
        f.head_name,
        f.age || '—',
        f.gender || '—',
        f.address || '—',
        f.barangay || '—',
        f.members,
        f.contact || '—',
        f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH') : '—',
        f.members_list?.length
          ? f.members_list.map((m, mi) => `${mi + 1}. ${m.name}${m.age ? ` (${m.age})` : ''}${m.gender ? ` [${m.gender}]` : ''}`).join('\n')
          : '—',
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: { 0: { cellWidth: 8 }, 5: { cellWidth: 16 }, 8: { cellWidth: 50 } },
    });

    const fileLabel = wlFilter.type === 'date' ? wlFilter.date
      : wlFilter.type === 'week' ? wlFilter.week
        : `${wlFilter.year}-${String(wlFilter.month + 1).padStart(2, '0')}`;
    const filename = `evacuees_${center?.name?.replace(/\s+/g, '_') || 'report'}_${fileLabel}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  return (
    <div className="space-y-6">
      <div className="page-header flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Evacuee Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {center?.name} · {filtered.length} families · {totalMembers} total members
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setShowFilter(v => !v)}
            className="flex items-center gap-2 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Filter size={15} /> Filter
          </button>
          {/* Period filter tabs */}
          {['month', 'date', 'week'].map(t => (
            <button key={t} onClick={() => setWlFilter(f => ({ ...f, type: t }))}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${wlFilter.type === t
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                }`}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
          {wlFilter.type === 'month' && (
            <>
              <select value={wlFilter.month} onChange={e => setWlFilter(f => ({ ...f, month: +e.target.value }))}
                className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={wlFilter.year} onChange={e => setWlFilter(f => ({ ...f, year: +e.target.value }))}
                className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}
          {wlFilter.type === 'date' && (
            <input type="date" value={wlFilter.date}
              onChange={e => setWlFilter(f => ({ ...f, date: e.target.value }))}
              className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
          {wlFilter.type === 'week' && (
            <input type="week" value={wlFilter.week}
              onChange={e => setWlFilter(f => ({ ...f, week: e.target.value }))}
              className="bg-slate-200 border border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          )}
          <button onClick={exportPDF}
            className="flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Download size={15} /> Export PDF
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={15} /> Add Evacuee
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Families', value: filtered.length, color: '#3b82f6' },
          { label: 'Total Members', value: totalMembers, color: '#22c55e' },
          { label: 'Center Capacity', value: `${center?.capacity_current || 0} / ${center?.capacity_total || 0}`, color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
            <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</div>
            <div className="text-2xl font-bold" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      {showFilter && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Barangay</label>
            <select value={filterBrgy} onChange={e => setFilterBrgy(e.target.value)}
              className="bg-slate-100 border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">All Barangays</option>
              {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Gender</label>
            <select value={filterGender} onChange={e => setFilterGender(e.target.value)}
              className="bg-slate-100 border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Age Range</label>
            <div className="flex items-center gap-2">
              <input type="number" min="0" max="120" placeholder="Min" value={filterAgeMin}
                onChange={e => setFilterAgeMin(e.target.value)}
                className="w-20 bg-slate-100 border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500" />
              <span className="text-slate-500 text-xs">–</span>
              <input type="number" min="0" max="120" placeholder="Max" value={filterAgeMax}
                onChange={e => setFilterAgeMax(e.target.value)}
                className="w-20 bg-slate-100 border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          {(filterBrgy || filterGender || filterAgeMin || filterAgeMax) && (
            <button onClick={() => { setFilterBrgy(''); setFilterGender(''); setFilterAgeMin(''); setFilterAgeMax(''); }}
              className="text-xs text-slate-700 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 dark:text-slate-400 dark:hover:text-white px-3 py-2 dark:bg-slate-700 rounded-lg transition-colors">
              Clear Filters
            </button>
          )}
          <div className="text-xs text-slate-500 self-center">
            Showing {filtered.length} of {families.length} records
          </div>
        </div>
      )}

      {/* Search + Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-700 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" placeholder="Search by name or barangay..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-100 border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <span className="text-xs text-slate-500">{filtered.length} records</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Loading records...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Users size={32} className="mb-3 opacity-30" />
            <p className="text-sm">No evacuee records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  {['#', 'Head of Family', 'Age', 'Gender', 'Address', 'Barangay', 'Members', 'Contact', 'Arrival Date', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((f, i) => (
                  <Fragment key={f.id}>
                    <tr className="hover:bg-slate-700/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === f.id ? null : f.id)}>
                      <td className="px-4 py-3 text-slate-500 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 text-xs">{expandedRow === f.id ? '▼' : '▶'}</span>
                          {f.head_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{f.age || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{f.gender || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">{f.address || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{f.barangay || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                          <Users size={12} /> {f.members}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{f.contact || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {f.arrival_date ? new Date(f.arrival_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(f)} className="text-slate-400 hover:text-blue-400 transition-colors p-1"><Edit2 size={13} /></button>
                          <button onClick={() => { if (window.confirm('Remove this record?')) deleteFamily.mutate(f.id); }}
                            className="text-slate-400 hover:text-red-400 transition-colors p-1"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === f.id && (
                      <tr className="bg-slate-900/50">
                        <td colSpan={10} className="px-8 py-3">
                          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Family Members</div>
                          {f.members_list?.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {f.members_list.map((m, mi) => (
                                <div key={mi} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
                                  <span className="text-xs text-slate-500 shrink-0">{mi + 1}.</span>
                                  <span className="text-sm text-white font-medium truncate">{m.name}</span>
                                  {m.age && <span className="text-xs text-slate-400 shrink-0">({m.age})</span>}
                                  {m.gender && <span className="text-xs text-slate-500 shrink-0">{m.gender}</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">No individual members listed.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl w-full max-w-5xl flex flex-col" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
              <span className="text-sm font-semibold text-white">PDF Preview — {pdfPreview.filename}</span>
              <div className="flex items-center gap-2">
                <a href={pdfPreview.url} download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <Download size={13} /> Download
                </a>
                <button onClick={() => setPdfPreview(null)} className="text-slate-400 hover:text-white transition-colors p-1">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe key={pdfPreview.url} src={pdfPreview.url} className="flex-1 w-full rounded-b-2xl" title="PDF Preview" />
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null); }}
        title={editing ? 'Edit Evacuee Record' : 'Add Evacuee Record'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-slate-400 block mb-1.5">Head of Family <span className="text-red-400">*</span></label>
              <input value={form.head_name} onChange={e => setForm(f => ({ ...f, head_name: e.target.value }))}
                placeholder="Full name" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Age</label>
              <input type="number" min="1" max="120" value={form.age}
                onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                placeholder="e.g. 45" className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Gender</label>
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                className={inputClass}>
                <option value="">— Select —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Total Family Members <span className="text-red-400">*</span></label>
              <input type="number" min="1" value={form.members}
                onChange={e => setForm(f => ({ ...f, members: e.target.value }))}
                className={inputClass} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Home Address <span className="text-red-400">*</span></label>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Street / Purok / Sitio" className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Home Barangay</label>
              <select value={form.barangay} onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))}
                className={inputClass}>
                <option value="">— Select barangay —</option>
                {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Contact Number</label>
              <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))}
                placeholder="+639XXXXXXXXX" className={inputClass} />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Arrival Date <span className="text-red-400">*</span></label>
            <input type="datetime-local" value={form.arrival_date}
              onChange={e => setForm(f => ({ ...f, arrival_date: e.target.value }))}
              className={inputClass} />
          </div>

          {/* Family Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Family Members</label>
              <button type="button" onClick={addMemberRow}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-1 bg-blue-900/30 rounded-lg">
                <Plus size={11} /> Add Member
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {form.members_list.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs text-slate-500 w-5 shrink-0">{i + 1}.</span>
                  <input type="text" placeholder="Name" value={m.name}
                    onChange={e => updateMember(i, 'name', e.target.value)}
                    className="flex-1 bg-slate-100 border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <input type="number" placeholder="Age" value={m.age}
                    onChange={e => updateMember(i, 'age', e.target.value)}
                    className="w-16 bg-slate-100 border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500" />
                  <select value={m.gender} onChange={e => updateMember(i, 'gender', e.target.value)}
                    className="w-24 bg-slate-100 border border-slate-300 text-slate-900 dark:bg-slate-900 dark:border-slate-600 dark:text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sex</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  {form.members_list.length > 1 && (
                    <button type="button" onClick={() => removeMemberRow(i)}
                      className="text-slate-500 hover:text-red-400 p-1">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Notes</label>
            <textarea value={form.notes} rows={2}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Special needs, medical conditions, etc."
              className={`${inputClass} resize-none`} />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => { setShowModal(false); setEditing(null); }}
              className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm py-2.5 rounded-xl transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={!form.head_name || saveFamily.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              {saveFamily.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Record'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
