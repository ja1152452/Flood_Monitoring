import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUsers, createUser, updateUser, deactivateUser, deleteUser } from '../api/users';
import { getEvacuationCenters } from '../api/evacuation';
import { Modal } from '../components/ui/Modal';
import toast from 'react-hot-toast';
import { Plus, Edit2, UserX, UserCheck, Search, Trash2, FileDown, X } from 'lucide-react';
import { formatDateTime } from '../utils/floodUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BARANGAYS = [
  'Bagong Silang','Balimbingan','Balubad','Caliraya','Concepcion',
  'Lewin','Maracta','Maytalang I','Maytalang II','Poblacion',
  'Primera Parang','Primera Pulo','Salac','Segunda Parang',
  'Segunda Pulo','Santo Niño','Wawa',
];

// Maps the dropdown role value directly to DB role
const ROLE_OPTIONS = [
  { value: 'PNP',               label: 'PNP (Police)',      needsBarangay: false },
  { value: 'BFP',               label: 'BFP (Fire)',        needsBarangay: false },
  { value: 'RHU',               label: 'RHU (Health)',      needsBarangay: false },
  { value: 'MDRRMO',            label: 'MDRRMO',            needsBarangay: false },
  { value: 'MDRRMO_RESPONDER',  label: 'MDRRMO Responder',  needsBarangay: false },
  { value: 'BARANGAY_OFFICIAL', label: 'Barangay Official', needsBarangay: true  },
  { value: 'MSWDO',             label: 'MSWDO Admin',       needsBarangay: false },
  { value: 'ADMIN',             label: 'MDRRMO Admin',      needsBarangay: false },
  { value: 'SUPER_ADMIN',       label: 'Super Admin',       needsBarangay: false },
];

const getRoleOption = (value) => ROLE_OPTIONS.find(r => r.value === value) || ROLE_OPTIONS[4];

const ROLE_CONFIG = {
  SUPER_ADMIN:       { label: 'Super Admin',       bg: 'bg-purple-100 dark:bg-purple-950/70', text: 'text-purple-800 dark:text-purple-300' },
  ADMIN:             { label: 'MDRRMO Admin',       bg: 'bg-red-100 dark:bg-red-950/70',   text: 'text-red-800 dark:text-red-300'    },
  MSWDO:             { label: 'MSWDO Admin',        bg: 'bg-blue-100 dark:bg-blue-950/70',  text: 'text-blue-800 dark:text-blue-300'   },
  PNP:               { label: 'PNP (Police)',       bg: 'bg-blue-800 dark:bg-blue-900',       text: 'text-white' },
  BFP:               { label: 'BFP (Fire)',         bg: 'bg-orange-500 dark:bg-orange-600',   text: 'text-white' },
  RHU:               { label: 'RHU (Health)',       bg: 'bg-green-600 dark:bg-green-700',     text: 'text-white' },
  MDRRMO:            { label: 'MDRRMO',             bg: 'bg-red-600 dark:bg-red-700',         text: 'text-white' },
  MDRRMO_RESPONDER:  { label: 'MDRRMO Responder',   bg: 'bg-red-600 dark:bg-red-700',         text: 'text-white' },
  BARANGAY_OFFICIAL: { label: 'Barangay Official',  bg: 'bg-purple-800 dark:bg-purple-900',   text: 'text-white' },
  RESCUE:            { label: 'Responder',          bg: 'bg-sky-500 dark:bg-sky-600',         text: 'text-white' },
  CITIZEN:           { label: 'Resident',           bg: 'bg-slate-200 dark:bg-slate-700',     text: 'text-slate-800 dark:text-slate-300' },
};

const EMPTY = {
  full_name: '', email: '', password: '',
  roleOption: 'BARANGAY_OFFICIAL', barangay: '', phone_number: '',
  evacuation_center_id: '',
};

const inputCls = 'w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500 shadow-sm';

