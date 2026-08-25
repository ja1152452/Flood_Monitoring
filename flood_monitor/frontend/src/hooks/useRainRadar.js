import { useState, useEffect } from 'react';
import axios from 'axios';

export function useRainRadar(enabled = true) {
  const [radarTimestamp, setRadarTimestamp] = useState(null);
  const [radarPath, setRadarPath] = useState(null);
  const [host, setHost] = useState('https://tilecache.rainviewer.com');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    async function fetchRadarData() {
      try {
        setLoading(true);
        const res = await axios.get('https://api.rainviewer.com/public/weather-maps.json', {
          timeout: 8000,
        });

        if (isMounted && res.data) {
          const radar = res.data.radar;
          if (radar?.past?.length > 0) {
            const latest = radar.past[radar.past.length - 1];
            setRadarTimestamp(latest.time);
            setRadarPath(latest.path);
            setHost(res.data.host || 'https://tilecache.rainviewer.com');
            setLastUpdated(new Date(latest.time * 1000));
            setError(null);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('[RainRadar] Weather maps fetch error:', err.message);
          setError(err.message);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchRadarData();
    // Poll every 5 minutes for new Doppler radar frames
    const interval = setInterval(fetchRadarData, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [enabled]);

  const tileUrl = radarPath
    ? `${host}${radarPath}`
    : radarTimestamp
    ? `${host}/v2/radar/${radarTimestamp}/256/{z}/{x}/{y}/4/1_1.png`
    : null;

  return {
    tileUrl,
    radarTimestamp,
    lastUpdated,
    loading,
    error,
  };
}
