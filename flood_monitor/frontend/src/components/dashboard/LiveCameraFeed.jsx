import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Camera, WifiOff, RefreshCw, Radio, Maximize2, Minimize2, 
  Play, Pause, RotateCcw, Sliders, Waves, Activity, 
  Timer, Clock, CheckCircle2, ArrowRight, Layers 
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';
import { WaterSimulationOverlay } from './WaterSimulationOverlay';
import { 
  SIMULATION_PRESETS, 
  SCENARIO_PRESETS, 
  classifySimulatedLevel 
} from '../../utils/waterSimulationUtils';
import { useSimulationStore } from '../../store/simulationStore';

const STREAM_URL = '/api/v1/stream/index.m3u8';
const DEFAULT_YOUTUBE_ID = 'UCUiMNY4pfRHTpBIJIBcBRw'; // Live Channel ID

export function LiveCameraFeed() {
  const containerRef          = useRef(null);
  const videoViewportRef      = useRef(null);
  const videoRef              = useRef(null);
  const hlsRef                = useRef(null);
  const hlsStartedRef         = useRef(false);
  const [status, setStatus]   = useState('youtube'); // default to 'youtube' for centralized YouTube HD live stream
  const [youtubeId, setYoutubeId] = useState(() => {
    return localStorage.getItem('youtube_live_id') || DEFAULT_YOUTUBE_ID;
  });

  // --- Shared Simulation Store ---
  const {
    mode,
    setMode,
    simWaterLevel,
    setSimWaterLevel,
    isSimRising,
    setIsSimRising,
    simRiseSpeed,
    resetSimulation,
    // Scenario & Timer
    scenarioSubMode,
    setScenarioSubMode,
    scenarioStartMeters,
    setScenarioStartMeters,
    scenarioTargetMeters,
    setScenarioTargetMeters,
    scenarioDurationSec,
    setScenarioDurationSec,
    scenarioElapsedSec,
    scenarioIsRunning,
    scenarioPhase,
    scenarioIsCycle,
    setScenarioIsCycle,
    applyScenarioPreset,
    startScenario,
    pauseScenario,
    resetScenario,
    tickScenario,
  } = useSimulationStore();

  const [videoDims, setVideoDims] = useState({ width: 640, height: 360 });

  const changeYoutubeId = (e) => {
    if (e) e.stopPropagation();
    const input = prompt("Paste your current YouTube Live Video URL or Video ID:\n(e.g. https://www.youtube.com/watch?v=YOUR_VIDEO_ID)", youtubeId);
    if (input) {
      let id = input.trim();
      const match = id.match(/(?:v=|\/embed\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (match) id = match[1];
      setYoutubeId(id);
      localStorage.setItem('youtube_live_id', id);
    }
  };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState('/api/v1/stream/snapshot');
  const [snapshotAvailable, setSnapshotAvailable] = useState(false);

  // Measure video viewport size for overlay synchronization
  useEffect(() => {
    if (!videoViewportRef.current) return;
    const updateDims = () => {
      if (videoViewportRef.current) {
        const rect = videoViewportRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setVideoDims({ width: Math.round(rect.width), height: Math.round(rect.height) });
        }
      }
    };

    updateDims();
    const resizeObserver = new ResizeObserver(updateDims);
    resizeObserver.observe(videoViewportRef.current);
    window.addEventListener('resize', updateDims);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDims);
    };
  }, []);

  // Handle manual continuous water rise in simulation mode
  useEffect(() => {
    if (!isSimRising || mode !== 'simulation' || scenarioSubMode === 'scenario') return;

    const interval = setInterval(() => {
      setSimWaterLevel((prev) => {
        const next = prev + (simRiseSpeed * 0.05);
        if (next >= 7.0) {
          setIsSimRising(false);
          return 7.00;
        }
        return Math.round(next * 100) / 100;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isSimRising, mode, scenarioSubMode, simRiseSpeed, setIsSimRising, setSimWaterLevel]);

  // Handle Scenario & Timer tick
  useEffect(() => {
    if (mode !== 'simulation' || scenarioSubMode !== 'scenario' || !scenarioIsRunning) return;

    const interval = setInterval(() => {
      tickScenario(0.1);
    }, 100);

    return () => clearInterval(interval);
  }, [mode, scenarioSubMode, scenarioIsRunning, tickScenario]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshotUrl(`/api/v1/stream/snapshot?t=${Date.now()}`);
      setSnapshotAvailable(true);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const { data: streamStatus, refetch } = useQuery({
    queryKey:        ['stream-status'],
    queryFn:         () => api.get('/stream/status').then(r => r.data.data),
    refetchInterval: 5000,
  });

  const toggleFullscreen = () => {
    const elem = containerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const initHls = (video) => {
    if (!video) return;

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const hls = new Hls({
        enableWorker:           true,
        lowLatencyMode:         true,
        backBufferLength:       0,
        maxBufferLength:        4,
        maxMaxBufferLength:     8,
        liveSyncDurationCount:  1,
        liveMaxLatencyDurationCount: 3,
        manifestLoadingTimeOut: 3000,
        manifestLoadingMaxRetry: 2,
        levelLoadingTimeOut:    3000,
        fragLoadingTimeOut:     3000,
      });

      hls.loadSource(STREAM_URL);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        hlsStartedRef.current = true;
        setStatus('live');
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              hlsRef.current = null;
              setStatus('offline');
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = STREAM_URL;
      video.addEventListener('loadedmetadata', () => {
        setStatus('live');
        video.play().catch(() => {});
      });
      video.addEventListener('error', () => {
        setStatus('offline');
      });
    } else {
      setStatus('offline');
    }
  };

  const startStream = async () => {
    try {
      await api.post('/stream/start');
      refetch();
      setTimeout(() => {
        if (videoRef.current) initHls(videoRef.current);
      }, 2000);
    } catch {
      // Ignored
    }
  };

  const manualRetry = () => {
    hlsStartedRef.current = false;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    startStream();
  };

  const simClassification = classifySimulatedLevel(simWaterLevel);
  const scenarioProgress = scenarioDurationSec > 0 
    ? Math.min(100, Math.round((scenarioElapsedSec / scenarioDurationSec) * 100)) 
    : 0;
  const timeRemainingSec = Math.max(0, Math.ceil(scenarioDurationSec - scenarioElapsedSec));
  const formatSecs = (s) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-md flex flex-col overflow-hidden transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}>

      {/* Header Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <Camera size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Live CCTV — Pagsanjan–Lumban Bridge
              {mode === 'simulation' && (
                <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/40 px-2 py-0.5 rounded-full font-black animate-pulse">
                  SIMULATION ACTIVE
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500">Tapo C310 Outdoor CCTV · Water Level E-Staff Gauge</p>
          </div>
        </div>

        {/* Top Controls: Mode Switcher & Stream Source */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* LIVE MODE | SIMULATION MODE TOGGLE */}
          <div className="flex items-center bg-slate-200 dark:bg-slate-900 p-1 rounded-xl border border-slate-300 dark:border-slate-700 shadow-inner">
            <button
              onClick={() => setMode('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                mode === 'live'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}>
              <Radio size={12} className={mode === 'live' ? 'animate-pulse' : ''} />
              LIVE MODE
            </button>
            <button
              onClick={() => setMode('simulation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                mode === 'simulation'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}>
              <Waves size={12} />
              SIMULATION MODE
            </button>
          </div>

          {/* Stream Type / Source selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setStatus('youtube')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                status === 'youtube'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}>
              YouTube
            </button>
            <button
              onClick={() => setStatus('hls')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                status === 'hls' || status === 'live'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}>
              Direct HLS
            </button>
            <button
              onClick={() => setStatus('snapshot')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                status === 'snapshot'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}>
              Snapshot
            </button>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div 
        ref={videoViewportRef}
        className="relative flex-1 min-h-[320px] max-h-[500px] bg-black flex items-center justify-center overflow-hidden">
        
        {/* Source 1: YouTube Stream */}
        {status === 'youtube' && (
          <div className="relative w-full h-full min-h-[320px] max-h-[500px] flex items-center justify-center bg-black">
            {youtubeId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${
                  youtubeId.length === 11 ? youtubeId : `live_stream?channel=${youtubeId}`
                }?autoplay=1&mute=1&controls=1&modestbranding=1&playsinline=1&rel=0&enablejsapi=1`}
                title="Pagsanjan-Lumban River CCTV Stream"
                className="w-full h-full min-h-[320px] max-h-[500px] border-0 pointer-events-auto"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3">
                <p className="text-sm font-semibold">No YouTube Live URL Configured</p>
                <button
                  onClick={changeYoutubeId}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg shadow-md transition-all">
                  Set YouTube Stream
                </button>
              </div>
            )}
          </div>
        )}

        {/* Source 2: Direct HLS Stream */}
        {(status === 'hls' || status === 'live') && (
          <video
            ref={videoRef}
            className="w-full h-full object-contain max-h-[500px]"
            muted
            playsInline
            autoPlay
          />
        )}

        {/* Source 3: Snapshots */}
        {status === 'snapshot' && (
          <div className="relative w-full h-full flex items-center justify-center max-h-[500px]">
            {snapshotAvailable ? (
              <img
                src={snapshotUrl}
                alt="Live Camera Snapshot"
                className="w-full h-full object-contain max-h-[500px]"
                onError={() => setSnapshotAvailable(false)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <RefreshCw size={24} className="animate-spin" />
                <span className="text-xs">Fetching CCTV snapshot...</span>
              </div>
            )}
          </div>
        )}

        {/* WATER LEVEL SIMULATION OVERLAY (Mounts directly on top of real-time CCTV stream) */}
        {mode === 'simulation' && (
          <WaterSimulationOverlay
            width={videoDims.width}
            height={videoDims.height}
            waterLevelMeters={simWaterLevel}
            isActive={true}
            isRising={scenarioSubMode === 'scenario' ? scenarioPhase === 'rising' : isSimRising}
            confidence={0.99}
          />
        )}

        {/* Stream Badges Overlay (Top-Left) */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-20 pointer-events-none">
          {mode === 'simulation' ? (
            <span className="flex items-center gap-1.5 bg-blue-600/90 text-white text-[11px] font-black px-2.5 py-1 rounded-md shadow-lg backdrop-blur-sm border border-blue-400">
              <Waves size={12} className="animate-pulse" />
              SIMULATION OVERLAY
            </span>
          ) : (
            <span className="flex items-center gap-1.5 bg-red-600/90 text-white text-[11px] font-black px-2.5 py-1 rounded-md shadow-lg backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              LIVE CCTV
            </span>
          )}
          <span className="bg-black/60 text-slate-200 text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-sm">
            E-Staff Gauge Calibrated
          </span>
        </div>

        {/* Offline Overlay fallback */}
        {status === 'offline' && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 text-center text-slate-400 gap-3 z-10">
            <WifiOff size={32} className="text-red-500" />
            <div>
              <p className="text-sm font-semibold text-slate-200">Live CCTV Stream Connecting...</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Attempting connection to Lumban CCTV stream feed.
              </p>
            </div>
            {!streamStatus?.running && (
              <button
                onClick={(e) => { e.stopPropagation(); startStream(); }}
                className="flex items-center gap-2 text-xs bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors">
                <Radio size={12} />
                Start Stream
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); manualRetry(); }}
              className="text-xs text-slate-500 hover:text-slate-300 underline transition-colors">
              Retry connection
            </button>
          </div>
        )}
      </div>

      {/* SIMULATION CONTROL PANEL (Shown when in SIMULATION MODE) */}
      {mode === 'simulation' && (
        <div className="bg-slate-950/95 border-t border-blue-500/30 p-4 space-y-4 transition-all animate-fadeIn">
          {/* Header Bar & Sub-Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
              </span>
              <span className="text-xs font-black tracking-wider uppercase text-blue-400">
                Simulation Sandbox · Calibrated E-Staff Gauge
              </span>
            </div>

            {/* Sub-mode Tab Selector: Manual vs Automated Scenario & Timer */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setScenarioSubMode('manual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scenarioSubMode === 'manual'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}>
                <Sliders size={12} />
                Manual Controls
              </button>
              <button
                onClick={() => setScenarioSubMode('scenario')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  scenarioSubMode === 'scenario'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}>
                <Timer size={12} />
                Automated Scenario & Timer
              </button>
            </div>
          </div>

          {/* TAB 1: MANUAL CONTROLS */}
          {scenarioSubMode === 'manual' && (
            <div className="space-y-3.5">
              {/* Row 1: Water Level Input & Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Direct Meters Input */}
                <div className="md:col-span-4 flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 rounded-xl p-2 px-3">
                  <span className="text-xs font-bold text-slate-300 whitespace-nowrap">
                    Set Water Level:
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.00"
                    max="7.00"
                    value={simWaterLevel.toFixed(2)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) setSimWaterLevel(Math.max(0, Math.min(7.0, val)));
                    }}
                    className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm font-black text-amber-300 text-center focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-xs font-extrabold text-slate-400">m</span>
                </div>

                {/* Action Buttons: START | PAUSE | RESET */}
                <div className="md:col-span-8 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setIsSimRising(true)}
                    disabled={isSimRising || simWaterLevel >= 7.0}
                    className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                      isSimRising
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500/40 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md active:scale-95'
                    }`}>
                    <Play size={13} className={isSimRising ? 'animate-pulse' : ''} />
                    START
                  </button>

                  <button
                    onClick={() => setIsSimRising(false)}
                    disabled={!isSimRising}
                    className={`flex-1 min-w-[90px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all border ${
                      !isSimRising
                        ? 'bg-slate-800/40 text-slate-500 border-slate-700/40 cursor-not-allowed'
                        : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500 shadow-md active:scale-95'
                    }`}>
                    <Pause size={13} />
                    PAUSE
                  </button>

                  <button
                    onClick={() => {
                      resetSimulation();
                    }}
                    className="flex-1 min-w-[90px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 shadow-md active:scale-95 transition-all">
                    <RotateCcw size={13} />
                    RESET
                  </button>
                </div>
              </div>

              {/* Row 2: Range Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-400">
                  <span>0.00 m (Dry Bed)</span>
                  <span className="text-blue-400 font-extrabold">Current: {simWaterLevel.toFixed(2)} m</span>
                  <span>7.00 m (Max Flood)</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="7.00"
                  step="0.05"
                  value={simWaterLevel}
                  onChange={(e) => setSimWaterLevel(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Row 3: Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                  <Sliders size={12} /> Presets:
                </span>
                {SIMULATION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSimWaterLevel(preset.meters)}
                    className={`flex-1 min-w-[100px] px-2.5 py-1.5 rounded-lg text-xs font-black border transition-all active:scale-95 ${preset.bgClass} ${
                      Math.abs(simWaterLevel - preset.meters) < 0.05 ? 'ring-2 ring-white/40 font-black scale-[1.02]' : ''
                    }`}
                    title={preset.desc}>
                    [ {preset.label} ] ({preset.meters.toFixed(2)}m)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: AUTOMATED SCENARIO & TIMER DRILL */}
          {scenarioSubMode === 'scenario' && (
            <div className="space-y-3.5">
              {/* Presets Row */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Layers size={13} className="text-indigo-400" />
                  Quick Scenario Drill Presets:
                </span>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {SCENARIO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyScenarioPreset(preset)}
                      className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/70 hover:border-indigo-500/70 text-left transition-all group">
                      <div className="text-[11px] font-black text-white group-hover:text-indigo-300 flex items-center justify-between">
                        {preset.label}
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-800 rounded font-semibold text-slate-400">
                          {preset.durationSec}s
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-1">
                        {preset.startM}m ➔ {preset.targetM}m
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Start/End Configuration & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                {/* Start Meter */}
                <div className="md:col-span-3 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Start:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.0"
                    max="7.0"
                    value={scenarioStartMeters}
                    onChange={(e) => setScenarioStartMeters(parseFloat(e.target.value) || 0)}
                    disabled={scenarioIsRunning}
                    className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-white text-center"
                  />
                  <span className="text-xs text-slate-500 font-bold">m</span>
                </div>

                <ArrowRight size={14} className="hidden md:block text-slate-600" />

                {/* Target End Meter */}
                <div className="md:col-span-3 flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">Target End:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.0"
                    max="7.0"
                    value={scenarioTargetMeters}
                    onChange={(e) => setScenarioTargetMeters(parseFloat(e.target.value) || 0)}
                    disabled={scenarioIsRunning}
                    className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-xs font-bold text-indigo-300 text-center"
                  />
                  <span className="text-xs text-slate-500 font-bold">m</span>
                </div>

                {/* Duration Timer Selector */}
                <div className="md:col-span-5 flex items-center justify-end gap-1.5">
                  <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
                    <Clock size={12} /> Timer:
                  </span>
                  {[30, 60, 120, 300].map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setScenarioDurationSec(sec)}
                      disabled={scenarioIsRunning}
                      className={`px-2 py-1 rounded-lg text-xs font-black border transition-all ${
                        scenarioDurationSec === sec
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}>
                      {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cycle Toggle & Live Progress Bar Card */}
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {/* Phase Badge */}
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                      scenarioPhase === 'rising' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse' :
                      scenarioPhase === 'peak' ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-bounce' :
                      scenarioPhase === 'receding' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                      scenarioPhase === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {scenarioPhase === 'rising' && '▲ RISING FLOOD'}
                      {scenarioPhase === 'peak' && '⏸ PEAK HOLD'}
                      {scenarioPhase === 'receding' && '▼ RECEDING'}
                      {scenarioPhase === 'completed' && '✓ COMPLETED'}
                      {scenarioPhase === 'idle' && 'IDLE'}
                    </span>

                    <span className="text-xs font-bold text-slate-300">
                      Water Level: <span className="text-indigo-300 font-black">{simWaterLevel.toFixed(2)} m</span>
                    </span>
                  </div>

                  {/* Countdown Timer */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400 font-semibold">Remaining:</span>
                    <span className="font-mono font-black text-amber-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      ⏱ {formatSecs(timeRemainingSec)}
                    </span>
                    <span className="text-slate-500 font-semibold">/ {formatSecs(scenarioDurationSec)}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/80">
                    <div
                      className="bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 h-full rounded-full transition-all duration-100 shadow-md"
                      style={{ width: `${scenarioProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Start: {scenarioStartMeters.toFixed(2)}m</span>
                    <span className="text-indigo-400 font-black">{scenarioProgress}% Complete</span>
                    <span>Target: {scenarioTargetMeters.toFixed(2)}m</span>
                  </div>
                </div>

                {/* Full Cycle Checkbox & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={scenarioIsCycle}
                      onChange={(e) => setScenarioIsCycle(e.target.checked)}
                      disabled={scenarioIsRunning}
                      className="rounded bg-slate-800 border-slate-600 text-indigo-600 focus:ring-0"
                    />
                    Full Lifecycle (Rise ➔ Peak ➔ Recede back to Start)
                  </label>

                  <div className="flex items-center gap-2">
                    {!scenarioIsRunning ? (
                      <button
                        onClick={startScenario}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-400 shadow-md active:scale-95 transition-all">
                        <Play size={13} />
                        {scenarioPhase === 'completed' ? 'RE-RUN SCENARIO' : 'START SCENARIO'}
                      </button>
                    ) : (
                      <button
                        onClick={pauseScenario}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white border border-amber-400 shadow-md active:scale-95 transition-all">
                        <Pause size={13} />
                        PAUSE
                      </button>
                    )}

                    <button
                      onClick={resetScenario}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 active:scale-95 transition-all">
                      <RotateCcw size={13} />
                      RESET
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer Info Bar */}
      <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-900/40">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>📍 Pagsanjan–Lumban River Bridge</span>
          {streamStatus && (
            <span className={streamStatus.running ? 'text-green-500' : 'text-red-500'}>
              {streamStatus.running ? '● FFmpeg Active' : '● FFmpeg Offline'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          {mode === 'simulation' ? (
            <span className="font-extrabold text-blue-500">
              🧪 SIMULATION ACTIVE ({simWaterLevel.toFixed(2)}m · {simClassification.label})
            </span>
          ) : (
            <span>Raw Stream (Unprocessed)</span>
          )}
        </div>
      </div>
    </div>
  );
}
