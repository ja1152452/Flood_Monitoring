@echo off
echo === Fixed Camera Settings FFmpeg Stream ===

REM Kill existing FFmpeg process
taskkill /F /IM ffmpeg.exe 2>nul

REM Clear old HLS files
del /Q "C:\Users\jayze\Documents\Capstone\Flood-Monitoring-System\flood_monitor\backend\hls\*.*" 2>nul

REM Start FFmpeg with fixed camera settings
"C:\Users\jayze\Documents\Capstone\Flood-Monitoring-System\ffmpeg\bin\ffmpeg.exe" ^
  -loglevel error ^
  -rtsp_transport tcp ^
  -fflags nobuffer ^
  -flags low_delay ^
  -i "rtsp://FloodMonitoring:FloodCam2026@192.168.1.12:554/stream2" ^
  -an ^
  -c:v copy ^
  -vsync passthrough ^
  -fflags +genpts+discardcorrupt ^
  -vf "eq=brightness=0:contrast=1.0:saturation=1.0" ^
  -f hls ^
  -hls_time 2 ^
  -hls_list_size 5 ^
  -hls_flags delete_segments+append_list+discont_start+omit_endlist ^
  -hls_segment_filename "C:\Users\jayze\Documents\Capstone\Flood-Monitoring-System\flood_monitor\backend\hls\seg%%d.ts" ^
  "C:\Users\jayze\Documents\Capstone\Flood-Monitoring-System\flood_monitor\backend\hls\stream.m3u8"

pause