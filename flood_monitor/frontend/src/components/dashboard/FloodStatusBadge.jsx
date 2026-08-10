import { getFloodConfig, shouldSiren } from '../../utils/floodUtils';

export function FloodStatusBadge({ level }) {
  const config  = getFloodConfig(level);
  const isSiren = shouldSiren(level);

  return (
    <div className={`rounded-2xl p-6 border-2 ${config.border} ${isSiren ? 'siren-pulse' : ''}`}
         style={{ backgroundColor: config.color + '22' }}>
      <div className="flex items-center gap-3 mb-2">
        {isSiren && (
          <span className="w-4 h-4 rounded-full bg-red-500 blink inline-block" />
        )}
        <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
          Flood Status
        </span>
      </div>
      <div className="text-3xl font-bold" style={{ color: config.color }}>
        {config.label}
      </div>
      {isSiren && (
        <div className="mt-2 text-sm text-red-400 font-medium">
          ⚠ Siren Active — Alerts Dispatched
        </div>
      )}
    </div>
  );
}