function FormFields({ form, setForm, isEdit, centers = [] }) {
  const opt = getRoleOption(form.roleOption);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Full Name *</label>
          <input className={inputCls} value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value.replace(/[^a-zA-Z\s.'-]/g, '') }))}
            placeholder="Full name" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Role *</label>
          <select className={inputCls} value={form.roleOption}
            onChange={e => setForm(f => ({ ...f, roleOption: e.target.value, barangay: '', evacuation_center_id: '' }))}>
            <optgroup label="Responders">
              <option value="PNP">PNP (Police)</option>
              <option value="BFP">BFP (Fire)</option>
              <option value="RHU">RHU (Health)</option>
              <option value="MDRRMO">MDRRMO</option>
              <option value="MDRRMO_RESPONDER">MDRRMO Responder</option>
              <option value="BARANGAY_OFFICIAL">Barangay Official</option>
              <option value="RESCUE">Responder</option>
              <option value="CITIZEN">Resident</option>
            </optgroup>
            <optgroup label="Admin">
              <option value="MSWDO">MSWDO Admin</option>
              <option value="ADMIN">MDRRMO Admin</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </optgroup>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 block mb-1">Email Address *</label>
        <input className={inputCls} value={form.email} type="email"
          disabled={isEdit}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="email@lumban.gov.ph"
          style={isEdit ? { opacity: 0.5, cursor: 'not-allowed' } : {}} />
      </div>

      {!isEdit && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">Password *</label>
          <input className={inputCls} value={form.password} type="password"
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Minimum 8 characters" />
        </div>
      )}

      {isEdit && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">New Password (leave blank to keep)</label>
          <input className={inputCls} value={form.password} type="password"
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Leave blank to keep current password" />
        </div>
      )}

      {/* Evacuation center picker — only for MSWDO */}
      {form.roleOption === 'MSWDO' && (
        <div>
          <label className="text-xs text-slate-400 block mb-1">Assigned Evacuation Center *</label>
          <select className={inputCls} value={form.evacuation_center_id}
            onChange={e => setForm(f => ({ ...f, evacuation_center_id: e.target.value }))}>
            <option value="">— Select evacuation center —</option>
            {centers.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.barangay_name || c.barangay})</option>
            ))}
          </select>
          {!form.evacuation_center_id && (
            <p className="text-xs text-amber-400 mt-1">⚠ MSWDO Admin must be assigned to an evacuation center.</p>
          )}
        </div>
      )}

      {/* Barangay — only for BARANGAY_OFFICIAL and CITIZEN */}
      {['BARANGAY_OFFICIAL','CITIZEN'].includes(form.roleOption) ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              {'Barangay '}{form.roleOption === 'BARANGAY_OFFICIAL'
                ? <span className="text-red-400">*</span>
                : <span className="text-slate-600">(optional)</span>}
            </label>
            <select className={inputCls} value={form.barangay}
              onChange={e => setForm(f => ({ ...f, barangay: e.target.value }))}>
              <option value="">— Select barangay —</option>
              {BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Phone Number (09XXXXXXXXX)</label>
            <input className={inputCls} value={form.phone_number}
              maxLength={11}
              onChange={e => setForm(f => ({ ...f, phone_number: e.target.value.replace(/[^0-9]/g, '').slice(0, 11) }))}
              placeholder="09171234567" />
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs text-slate-400 block mb-1">Phone Number (09XXXXXXXXX)</label>
          <input className={inputCls} value={form.phone_number}
            maxLength={11}
            onChange={e => setForm(f => ({ ...f, phone_number: e.target.value.replace(/[^0-9]/g, '').slice(0, 11) }))}
            placeholder="09171234567" />
        </div>
      )}

      {opt.needsBarangay && !form.barangay && (
        <div className="text-xs text-amber-400 bg-amber-900/20 rounded-lg px-3 py-2">
          ⚠ Barangay Officials must have a barangay assigned.
        </div>
      )}
    </div>
  );
}

