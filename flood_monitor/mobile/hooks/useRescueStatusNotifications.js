import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { getMySOS } from '../api/sos';
import { sendLocalNotification } from '../utils/notifications';

const POLL_MS = 3000;

const STATUS_MESSAGES = {
  ACKNOWLEDGED: {
    title: '👀 SOS Acknowledged',
    body:  'Your rescue request has been received by MDRRMO.',
  },
  DISPATCHED: {
    title: '🚨 Responder Dispatched',
    body:  'MDRRMO has assigned a rescue team to your location.',
  },
  RESPONDING: {
    title: '🚑 Rescuer On The Way!',
    body:  'A rescuer has accepted your request and is heading to your location.',
  },
  COMPLETED: {
    title: '✅ Rescue Completed',
    body:  'Your rescue operation has been completed. Stay safe!',
  },
};

export function useRescueStatusNotifications() {
  const { user, token } = useAuthStore();
  const prevStatusMap = useRef({});

  useEffect(() => {
    if (!user?.id || !token) return;

    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const requests = await getMySOS();
        if (!requests || !Array.isArray(requests)) return;

        for (const r of requests) {
          const prev = prevStatusMap.current[r.id];
          const curr = r.status;

          if (prev !== undefined && prev !== curr) {
            const msg = STATUS_MESSAGES[curr];
            if (msg) {
              sendLocalNotification(msg.title, msg.body);
            }
          }
          prevStatusMap.current[r.id] = curr;
        }
      } catch (_) {}
    };

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user?.id, token]);
}
