@echo off
cd /d c:\capstog\Flood-Monitoring-System\flood_monitor\mobile

echo Starting Expo Metro (no tunnel)...
start "Expo Metro" cmd /k "npx expo start --port 8081 --clear"

echo Waiting for Metro to start...
timeout /t 10 /nobreak

echo Starting Backend Cloudflare Tunnel...
start "Backend Tunnel" cmd /k ""C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5000"

echo Starting Expo Cloudflare Tunnel...
echo When you see the tunnel URL below, open it in Expo Go app (not browser)
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8081

pause
