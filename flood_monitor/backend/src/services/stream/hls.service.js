import { spawn }   from 'child_process';
import path        from 'path';
import fs          from 'fs';
import { fileURLToPath } from 'url';

const HLS_DIR   = path.resolve(process.env.HLS_OUTPUT_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../hls'));
const FFMPEG    = process.env.FFMPEG_PATH || 'ffmpeg';
const RTSP_URL  = process.env.RTSP_URL || '';
const SEGMENT_S  = 1;
const LIST_SIZE  = 3;

let ffmpegProcess = null;
let isRunning     = false;
let restartTimer  = null;

const ensureDir = () => {
  if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });
};

export const startHLS = () => {
  const rtspUrl = process.env.RTSP_URL || RTSP_URL;
  const ffmpeg  = process.env.FFMPEG_PATH || FFMPEG;

  if (isRunning || !rtspUrl || !ffmpeg) {
    if (!rtspUrl) console.warn('[HLS] RTSP_URL not set in .env');
    if (!ffmpeg)  console.warn('[HLS] FFMPEG_PATH not set in .env');
    return;
  }

  ensureDir();

  const outputPath = path.join(HLS_DIR, 'stream.m3u8');

  const args = [
    '-loglevel',   'error',
    '-rtsp_transport', 'tcp',
    '-timeout',    '5000000',
    '-fflags',     'nobuffer',
    '-flags',      'low_delay',
    '-i',          rtspUrl,
    '-an',
    '-c:v',        'copy',
    '-vsync',      'passthrough',
    '-fflags',     '+genpts+discardcorrupt',
    '-f',          'hls',
    '-hls_time',   '2',
    '-hls_list_size', '3',
    '-hls_flags',  'delete_segments+append_list+discont_start+omit_endlist',
    '-hls_segment_type', 'mpegts',
    '-hls_segment_filename', path.join(HLS_DIR, 'seg%d.ts'),
    outputPath,
  ];

  console.log('[HLS] Starting FFmpeg stream...');

  ffmpegProcess = spawn(ffmpeg, args);
  isRunning     = true;

  ffmpegProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error('[FFmpeg]', msg);
  });

  ffmpegProcess.on('close', (code) => {
    isRunning     = false;
    ffmpegProcess = null;
    console.log(`[HLS] FFmpeg exited with code ${code}. Restarting in 5s...`);
    restartTimer = setTimeout(() => startHLS(), 5000);
  });

  ffmpegProcess.on('error', (err) => {
    isRunning = false;
    console.error('[HLS] FFmpeg error:', err.message);
    restartTimer = setTimeout(() => startHLS(), 5000);
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

export const getStreamStatus = () => ({
  running:     isRunning,
  rtsp_url:    (process.env.RTSP_URL || RTSP_URL)
                 ? (process.env.RTSP_URL || RTSP_URL).replace(/:[^:@]+@/, ':***@')
                 : null,
  output_dir:  HLS_DIR,
  m3u8_path:   path.join(HLS_DIR, 'stream.m3u8'),
  m3u8_exists: fs.existsSync(path.join(HLS_DIR, 'stream.m3u8')),
});