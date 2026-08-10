# Calibration Guide - How to Fix Inaccurate Water Level

## Problem
The waterline detection is showing the wrong water level because it's detecting the colored markers instead of the actual water surface.

## Solution: Proper Calibration

### Step 1: Run Calibration Script
```bash
cd flood_ai
python 3_calibrate.py
```

### Step 2: Click on WATER SURFACE Points (Not Markers!)

**IMPORTANT:** Click on the ruler/scale where the WATER SURFACE touches it, NOT on the colored markers!

Example:
```
If your ruler shows:
  4.0m ← Click here if water is at 4.0m
  3.5m ← Click here if water is at 3.5m
  3.0m ← Click here if water is at 3.0m
  2.5m ← Click here if water is at 2.5m
```

### Step 3: Enter Accurate Measurements

For each click:
1. Click on the ruler at a known water level marking
2. Type the EXACT meter value shown on the ruler
3. Press ENTER

**Example Session:**
```
Clicked pixel y=750
Enter real meter value: 3.5
Added: y=750px → 3.50m

Clicked pixel y=827
Enter real meter value: 3.1
Added: y=827px → 3.10m

Clicked pixel y=900
Enter real meter value: 2.8
Added: y=900px → 2.80m
```

### Step 4: Save Calibration
Press **S** key to save

### Tips for Accurate Calibration:

1. **Use at least 3-5 points** spread across different water levels
2. **Click on clear ruler markings** where you can read the exact measurement
3. **Don't click on the colored markers** - they are for detection, not calibration
4. **Click on the ruler/scale itself** at the point where water touches it
5. **Use current water level** - if you can see the actual water level on your ruler, use that as one of your calibration points

### Current Calibration Values:
- baseline_pixel_y: 827
- baseline_meters: 3.1
- px_per_meter: 191.82

### After Calibration:
Test the detection by running:
```bash
python 5_detect.py
```

Check if the cyan waterline now correctly shows the actual water surface level.
