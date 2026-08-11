import { spawn }   from 'child_process';
import path        from 'path';
import fs          from 'fs';
import { fileURLToPath } from 'url';

const getHlsDir = () => {
  const envDir = process.env.HLS_OUTPUT_DIR;
  if (envDir) {
    const resolved = path.resolve(envDir);
    if (fs.existsSync(path.dirname(resolved))) return resolved;
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../hls');
};

let ffmpegProcess = null;
let isRunning     = false;
let restartTimer  = null;

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

export const startHLS = () => {
  const rtspUrl = process.env.RTSP_URL;
  const ffmpeg  = process.env.FFMPEG_PATH || 'ffmpeg';

  if (isRunning || !rtspUrl || !ffmpeg) {
    if (!rtspUrl) console.warn('[HLS] RTSP_URL not set in .env');
    if (!ffmpeg)  console.warn('[HLS] FFMPEG_PATH not set in .env');
    return;
  }

  const hlsDir = getHlsDir();
  ensureDir(hlsDir);

  const outputPath = path.join(hlsDir, 'stream.m3u8');

  const args = [
    '-loglevel',        'error',
    '-rtsp_transport',  'tcp',
    '-analyzeduration', '10000000',
    '-probesize',       '10000000',
    '-fflags',          '+genpts+discardcorrupt+nobuffer',
    '-flags',           'low_delay',
    '-timeout',         '5000000',
    '-i',               rtspUrl,
    '-an',
    '-c:v',             'copy',
    '-vsync',           'passthrough',
    '-f',               'hls',
    '-hls_time',        '1',
    '-hls_list_size',   '3',
    '-hls_flags',       'delete_segments+append_list+discont_start+omit_endlist',
    '-hls_segment_type','mpegts',
    '-hls_segment_filename', path.join(hlsDir, 'seg%d.ts'),
    outputPath,
  ];

  console.log(`[HLS] Starting FFmpeg stream writing to ${outputPath}...`);

  ffmpegProcess = spawn(ffmpeg, args);
  isRunning     = true;

  ffmpegProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error('[FFmpeg]', msg);
  });

  ffmpegProcess.on('close', (code) => {
    isRunning     = false;
    ffmpegProcess = null;
    console.log(`[HLS] FFmpeg exited with code ${code}. Restarting in 1s...`);
    restartTimer = setTimeout(() => startHLS(), 1000);
  });

  ffmpegProcess.on('error', (err) => {
    isRunning = false;
    console.error('[HLS] FFmpeg error:', err.message);
    restartTimer = setTimeout(() => startHLS(), 1000);
  });
};

export const stopHLS = () => {
  if (restartTimer) clearTimeout(restartTimer);
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM');
    ffmpegProcess = null;
    isRunning     = false;
    console.log('[HLS] Stream stopped');
  }
};

export const getStreamStatus = () => {
  const hlsDir = getHlsDir();
  const m3u8Path = path.join(hlsDir, 'stream.m3u8');
  return {
    running:     isRunning,
    rtsp_url:    process.env.RTSP_URL
                   ? process.env.RTSP_URL.replace(/:[^:@]+@/, ':***@')
                   : null,
    output_dir:  hlsDir,
    m3u8_path:   m3u8Path,
    m3u8_exists: fs.existsSync(m3u8Path),
  };
};