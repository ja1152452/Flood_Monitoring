#!/bin/bash
echo "==================================================="
echo "Starting Live Tapo C310 Stream to YouTube on Raspberry Pi"
echo "==================================================="

STREAM_KEY="y6p8-k923-9s6z-5ub0-7sss"
RTSP_URL="rtsp://FloodMonitoring:FloodCam2026@192.168.1.149:554/stream1"

while true; do
  echo "[$(date +'%T')] Pushing live camera stream to YouTube..."
  ffmpeg -nostdin -loglevel warning \
    -rtsp_transport tcp \
    -i "$RTSP_URL" \
    -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 \
    -map 0:v:0 -map 1:a:0 \
    -c:v copy \
    -c:a aac -b:a 128k \
    -f flv "rtmp://a.rtmp.youtube.com/live2/$STREAM_KEY"

  echo "[$(date +'%T')] Connection dropped. Reconnecting in 2s..."
  sleep 2
done
