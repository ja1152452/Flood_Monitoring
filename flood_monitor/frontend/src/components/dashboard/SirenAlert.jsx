import { useEffect, useRef, useState } from 'react';
import { shouldSiren, getFloodConfig } from '../../utils/floodUtils';
import { Volume2, VolumeX, Bell } from 'lucide-react';

export function SirenAlert({ level }) {
  const [muted,     setMuted]     = useState(false);
  const [unlocked,  setUnlocked]  = useState(false);
  const audioRef  = useRef(null);

  const active  = shouldSiren(level);
  const config  = getFloodConfig(level);

  const handleUnlock = () => {
    setUnlocked(true);
    if (active && !muted && audioRef.current) {
      audioRef.current.play().catch(e => console.error('Siren play error:', e));
    }
  };

  useEffect(() => {
    const handleUserGesture = () => {
      setUnlocked(true);
    };
    window.addEventListener('click', handleUserGesture, { once: true });
    window.addEventListener('keydown', handleUserGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    
    if (active && unlocked && !muted) {
      audioRef.current.play().catch(e => console.error('Siren play error:', e));
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [active, muted, unlocked, level]);

  if (!active) return null;

  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 border siren-pulse`}
      style={{
        backgroundColor: config.color + '15',
        borderColor:     config.color + '60',
      }}>
      <audio ref={audioRef} src="/tornado-siren.mp3" loop />
      
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full blink" style={{ backgroundColor: '#ef4444' }} />
        <div>
          <span className="font-bold text-sm" style={{ color: config.color }}>
            🚨 SIREN ACTIVE — {config.label.toUpperCase()}
          </span>
          <div className="text-xs text-slate-400 mt-0.5">
            Alerts have been dispatched to all users
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {!unlocked && (
          <button
            onClick={handleUnlock}
            className="flex items-center gap-1.5 text-xs bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors"
            title="Click to enable siren sound">
            <Bell size={12} />
            Enable Siren
          </button>
        )}
        <button
          onClick={() => {
            setMuted(m => !m);
            if (audioRef.current) {
              if (!muted) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              } else if (unlocked) {
                audioRef.current.play().catch(e => console.error('Siren play error:', e));
              }
            }
          }}
          className="text-slate-400 hover:text-white transition-colors p-1.5"
          title={muted ? 'Unmute siren' : 'Mute siren'}>
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
}