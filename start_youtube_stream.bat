@echo off
echo ===================================================
echo Starting Live Tapo C310 Stream to YouTube (Pixel-Perfect HD)
echo ===================================================

set STREAM_KEY=0t7b-p7t1-1ds5-a64k-4tp5
set RTSP_URL=rtsp://FloodMonitoring:FloodCam2026@192.168.1.149:554/stream1

:loop
echo [%time%] Pushing live camera stream to YouTube...
ffmpeg -nostdin -loglevel error ^
  -rtsp_transport tcp ^
  -timeout 10000000 ^
  -use_wallclock_as_timestamps 1 ^
  -thread_queue_size 4096 ^
  -fflags +genpts+discardcorrupt ^
  -err_detect ignore_err ^
  -i "%RTSP_URL%" ^
  -c:v libx264 -preset ultrafast -tune zerolatency -r 30 -g 30 -keyint_min 30 -sc_threshold 0 ^
  -s 1280x720 -b:v 2500k -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p ^
  -c:a aac -b:a 128k -ar 44100 -af "aresample=async=1" ^
  -f flv -flvflags no_duration_filesize "rtmp://a.rtmp.youtube.com/live2/%STREAM_KEY%"

echo [%time%] RTSP/YouTube connection dropped. Reconnecting in 2s...
timeout /t 2 /nobreak >nul
goto loop











