import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useReadingsSSE(cameraId) {
  const qc         = useQueryClient();
  const retryTimer = useRef(null);
  const abortRef   = useRef(null);

  useEffect(() => {
    if (!cameraId) return;

    let stopped = false;

    async function connect() {
      const token = localStorage.getItem('accessToken');
      if (!token || stopped) return;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/v1/readings/live?token=${encodeURIComponent(token)}`,
          { signal: controller.signal }
        );

        if (res.status === 401) {
          // Token invalid — stop retrying, let the axios interceptor handle logout
          return;
        }

        if (!res.ok || !res.body) {
          throw new Error(`SSE connect failed: ${res.status}`);
        }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let   buffer  = '';

        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          let eventType = 'message';
          let dataLine  = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLine = line.slice(5).trim();
            } else if (line === '' && dataLine) {
              if (eventType === 'reading') {
                try {
                  const reading = JSON.parse(dataLine);
                  qc.setQueryData(['latest-reading'], reading);
                  qc.setQueryData(['history', cameraId], (old) => {
                    if (!old?.data) return old;
                    return { ...old, data: [reading, ...old.data].slice(0, 48) };
                  });
                  qc.invalidateQueries({ queryKey: ['trend'] });
                  qc.invalidateQueries({ queryKey: ['rate-of-rise'] });
                  qc.invalidateQueries({ queryKey: ['active-alerts'] });
                  qc.invalidateQueries({ queryKey: ['summary'] });
                } catch (_) {}
              }
              eventType = 'message';
              dataLine  = '';
            }
          }
        }
      } catch (err) {
        if (stopped || err.name === 'AbortError') return;
        retryTimer.current = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer.current);
      abortRef.current?.abort();
    };
  }, [cameraId, qc]);
}
