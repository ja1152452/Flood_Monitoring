import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Camera, WifiOff, RefreshCw, Radio, Maximize2, Minimize2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/axios';

const STREAM_URL = '/api/v1/stream/index.m3u8';

export function LiveCameraFeed() {
  const containerRef          = useRef(null);
  const videoRef              = useRef(null);
  const hlsRef                = useRef(null);
  const hlsStartedRef         = useRef(false);
  const [status, setStatus]   = useState('waiting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState('/api/v1/stream/snapshot');
  const [snapshotAvailable, setSnapshotAvailable] = useState(false);

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

    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const initHls = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Safari native HLS
    if (!Hls.isSupported() && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = STREAM_URL;
      video.addEventListener('loadedmetadata', () => {
        setStatus('live');
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener('error', () => setStatus('error'), { once: true });
      return;
    }

    if (!Hls.isSupported()) {
      setStatus('unsupported');
      return;
    }

    setStatus('connecting');

    const hls = new Hls({
      lowLatencyMode:              true,
      backBufferLength:            0,
      maxBufferLength:             2,
      maxMaxBufferLength:          4,
      liveSyncDurationCount:       1,
      liveMaxLatencyDurationCount: 2,
      manifestLoadingTimeOut:      10000,
      manifestLoadingMaxRetry:     0,
      levelLoadingTimeOut:         10000,
      fragLoadingTimeOut:          10000,
    });

    hls.loadSource(STREAM_URL);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setStatus('live');
      video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) {
        hls.destroy();
        hlsRef.current        = null;
        hlsStartedRef.current = false;
        setStatus('error');
      }
    });

    hlsRef.current = hls;
  }, []);

  // Only start HLS once m3u8_exists becomes true
  useEffect(() => {
    if (streamStatus?.m3u8_exists && !hlsStartedRef.current) {
      hlsStartedRef.current = true;
      initHls();
    }
    // If stream was live but m3u8 disappeared (FFmpeg died), show error
    if (streamStatus && !streamStatus.m3u8_exists && status === 'live') {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      hlsStartedRef.current = false;
      setStatus('error');
    }
  }, [streamStatus, initHls, status]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const startStream = async () => {
    await api.post('/stream/start');
    refetch();
  };

  const manualRetry = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    hlsStartedRef.current = false;
    setStatus('waiting');
    refetch();
  };

  return (
    <div ref={containerRef} className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-sm dark:shadow-none ${isFullscreen ? 'h-screen w-screen justify-between fixed inset-0 z-50 rounded-none' : ''}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <Camera size={15} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-900 dark:text-slate-300">Live Camera Feed</span>
          <span className="text-xs text-slate-500">· CAM-LUMBAN-01</span>
        </div>
        <div className="flex items-center gap-3">
          {status === 'live' && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 blink" />
              <span className="text-xs text-red-400 font-medium">LIVE</span>
            </div>
          )}
          <button
            onClick={manualRetry}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title="Retry connection">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div
        className="relative bg-black cursor-pointer group flex-1 flex items-center justify-center overflow-hidden"
        style={{ aspectRatio: isFullscreen ? 'auto' : '16/9' }}
        onClick={toggleFullscreen}
        title={isFullscreen ? 'Click to exit full screen' : 'Click for full screen'}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          muted
          playsInline
          autoPlay
          style={{ display: status === 'live' ? 'block' : 'none' }}
        />

        {status === 'snapshot' && (
          <img
            src={snapshotUrl}
            alt="AI Live Detection Feed"
            className="w-full h-full object-contain"
          />
        )}

        {(status === 'live' || status === 'snapshot') && (
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/80 text-white text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 backdrop-blur border border-slate-700 shadow-lg">
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Click for Fullscreen'}</span>
            </div>
          </div>
        )}

        {(status === 'waiting' || status === 'connecting') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-slate-400">
              {status === 'waiting' ? 'Waiting for stream...' : 'Connecting to stream...'}
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="relative w-full h-full bg-slate-900 flex flex-col items-center justify-center">
            {snapshotAvailable ? (
              <img
                src={snapshotUrl}
                alt="AI Camera Snapshot"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 p-4 text-center">
                <WifiOff size={36} className="text-slate-600" />
                <div>
                  <p className="text-sm text-slate-400 mb-1">Camera HLS Stream Unavailable</p>
                  <p className="text-xs text-slate-500">
                    Camera RTSP stream limit reached (close 5_detect.py if open)
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
        )}
      </div>

      <div className="px-5 py-2.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>📍 Pagsanjan–Lumban River Bridge</span>
          {streamStatus && (
            <span className={streamStatus.running ? 'text-green-500' : 'text-red-500'}>
              {streamStatus.running ? '● FFmpeg Active' : '● FFmpeg Offline'}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-600">
          {streamStatus?.m3u8_exists ? 'Stream ready' : 'No stream data'}
        </span>
      </div>
    </div>
  );
}
