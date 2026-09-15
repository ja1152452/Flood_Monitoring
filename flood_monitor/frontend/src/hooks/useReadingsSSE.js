import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useReadingsSSE(cameraId) {
  const qc             = useQueryClient();
  const lastInvalidate = useRef(0);

  useEffect(() => {
    if (!cameraId) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const url = `/api/v1/readings/live?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);

    es.addEventListener('reading', (e) => {
      try {
        const reading = JSON.parse(e.data);
        qc.setQueryData(['latest-reading'], reading);
        qc.setQueryData(['history', cameraId], (old) => {
          if (!old?.data) return old;
          return { ...old, data: [reading, ...old.data].slice(0, 48) };
        });

        // Throttle query invalidations (trend, rate-of-rise) to at most once per 10s
        const now = Date.now();
        if (now - lastInvalidate.current > 10000) {
          lastInvalidate.current = now;
          qc.invalidateQueries({ queryKey: ['trend'] });
          qc.invalidateQueries({ queryKey: ['rate-of-rise'] });
          qc.invalidateQueries({ queryKey: ['active-alerts'] });
        }
      } catch (_) {}
    });

    es.onerror = () => {
      // Browser EventSource automatically reconnects silently in the background
      if (es.readyState === EventSource.CLOSED) {
        es.close();
      }
    };

    return () => {
      es.close();
    };
  }, [cameraId, qc]);
}
