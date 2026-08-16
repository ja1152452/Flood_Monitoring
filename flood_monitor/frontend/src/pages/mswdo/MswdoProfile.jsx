import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useQuery } from '@tanstack/react-query';
import { getEvacuationCenters } from '../../api/evacuation';
import { UserCircle, Lock, Building2 } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const inputClass = "w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-red-500 transition-colors shadow-sm";

export default function MswdoProfile() {
  const { user } = useAuthStore();
  const [pwForm, setPwForm] = useState({ current_password:'', new_password:'', confirm:'' });
  const [saving, setSaving] = useState(false);

  const { data: centers = [] } = useQuery({
    queryKey: ['evacuation'],
    queryFn:  getEvacuationCenters,
  });

  const center = centers.find(c => c.id === user?.evacuation_center_id);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('New passwords do not match'); return;
    }
    if (pwForm.new_password.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }
    setSaving(true);
    try {
      await api.patch('/auth/change-password', {
        current_password: pwForm.current_password,
        new_password:     pwForm.new_password,
      });
      toast.success('Password updated successfully');
      setPwForm({ current_password:'', new_password:'', confirm:'' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const pct = center
    ? Math.min(Math.round(((center.capacity_current || 0) / (center.capacity_total || 1)) * 100), 100)
    : 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5 font-medium">Manage your account information</p>
      </div>

      {/* Account info */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <UserCircle size={18} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Account Information</h3>
        </div>
        <div className="flex items-center gap-4 mb-5 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-sm">
            {user?.full_name?.charAt(0)?.toUpperCase() || 'M'}
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-white">{user?.full_name}</div>
            <div className="text-sm text-slate-600 dark:text-slate-400 font-medium">{user?.email}</div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-bold">MSWDO Admin</div>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label:'Full Name',  value: user?.full_name },
            { label:'Email',      value: user?.email },
            { label:'Role',       value: 'MSWDO Admin' },
            { label:'Phone',      value: user?.phone_number || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-32">{label}</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Assigned center */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <Building2 size={18} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Assigned Evacuation Center</h3>
        </div>
        {!center ? (
          <p className="text-slate-500 text-sm font-semibold">No evacuation center assigned. Contact MDRRMO Admin.</p>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {[
                { label:'Center Name',    value: center.name },
                { label:'Barangay',       value: center.barangay_name || center.barangay },
                { label:'Address',        value: center.address || '—' },
                { label:'Contact Person', value: center.contact_person || '—' },
                { label:'Contact Number', value: center.contact_number || '—' },
                { label:'Status',         value: center.is_open ? 'Open' : 'Closed',
                  valueColor: center.is_open ? '#16a34a' : '#64748b' },
              ].map(({ label, value, valueColor }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-slate-200 dark:border-slate-700 last:border-0">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 w-36">{label}</span>
                  <span className="text-sm font-bold" style={{ color: valueColor || 'rgb(var(--text-base))' }}>{value}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                <span>Occupancy</span>
                <span>{center.capacity_current || 0} / {center.capacity_total} ({pct}%)</span>
              </div>
              <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width:`${pct}%`, backgroundColor: pct >= 100 ? '#ef4444' : pct >= 75 ? '#f59e0b' : '#22c55e' }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Change password */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <Lock size={18} className="text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Change Password</h3>
        </div>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {[
            { label:'Current Password', key:'current_password', placeholder:'Enter current password' },
            { label:'New Password',     key:'new_password',     placeholder:'At least 8 characters'  },
            { label:'Confirm Password', key:'confirm',          placeholder:'Repeat new password'     },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">{label}</label>
              <input type="password" value={pwForm[key]} placeholder={placeholder}
                onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                className={inputClass} />
            </div>
          ))}
          <button type="submit" disabled={saving || !pwForm.current_password || !pwForm.new_password || !pwForm.confirm}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-sm">
            {saving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
