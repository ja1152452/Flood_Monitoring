#!/bin/bash
echo "==================================================="
echo "Starting Live Tapo C310 Stream to YouTube on Raspberry Pi"
echo "==================================================="

STREAM_KEY="y6p8-k923-9s6z-5ub0-7sss"
RTSP_URL="rtsp://FloodMonitoring:FloodCam2026@192.168.1.149:554/stream1"

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

  echo "[$(date +'%T')] Connection dropped. Reconnecting in 2s..."
  sleep 2
done
