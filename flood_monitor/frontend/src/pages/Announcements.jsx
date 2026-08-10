import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAnnouncements, createAnnouncement, deactivateAnnouncement } from '../api/announcements';
import { formatDateTime } from '../utils/floodUtils';
import toast from 'react-hot-toast';
import { Send, X } from 'lucide-react';

export default function Announcements() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', message: '', type: 'GENERAL' });

  const { data: announcements = [] } = useQuery({
    queryKey: ['announcements'],
    queryFn:  getAnnouncements,
  });

  const create = useMutation({
    mutationFn: createAnnouncement,
    onSuccess:  () => {
      toast.success('Announcement sent to all users');
      setForm({ title: '', message: '', type: 'GENERAL' });
      qc.invalidateQueries(['announcements']);
    },
    onError: () => toast.error('Failed to send'),
  });

  const deactivate = useMutation({
    mutationFn: deactivateAnnouncement,
    onSuccess:  () => { toast.success('Removed'); qc.invalidateQueries(['announcements']); },
  });

  const TYPE_BADGE = {
    FLOOD_WARNING:    'bg-orange-500/15 text-orange-400',
    EVACUATION_ORDER: 'bg-red-500/15 text-red-400',
    ALL_CLEAR:        'bg-green-500/15 text-green-400',
    GENERAL:          'bg-blue-500/15 text-blue-400',
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="text-2xl font-bold text-white">MDRRMO Announcements</h1>
        <p className="text-slate-400 text-sm mt-0.5">Broadcast official messages to all mobile users</p>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Send Announcement</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Title</label>
              <input value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Announcement title"
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Type</label>
              <select value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-all">
                <option value="GENERAL">General</option>
                <option value="FLOOD_WARNING">Flood Warning</option>
                <option value="EVACUATION_ORDER">Evacuation Order</option>
                <option value="ALL_CLEAR">All Clear</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Message</label>
            <textarea value={form.message} rows={3}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Type your announcement here..."
              className="w-full bg-slate-900 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all resize-none"
            />
          </div>
          <button
            onClick={() => create.mutate(form)}
            disabled={!form.title || !form.message || create.isPending}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm">
            <Send size={14} />
            {create.isPending ? 'Sending...' : 'Send to All Users'}
          </button>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Active Announcements</h3>
          <span className="text-xs text-slate-500">{announcements.length} total</span>
        </div>
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id}
              className="flex items-start justify-between p-4 bg-slate-900 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-white">{a.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[a.type] || TYPE_BADGE.GENERAL}`}>
                    {a.type.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{a.message}</p>
                <p className="text-xs text-slate-600 mt-2">
                  By {a.created_by_name} • {formatDateTime(a.created_at)}
                </p>
              </div>
              <button onClick={() => deactivate.mutate(a.id)}
                className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all p-1.5 rounded-lg shrink-0">
                <X size={15} />
              </button>
            </div>
          ))}
          {announcements.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-4xl">📭</span>
              <p className="text-slate-400 text-sm font-medium">No active announcements</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}