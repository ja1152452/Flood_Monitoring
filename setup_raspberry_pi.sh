#!/bin/bash
set -e

echo "======================================================="
echo "  Setting up Lumban Flood Monitoring on Raspberry Pi   "
echo "======================================================="

# 1. Update and install system dependencies
echo "[1/4] Installing system packages..."
sudo apt update
sudo apt install -y python3-opencv python3-pip ffmpeg git libgl1 nmap

# 2. Install Python packages
echo "[2/4] Installing Python requirements..."
pip3 install requests numpy ultralytics --break-system-packages

# 3. Ensure all scripts are executable
echo "[3/4] Setting execution permissions..."
chmod +x start_youtube_stream.sh
chmod +x setup_raspberry_pi.sh

# 4. Run the diagnostics
echo "[4/4] Running Camera & Railway Cloud Backend Diagnostics..."
python3 flood_ai/test_camera.py

echo ""
echo "======================================================="
echo "  Setup Complete!                                      "
echo "======================================================="
echo "To start AI Flood Detection Telemetry:"
echo "  python3 flood_ai/7_sender.py"
echo ""
echo "To start Live Stream to YouTube:"
echo "  ./start_youtube_stream.sh"
echo "======================================================="