export default function Users() {
  const qc = useQueryClient();

  const [search,   setSearch]   = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page,     setPage]     = useState(1);
  const [showAdd,  setShowAdd]  = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [pdfPreview,   setPdfPreview]   = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter, page],
    queryFn:  () => getUsers({ search: search || undefined, role: roleFilter || undefined, page, limit: 20 }),
    keepPreviousData: true,
  });

  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn:  getEvacuationCenters,
  });

  const users = data?.data || [];
  const meta  = data?.meta || {};

  const create = useMutation({
    mutationFn: createUser,
    onSuccess:  () => {
      toast.success('User created successfully');
      qc.invalidateQueries(['users']);
      setShowAdd(false);
      setForm(EMPTY);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to create user'),
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess:  () => {
      toast.success('User updated');
      qc.invalidateQueries(['users']);
      setShowEdit(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Update failed'),
  });

  const deactivate = useMutation({
    mutationFn: deactivateUser,
    onSuccess:  () => { toast.success('User deactivated'); qc.invalidateQueries(['users']); },
    onError:    () => toast.error('Failed'),
  });

  const activate = useMutation({
    mutationFn: (id) => updateUser(id, { is_active: true }),
    onSuccess:  () => { toast.success('User activated'); qc.invalidateQueries(['users']); },
    onError:    () => toast.error('Failed to activate user'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess:  () => { toast.success('User permanently deleted'); qc.invalidateQueries(['users']); setDeleteTarget(null); },
    onError: (e) => toast.error(e.response?.data?.message || 'Delete failed'),
  });

  const handleCreate = () => {
    const opt = getRoleOption(form.roleOption);
    if (!form.full_name || !form.email || !form.password) {
      toast.error('Full name, email, and password are required');
      return;
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(form.full_name.trim())) {
      toast.error('Full name must contain alphabetic letters and valid text symbols only');
      return;
    }
    if (form.phone_number && !/^09\d{9}$/.test(form.phone_number.trim())) {
      toast.error('Contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (form.roleOption === 'MSWDO' && !form.evacuation_center_id) {
      toast.error('MSWDO Admin must be assigned to an evacuation center');
      return;
    }
    if (opt.needsBarangay && !form.barangay) {
      toast.error('Barangay Officials must have a barangay assigned');
      return;
    }
    const payload = {
      full_name: form.full_name.trim(),
      email:     form.email.trim(),
      password:  form.password,
      role:      form.roleOption,
    };
    if (form.phone_number)         payload.phone_number         = form.phone_number.trim();
    if (form.barangay)             payload.barangay             = form.barangay;
    if (form.evacuation_center_id) payload.evacuation_center_id = form.evacuation_center_id;
    create.mutate(payload);
  };

  const handleUpdate = () => {
    if (!form.full_name || form.full_name.trim().length < 2) {
      toast.error('Full name must be at least 2 characters');
      return;
    }
    if (!/^[a-zA-Z\s.'-]+$/.test(form.full_name.trim())) {
      toast.error('Full name must contain alphabetic letters and valid text symbols only');
      return;
    }
    if (form.phone_number && !/^09\d{9}$/.test(form.phone_number.trim())) {
      toast.error('Contact number must be an 11-digit Philippine mobile number starting with 09 (e.g. 09171234567)');
      return;
    }
    const opt = getRoleOption(form.roleOption);
    if (form.roleOption === 'MSWDO' && !form.evacuation_center_id) {
      toast.error('MSWDO Admin must be assigned to an evacuation center');
      return;
    }
    if (opt.needsBarangay && !form.barangay) {
      toast.error('Barangay Officials must have a barangay assigned');
      return;
    }
    const payload = { full_name: form.full_name.trim() };
    if (form.roleOption !== editItem.role) payload.role = form.roleOption;
    if (form.phone_number !== undefined)         payload.phone_number         = form.phone_number.trim() || null;
    if (form.barangay !== undefined)             payload.barangay             = form.barangay;
    if (form.evacuation_center_id !== undefined) payload.evacuation_center_id = form.evacuation_center_id;
    if (form.password)                           payload.password             = form.password;
    update.mutate({ id: editItem.id, data: payload });
  };

  const openEdit = (user) => {
    setEditItem(user);
    setForm({
      full_name:            user.full_name || '',
      email:                user.email,
      password:             '',
      roleOption:           user.role,
      barangay:             user.barangay_name || '',
      phone_number:         user.phone_number || '',
      evacuation_center_id: user.evacuation_center_id || '',
    });
    setShowEdit(true);
  };

  const confirmDeactivate = (user) => {
    if (window.confirm(`Deactivate account for ${user.full_name || user.email}?`)) {
      deactivate.mutate(user.id);
    }
  };

  const handleExportPDF = async () => {
    const allUsers = await getUsers({ role: roleFilter || undefined, limit: 9999 });
    const rows = allUsers?.data || [];
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('User List', 14, 15);
    doc.setFontSize(9);
    doc.setTextColor(120);
    const roleLabel = roleFilter ? (ROLE_CONFIG[roleFilter]?.label || roleFilter) : 'All Roles';
    doc.text(`Role: ${roleLabel}  ·  Total: ${rows.length}`, 14, 22);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);
    autoTable(doc, {
      startY: 32,
      head: [['Name', 'Email', 'Role', 'Barangay / Center', 'Phone', 'Status', 'Joined']],
      body: rows.map(u => [
        u.full_name || '—',
        u.email,
        ROLE_CONFIG[u.role]?.label || u.role,
        u.role === 'MSWDO' ? (u.evacuation_center_name || '—') : (u.barangay_name || '—'),
        u.phone_number || '—',
        u.is_active ? 'Active' : 'Inactive',
        formatDateTime(u.created_at),
      ]),
      styles: { fontSize: 8, textColor: [0, 0, 0] },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    });
    const filename = `users-${roleFilter || 'all'}-${new Date().toISOString().slice(0,10)}.pdf`;
    setPdfPreview({ url: doc.output('bloburl'), filename });
  };

  return (
    <div className="space-y-5">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">User Management</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
            {meta.total || 0} total registered users
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors border border-slate-300 dark:border-slate-600 shadow-sm">
            <FileDown size={16} />
            Export PDF
          </button>
          <button
            onClick={() => { setForm(EMPTY); setShowAdd(true); }}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
            <Plus size={16} />
            Add User
          </button>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-48 relative">
          <Search size={14} className="absolute left-3 top-3.5 text-slate-400" />
          <input
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500 shadow-sm"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email..."
          />
        </div>
        <select
          className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500 shadow-sm"
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="ADMIN">MDRRMO Admin</option>
          <option value="MSWDO">MSWDO Admin</option>
          <option value="PNP">PNP (Police)</option>
          <option value="BFP">BFP (Fire)</option>
          <option value="RHU">RHU (Health)</option>
          <option value="MDRRMO">MDRRMO</option>
          <option value="MDRRMO_RESPONDER">MDRRMO Responder</option>
          <option value="BARANGAY_OFFICIAL">Barangay Official</option>
          <option value="RESCUE">Responder</option>
          <option value="CITIZEN">Resident</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">User</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Role</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Barangay</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Phone</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Joined</th>
              <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-semibold">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-semibold">No users found</td></tr>
            ) : (
              users.map(user => {
                const rc = ROLE_CONFIG[user.role] || ROLE_CONFIG.CITIZEN;
                return (
                  <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">{user.full_name || '—'}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{user.email}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${rc.bg} ${rc.text}`}>
                        {rc.label || user.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 dark:text-slate-200 text-xs font-medium">
                      {user.role === 'MSWDO'
                        ? (user.evacuation_center_name
                            ? <span className="text-blue-600 dark:text-blue-400 font-bold">{user.evacuation_center_name}</span>
                            : <span className="text-amber-600 dark:text-amber-400 font-medium">No center assigned</span>)
                        : (user.barangay_name || <span className="text-slate-400">—</span>)
                      }
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 text-xs font-mono font-medium">
                      {user.phone_number || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        user.is_active
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-green-900/50 dark:text-green-400'
                          : 'bg-rose-100 text-rose-800 dark:bg-red-900/50 dark:text-red-400'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400 text-xs font-medium">
                      {formatDateTime(user.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                          <Edit2 size={14} />
                        </button>
                        {user.is_active ? (
                          <button
                            onClick={() => confirmDeactivate(user)}
                            title="Deactivate account"
                            className="text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                            <UserX size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => activate.mutate(user.id)}
                            title="Activate account"
                            className="text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                            <UserCheck size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(user)}
                          title="Delete permanently"
                          className="text-slate-400 hover:text-red-600 dark:hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {meta.pages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 dark:border-slate-700">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Page {meta.page} of {meta.pages} · {meta.total} total
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="text-sm px-3.5 py-1.5 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 rounded-xl dark:text-white font-bold transition-colors shadow-sm">
                Previous
              </button>
              <button
                disabled={page >= meta.pages}
                onClick={() => setPage(p => p + 1)}
                className="text-sm px-3.5 py-1.5 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 rounded-xl dark:text-white font-bold transition-colors shadow-sm">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit User">
        <FormFields form={form} setForm={setForm} isEdit={true} centers={centers} />
        <div className="flex gap-3 pt-4">
          <button onClick={() => setShowEdit(false)}
            className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm py-2.5 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={handleUpdate} disabled={update.isPending}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl">
            {update.isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add New User">
        <FormFields form={form} setForm={setForm} isEdit={false} centers={centers} />
        <div className="flex gap-3 pt-4">
          <button onClick={() => setShowAdd(false)}
            className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm py-2.5 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={create.isPending}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl">
            {create.isPending ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete User">
        <div className="space-y-4">
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4">
            <p className="text-sm text-red-300 font-medium">⚠ This action is permanent and cannot be undone.</p>
          </div>
          <p className="text-sm text-slate-300">
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold text-white">{deleteTarget?.full_name || deleteTarget?.email}</span>?
          </p>
          <p className="text-xs text-slate-500">All data associated with this account will be removed from the system.</p>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDeleteTarget(null)}
              className="flex-1 bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white text-sm py-2.5 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl">
              {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete Permanently'}
            </button>
          </div>
        </div>
      </Modal>

      {/* PDF Preview Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl" style={{ height: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <span className="text-sm font-semibold text-slate-800 dark:text-white">PDF Preview — {pdfPreview.filename}</span>
              <div className="flex items-center gap-2">
                <a href={pdfPreview.url} download={pdfPreview.filename}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <FileDown size={13} /> Download
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

    </div>
  );
}