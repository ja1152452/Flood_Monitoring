@echo off
setlocal enabledelayedexpansion
title YouTube Live Stream - Flood Monitoring
echo ===================================================
echo Starting Live Tapo C310 Stream to YouTube (Pixel-Perfect HD)
echo ===================================================

set "STREAM_KEY=y6p8-k923-9s6z-5ub0-7sss"
set "RTSP_URL=rtsp://Flood_monitoring:FloodCam2026@192.168.0.112:554/stream1"

REM 1. Load latest settings from flood_ai/calibration.json if available
if exist "flood_ai\calibration.json" (
  for /f "delims=" %%i in ('powershell -Command "(Get-Content flood_ai/calibration.json | ConvertFrom-Json).youtube_stream_key" 2^>nul') do (
    if not "%%i"=="" set "STREAM_KEY=%%i"
  )
  for /f "delims=" %%i in ('powershell -Command "(Get-Content flood_ai/calibration.json | ConvertFrom-Json).rtsp_url" 2^>nul') do (
    if not "%%i"=="" set "RTSP_URL=%%i"
  )
)

echo [Config] RTSP Source : !RTSP_URL!
echo [Config] Stream Key  : !STREAM_KEY:~0,4!****
echo [Config] RTMP Target : rtmp://a.rtmp.youtube.com/live2
echo ===================================================
echo [INFO] Injecting stereo audio sync track for instant YouTube unlock.
echo.

:loop
echo [%time%] Pushing live camera stream to YouTube...
ffmpeg -nostdin -loglevel warning ^
  -rtsp_transport tcp ^
  -timeout 10000000 ^
  -use_wallclock_as_timestamps 1 ^
  -thread_queue_size 4096 ^
  -fflags +genpts+discardcorrupt ^
  -err_detect ignore_err ^
  -i "!RTSP_URL!" ^
  -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100 ^
  -map 0:v:0 -map 1:a:0 ^
  -c:v libx264 -preset veryfast -tune zerolatency -r 30 -g 60 -keyint_min 60 -sc_threshold 0 ^
  -s 1280x720 -b:v 2500k -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p ^
  -c:a aac -b:a 128k -ar 44100 ^
  -f flv -flvflags no_duration_filesize "rtmp://a.rtmp.youtube.com/live2/!STREAM_KEY!"

echo [%time%] Connection dropped or camera offline. Reconnecting in 3s...
timeout /t 3 /nobreak >nul
goto loop
