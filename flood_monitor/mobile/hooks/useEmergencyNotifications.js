import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { getPendingSOS, getActiveBackups } from '../api/sos';
import { sendLocalNotification } from '../utils/notifications';

const RESPONDER_ROLES = ['PNP', 'BFP', 'RHU', 'MDRRMO', 'MDRRMO_RESPONDER', 'BARANGAY_OFFICIAL', 'RESCUE'];
const POLL_MS = 5000;

export function useEmergencyNotifications() {
  const { user, token } = useAuthStore();
  const seenSOS        = useRef(null);
  const seenDispatches = useRef(null);
  const seenBackups    = useRef(null);

  useEffect(() => {
    if (!user?.id || !token || !RESPONDER_ROLES.includes(user.role)) return;

    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const [sosList, backups] = await Promise.all([getPendingSOS(), getActiveBackups()]);

        // 1. Awareness Notifications for newly submitted rescue requests
        const sosIds = new Set(sosList.map(s => s.id));
        if (seenSOS.current === null) {
          seenSOS.current = sosIds;
        } else {
          for (const sos of sosList) {
            if (!seenSOS.current.has(sos.id) && sos.status === 'PENDING') {
              sendLocalNotification(
                '🆘 Emergency Alert',
                'New Rescue Request Received - Waiting for MDRRMO Dispatch.'
              );
            }
          }
          seenSOS.current = sosIds;
        }

        // 2. Actionable Dispatch Order Notifications for this specific responder
        // (Tracked silently to prevent duplicate notification chimes with backend FCM push)
        const myUserId = String(user?.id || '').toLowerCase().trim();

        const myDispatches = sosList.filter(sos => {
          if (String(sos.assigned_rescue_id || '').toLowerCase().trim() === myUserId) return true;
          const rawDispatches = sos.dispatched_responders;
          const dispatchedList = Array.isArray(rawDispatches)
            ? rawDispatches
            : (typeof rawDispatches === 'string' ? JSON.parse(rawDispatches || '[]') : []);
          return dispatchedList.some(dr => String(dr.responder_id || dr.id || '').toLowerCase().trim() === myUserId && dr.status !== 'DECLINED');
        });

        const dispatchIds = new Set(myDispatches.map(s => `${s.id}-${s.status}`));
        seenDispatches.current = dispatchIds;

        // 3. Backup Alerts
        // (Tracked silently to prevent duplicate notification chimes with backend FCM push)
        const incoming = backups.filter(b => String(b.requester_id || '').toLowerCase().trim() !== myUserId);
        const backupIds = new Set(incoming.map(b => b.id));
        seenBackups.current = backupIds;
      } catch (_) {}
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
      seenSOS.current = null;
      seenDispatches.current = null;
      seenBackups.current = null;
    };
  }, [user?.id, user?.role, token]);
}
