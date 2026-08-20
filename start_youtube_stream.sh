#!/bin/bash
echo "==================================================="
echo "Starting Live Tapo C310 Stream to YouTube on Raspberry Pi"
echo "==================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CALIB_FILE="$SCRIPT_DIR/flood_ai/calibration.json"

# Load RTSP_URL and STREAM_KEY dynamically from calibration.json if available
if [ -f "$CALIB_FILE" ]; then
  CALIB_RTSP=$(python3 -c "import json; print(json.load(open('$CALIB_FILE')).get('rtsp_url', ''))" 2>/dev/null)
  CALIB_KEY=$(python3 -c "import json; print(json.load(open('$CALIB_FILE')).get('youtube_stream_key', ''))" 2>/dev/null)
  if [ -n "$CALIB_RTSP" ]; then RTSP_URL="$CALIB_RTSP"; fi
  if [ -n "$CALIB_KEY" ]; then STREAM_KEY="$CALIB_KEY"; fi
fi

# Fallbacks if not configured in JSON or environment
STREAM_KEY="${STREAM_KEY:-y6p8-k923-9s6z-5ub0-7sss}"
RTSP_URL="${RTSP_URL:-rtsp://FloodMonitoring:FloodCam2026@192.168.1.149:554/stream1}"

echo "[Config] RTSP Source : $RTSP_URL"
echo "[Config] Stream Key  : ${STREAM_KEY:0:4}****"

while true; do
  echo "[$(date +'%T')] Pushing live camera stream to YouTube..."
  ffmpeg -nostdin -loglevel error \
    -rtsp_transport tcp \
    -timeout 10000000 \
    -use_wallclock_as_timestamps 1 \
    -thread_queue_size 4096 \
    -fflags +genpts+discardcorrupt \
    -err_detect ignore_err \
    -i "$RTSP_URL" \
    -c:v libx264 -preset ultrafast -tune zerolatency -r 30 -g 30 -keyint_min 30 -sc_threshold 0 \
    -s 1280x720 -b:v 2500k -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p \
    -c:a aac -b:a 128k -ar 44100 -af "aresample=async=1" \
    -f flv -flvflags no_duration_filesize "rtmp://a.rtmp.youtube.com/live2/$STREAM_KEY"

  echo "[$(date +'%T')] Connection dropped or camera offline. Reconnecting in 3s..."
  sleep 3
done
