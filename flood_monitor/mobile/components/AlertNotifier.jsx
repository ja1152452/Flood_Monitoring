import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getActiveAlerts } from '../api/alerts';
import { getEvacuationCenters } from '../api/evacuation';
import { FloodAlertModal } from './FloodAlertModal';
import { sendLocalNotification } from '../utils/notifications';

const LEVEL_CONFIG = {
  MONITOR:    { emoji: '🟡', label: 'Monitor Level',    title: '📢 MDRRMO ADVISORY: Monitor Level Reached', action: 'Please stay alert, secure essential belongings, and monitor official MDRRMO announcements.' },
  ALERT:      { emoji: '🟠', label: 'Alert Level',      title: '⚠️ MDRRMO WARNING: Alert Level Reached', action: 'Please prepare emergency kits, secure family members, and be ready to evacuate if instructed.' },
  EVACUATION: { emoji: '🔴', label: 'Evacuation Level', title: '🚨 MDRRMO EMERGENCY: Mandatory Evacuation Level', action: 'MANDATORY EVACUATION: Please evacuate immediately to your designated evacuation center.' },
  CRITICAL:   { emoji: '🟣', label: 'Critical Level',   title: '🆘 MDRRMO CRITICAL DANGER: Critical Flood Level', action: 'CRITICAL DANGER: Evacuate NOW to high ground or designated centers! Call SOS if trapped.' },
};

export function AlertNotifier() {
  const dismissedKeysRef = useRef(new Set());
  const notifiedKeysRef = useRef(new Set());
  const [currentAlert, setCurrentAlert] = useState(null);
  const [centers, setCenters] = useState([]);

  const { data: alerts = [] } = useQuery({
    queryKey:        ['active-alerts'],
    queryFn:         getActiveAlerts,
    refetchInterval: 1000,
  });

  useEffect(() => {
    if (!alerts.length) {
      // Water is NORMAL or alert cleared - reset dismissed keys so future alarms popup immediately
      if (dismissedKeysRef.current.size > 0 || notifiedKeysRef.current.size > 0) {
        dismissedKeysRef.current = new Set();
        notifiedKeysRef.current = new Set();
      }
      setCurrentAlert(null);
      return;
    }

    const alert = alerts[0];
    const alertKey = `${alert.id}_${alert.flood_level}`;

    // If this specific alert + level combination hasn't been dismissed by the user in this session, show popup
    if (!dismissedKeysRef.current.has(alertKey)) {
      // Fetch open evacuation centers for the modal
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

      // Trigger phone status bar heads-up sound & vibration banner
      if (!notifiedKeysRef.current.has(alertKey)) {
        notifiedKeysRef.current.add(alertKey);
        const cfg = LEVEL_CONFIG[alert.flood_level] || LEVEL_CONFIG.MONITOR;
        sendLocalNotification(
          cfg.title,
          `${cfg.action}\n\nWater level is at ${cfg.label}.`
        );
      }
    }
  }, [alerts]);

  const handleDismiss = () => {
    if (currentAlert) {
      const alertKey = `${currentAlert.id}_${currentAlert.flood_level}`;
      dismissedKeysRef.current.add(alertKey);
    }
    setCurrentAlert(null);
    setCenters([]);
  };

  return (
    <FloodAlertModal
      visible={!!currentAlert}
      level={currentAlert?.flood_level}
      alertData={currentAlert}
      centers={centers}
      onDismiss={handleDismiss}
    />
  );
}
