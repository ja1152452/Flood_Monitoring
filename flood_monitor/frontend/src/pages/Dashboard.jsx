import { useQuery } from '@tanstack/react-query';
import { getLatestReading, getTrend, getReadingHistory, getRateOfRise } from '../api/readings';
import { getActiveAlerts } from '../api/alerts';
import { getSummary } from '../api/analytics';
import { getWeather } from '../api/weather';
import { WaterLevelChart } from '../components/dashboard/WaterLevelChart';
import { LiveCameraFeed } from '../components/dashboard/LiveCameraFeed';
import { SirenAlert } from '../components/dashboard/SirenAlert';
import { FloodBadge } from '../components/ui/Badge';
import { formatDateTime, formatTime, getFloodConfig, shouldSiren } from '../utils/floodUtils';
import { TrendingUp, TrendingDown, Minus, Waves } from 'lucide-react';
import { useReadingsSSE } from '../hooks/useReadingsSSE';
import { useThemeStore } from '../store/themeStore';
import { useSimulationStore } from '../store/simulationStore';
import { classifySimulatedLevel } from '../utils/waterSimulationUtils';

const CAMERA_ID = '3b7e2b66-d4d5-4ae9-be3f-1c7c31e5b03f';

function WeatherCard({ weather }) {
  if (!weather) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-5 shadow-md h-full">
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
          Weather — Lumban, Laguna
        </div>
        <div className="flex items-center justify-center h-32 text-slate-600 dark:text-slate-400 text-sm font-medium">
          Loading weather data...
        </div>
      </div>
    );
  }

  const ICON_MAP = {
    'Sunny': '☀️', 'Clear': '🌙', 'Partly cloudy': '⛅', 'Cloudy': '☁️',
    'Overcast': '☁️', 'Mist': '🌫️', 'Fog': '🌫️',
    'Light rain': '🌦️', 'Moderate rain': '🌧️', 'Heavy rain': '⛈️',
    'Thundery outbreaks': '⛈️', 'Patchy rain': '🌦️',
  };

  const icon = Object.entries(ICON_MAP).find(([k]) =>
    weather.description?.toLowerCase().includes(k.toLowerCase())
  )?.[1] || '🌤️';

  const uvLabel = weather.uv <= 2 ? 'Low'
    : weather.uv <= 5 ? 'Moderate'
      : weather.uv <= 7 ? 'High'
        : 'Very High';

  const weatherItems = [
    { icon: '💧', value: `${weather.humidity}%`, label: 'Humidity' },
    { icon: '🌧', value: `${weather.rain} mm`, label: 'Rainfall' },
    { icon: '💨', value: `${weather.wind} kph`, label: 'Wind Speed' },
    { icon: '🌡', value: `UV ${weather.uv} · ${uvLabel}`, label: 'UV Index' },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-5 shadow-md h-full flex flex-col">
      <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
        Weather — Lumban, Laguna
      </div>

      <div className="flex items-center gap-4 pb-4 mb-4 border-b border-slate-200 dark:border-slate-700">
        <span style={{ fontSize: 40 }}>{icon}</span>
        <div>
          <div className="text-4xl font-black text-slate-900 dark:text-white">{weather.temp}°C</div>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
            {weather.description} · Feels {weather.feels_like}°C
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        {weatherItems.map(item => (
          <div
            key={item.label}
            className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-center gap-3">
            <span style={{ fontSize: 20, width: 24, textAlign: 'center' }}>{item.icon}</span>
            <div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">{item.value}</div>
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mt-0.5">{item.label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  useReadingsSSE(CAMERA_ID);

  const { mode, simWaterLevel, isSimRising, simRiseSpeed } = useSimulationStore();
  const isSimulation = mode === 'simulation';

  const { data: reading } = useQuery({
    queryKey: ['latest-reading'],
    queryFn: () => getLatestReading(CAMERA_ID),
    refetchInterval: 1000,
    retry: 1,
  });

  const { data: trend } = useQuery({
    queryKey: ['trend'],
    queryFn: () => getTrend(CAMERA_ID),
    refetchInterval: 2000,
    retry: 1,
  });

  const { data: rate } = useQuery({
    queryKey: ['rate-of-rise'],
    queryFn: () => getRateOfRise(CAMERA_ID),
    refetchInterval: 2000,
    retry: 1,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['active-alerts'],
    queryFn: getActiveAlerts,
    refetchInterval: 1000,
  });

  const { data: summary } = useQuery({
    queryKey: ['summary'],
    queryFn: getSummary,
    refetchInterval: 15000,
  });

  const { data: historyData } = useQuery({
    queryKey: ['history', CAMERA_ID],
    queryFn: () => getReadingHistory(CAMERA_ID, { limit: 48 }),
    refetchInterval: 30000,
  });

  const { data: weather } = useQuery({
    queryKey: ['weather'],
    queryFn: getWeather,
    refetchInterval: 300000,
    retry: 1,
  });

  // Effective Level (Real or Simulated)
  const simClassification = classifySimulatedLevel(simWaterLevel);
  const level = isSimulation ? simClassification.level : (reading?.flood_level || 'NORMAL');
  const config = getFloodConfig(level);
  const wl = isSimulation ? simWaterLevel : parseFloat(reading?.water_level_m || 0);

  const SEVERITY = ['NORMAL', 'MONITOR', 'ALERT', 'EVACUATION', 'CRITICAL'];
  const activeAlert = alerts.length
    ? alerts.reduce((worst, a) =>
      SEVERITY.indexOf(a.flood_level) > SEVERITY.indexOf(worst.flood_level) ? a : worst
    )
    : null;

  const simRateVal = isSimRising ? parseFloat((simRiseSpeed * 3600).toFixed(2)) : 0;
  const rateVal = isSimulation ? simRateVal : (rate?.rate_per_hour || 0);
  const rateSign = rateVal > 0 ? '+' : '';
  const effectiveTrend = isSimulation
    ? (isSimRising ? 'RISING' : 'STABLE')
    : (rate?.trend === 'FALLING' ? 'RECEDING' : (rate?.trend || 'STABLE'));
  const rateTrend = effectiveTrend;
  const rateColor = rateTrend === 'RISING' ? 'text-red-600 dark:text-red-400'
    : rateTrend === 'RECEDING' ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-slate-700 dark:text-slate-300';

  const trendName = effectiveTrend;

  const TrendIcon = trendName === 'RISING'
    ? TrendingUp
    : trendName === 'RECEDING'
      ? TrendingDown
      : Minus;

  const trendColor = trendName === 'RISING' ? 'text-red-600 dark:text-red-400'
    : trendName === 'RECEDING' ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-slate-700 dark:text-slate-300';

  const floodColorMap = {
    NORMAL: 'text-emerald-700 dark:text-emerald-400',
    MONITOR: 'text-amber-700 dark:text-amber-400',
    ALERT: 'text-orange-700 dark:text-orange-400',
    EVACUATION: 'text-red-700 dark:text-red-400',
    CRITICAL: 'text-purple-700 dark:text-purple-400',
  };
  const floodTextColor = floodColorMap[level] || 'text-emerald-700 dark:text-emerald-400';

  return (
    <div className="space-y-5">
      <div className="page-header flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Dashboard</h1>
            {isSimulation && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse">
                <Waves size={12} /> SIMULATION ACTIVE
              </span>
            )}
          </div>
          <p className="text-slate-700 dark:text-slate-300 text-sm font-semibold mt-0.5">
            Pagsanjan–Lumban River — Real-time Monitoring
          </p>
        </div>
        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm">
          {isSimulation ? 'Mode: Simulated Sandbox' : `Last update: ${formatDateTime(reading?.captured_at)}`}
        </div>
      </div>

      {/* Siren Alert Banner: triggers automatically for active live/manual alerts OR in simulation mode when reaching warning/critical thresholds */}
      {(activeAlert || (isSimulation && shouldSiren(level))) && (
        <SirenAlert level={activeAlert ? activeAlert.flood_level : level} isSimulated={!activeAlert && isSimulation} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Card 1: FLOOD STATUS */}
        <div className="bg-white dark:bg-slate-800 border-2 rounded-2xl p-5 shadow-md flex flex-col justify-between" style={{ borderColor: config.color }}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {(activeAlert || (isSimulation && level !== 'NORMAL')) && (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 blink inline-block" />
                )}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Flood Status
                </span>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md border uppercase tracking-wide ${
                isSimulation
                  ? 'bg-blue-100 dark:bg-blue-900/60 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
                  : 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200'
              }`}>
                {isSimulation ? '🧪 SIMULATED VIEW' : 'MDRRMO Standard'}
              </span>
            </div>

            {/* Status Label Badge - Ultra High Contrast */}
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border mb-3 shadow-sm" style={{
              backgroundColor: level === 'MONITOR' ? '#fef3c7' : level === 'ALERT' ? '#ffedd5' : level === 'EVACUATION' ? '#fee2e2' : level === 'CRITICAL' ? '#f3e8ff' : '#dcfce7',
              borderColor: level === 'MONITOR' ? '#f59e0b' : level === 'ALERT' ? '#f97316' : level === 'EVACUATION' ? '#ef4444' : level === 'CRITICAL' ? '#a855f7' : '#22c55e',
            }}>
              <div className="w-3.5 h-3.5 rounded-full" style={{
                backgroundColor: level === 'MONITOR' ? '#d97706' : level === 'ALERT' ? '#ea580c' : level === 'EVACUATION' ? '#dc2626' : level === 'CRITICAL' ? '#7e22ce' : '#16a34a'
              }} />
              <span className="text-2xl font-black tracking-wide" style={{
                color: level === 'MONITOR' ? '#92400e' : level === 'ALERT' ? '#9a3412' : level === 'EVACUATION' ? '#991b1b' : level === 'CRITICAL' ? '#6b21a8' : '#166534'
              }}>
                {config.label}
              </span>
            </div>

            {/* Compact Official Threshold Info */}
            <div className="mt-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600 dark:text-slate-400">MDRRMO Threshold:</span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {level === 'NORMAL' ? '< 3.1m' : level === 'MONITOR' ? '3.1m – 3.9m' : level === 'ALERT' ? '4.0m – 4.9m' : level === 'EVACUATION' ? '5.0m – 5.9m' : '≥ 6.0m'}
              </span>
            </div>

            {isSimulation && level !== 'NORMAL' && (
              <div className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-2.5 flex items-center gap-1">
                🧪 Simulated Threshold Breach ({wl.toFixed(2)}m)
              </div>
            )}
            {!isSimulation && activeAlert && (
              <div className="text-xs text-red-600 dark:text-red-400 font-bold mt-2.5 flex items-center gap-1">
                ⚠ Siren Active — Alerts Dispatched
              </div>
            )}
          </div>
          <div className="mt-4 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2.5">
            <span>📍 Lumban Bridge · CAM-LUMBAN-01</span>
          </div>
        </div>

        {/* Card 2: WATER LEVEL */}
        <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Water Level
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isSimulation ? 'Simulated Value' : formatTime(reading?.captured_at)}
              </span>
            </div>

            <div className="flex items-baseline gap-2 mb-2">
              <div className={`text-5xl font-black ${floodTextColor}`}>
                {wl.toFixed(2)}m
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 font-extrabold">
                ({(wl * 100).toFixed(0)} cm)
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <TrendIcon size={18} className={trendColor} />
              <span className={`text-sm font-black ${trendColor}`}>
                {trendName}
              </span>
              {isSimulation ? (
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  ({isSimRising ? `+${(simRiseSpeed * 3600).toFixed(2)} m/hr` : 'Holding Level'})
                </span>
              ) : (
                trend?.delta_m != null && (
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    ({trend.delta_m > 0 ? '+' : ''}{trend.delta_m?.toFixed(2)}m / {trend.delta_cm ?? Math.round(Math.abs(trend.delta_m) * 100)}cm)
                  </span>
                )
              )}
            </div>

            <div className="text-xs bg-slate-100 dark:bg-slate-900/90 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-700 dark:text-slate-300 font-bold">Time Interval:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {isSimulation ? 'Real-time Overlay' : (trend?.time_interval_text || '10 minutes')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-700 dark:text-slate-300 font-bold">Rate of Change:</span>
                <span className={`font-extrabold ${trendColor}`}>
                  {isSimulation ? (isSimRising ? `+${(simRiseSpeed * 3600).toFixed(2)} m/hr` : '0.00 m/hr') : (trend?.rate_text || `${rateVal.toFixed(2)} m/hr`)}
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2.5">
            <span>Confidence: {isSimulation ? '99% (Simulation)' : (reading?.confidence != null ? `${(reading.confidence * 100).toFixed(0)}%` : '--')}</span>
            <span className="text-[10px] text-slate-700 dark:text-slate-300 font-black uppercase">
              {isSimulation ? '🧪 SIMULATED FEED' : 'Real-time Stream'}
            </span>
          </div>
        </div>

        {/* Card 3: QUICK STATS */}
        <div className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-5 shadow-md flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Quick Stats
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <div className={`text-2xl font-black ${rateColor}`}>
                  {rateSign}{rateVal.toFixed(2)}
                  <span className="text-xs font-bold ml-1">m/hr</span>
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">Rate of Change</div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <div className={`text-2xl font-black ${alerts.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {alerts.length}
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">Active Alerts</div>
              </div>
            </div>
            <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {summary?.sos?.pending || 0} Pending SOS
                </div>
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                  {summary?.sos?.total || 0} total requests
                </div>
              </div>
              <span className="text-2xl">🆘</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <LiveCameraFeed cameraId={CAMERA_ID} />
        </div>
        <div className="lg:col-span-1">
          <WeatherCard weather={weather} />
        </div>
      </div>

      <WaterLevelChart data={historyData?.data || []} />

      {alerts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-4">
            Active Alerts
          </h3>
          <div className="space-y-3">
            {alerts.map(alert => {
              const acfg = getFloodConfig(alert.flood_level);
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 rounded-xl border shadow-sm"
                  style={{
                    backgroundColor: acfg.color + '15',
                    borderColor: acfg.color + '50',
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full blink" style={{ backgroundColor: acfg.color }} />
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{alert.location_name}</div>
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                        {alert.barangay_name} · {formatDateTime(alert.triggered_at)}
                        {alert.siren_active && (
                          <span className="ml-2 text-red-600 dark:text-red-400 font-bold">🔊 Siren Active</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <FloodBadge level={alert.flood_level} size="sm" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}