import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActiveAlerts } from '../api/alerts';
import { getEvacuationCenters } from '../api/evacuation';
import { FloodAlertModal } from './FloodAlertModal';

const LEVEL_CONFIG = {
  MONITOR:    { emoji: '🟡', label: 'Monitor Level'    },
  ALERT:      { emoji: '🟠', label: 'Alert Level'      },
  EVACUATION: { emoji: '🔴', label: 'Evacuation Level' },
  CRITICAL:   { emoji: '🟣', label: 'Critical Level'   },
};

export function AlertNotifier() {
  const seenAlertIds = useRef(null);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [centers, setCenters] = useState([]);

  const { data: alerts = [] } = useQuery({
    queryKey:        ['active-alerts'],
    queryFn:         getActiveAlerts,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!alerts.length) {
      if (seenAlertIds.current !== null && seenAlertIds.current.size > 0) {
        seenAlertIds.current = new Set();
        setCurrentAlert(null);
      }
      return;
    }

    const currentIds = new Set(alerts.map(a => a.id));
    if (seenAlertIds.current === null) {
      seenAlertIds.current = currentIds;
      return;
    }

    const newAlerts = alerts.filter(a => !seenAlertIds.current.has(a.id));
    if (newAlerts.length > 0) {
      const alert = newAlerts[0];
      
      // Fetch evacuation centers for the modal
      getEvacuationCenters()
        .then(allCenters => {
          const availableCenters = (allCenters || [])
            .filter(c => c.is_open && c.capacity_current < c.capacity_total)
            .map(c => ({
              name: c.name,
              available_slots: c.capacity_total - c.capacity_current,
            }))
            .slice(0, 5);
          setCenters(availableCenters);
        })
        .catch(() => setCenters([]));

      setCurrentAlert(alert);
    }

    seenAlertIds.current = currentIds;
  }, [alerts]);

  const handleDismiss = () => {
    setCurrentAlert(null);
    setCenters([]);
  };

  return (
    <FloodAlertModal
      visible={!!currentAlert}
      level={currentAlert?.flood_level}
      centers={centers}
      onDismiss={handleDismiss}
    />
  );
}
