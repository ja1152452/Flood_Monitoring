import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (_req, res) => {
  const { WEATHER_API_KEY, WEATHER_CITY } = process.env;

  if (!WEATHER_API_KEY || WEATHER_API_KEY === 'your_weatherapi_key_here') {
    return res.json({
      success: true,
      data: {
        temp: 28, humidity: 75, rain: 0,
        wind: 12, description: 'Partly Cloudy',
        feels_like: 30, uv: 5,
        condition_icon: null,
      },
    });
  }

  const city = encodeURIComponent(WEATHER_CITY || 'Lumban,Laguna,PH');
  const url  = `http://api.weatherapi.com/v1/current.json?key=${WEATHER_API_KEY}&q=${city}&aqi=no`;

  let json;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`WeatherAPI ${response.status}`);
    json = await response.json();
  } catch (e) {
    console.warn(`WeatherAPI error: ${e.message} — falling back to mock data`);
    return res.json({
      success: true,
      data: {
        temp: 28, humidity: 75, rain: 0,
        wind: 12, description: 'Partly Cloudy',
        feels_like: 30, uv: 5,
        condition_icon: null,
      },
    });
  }

  res.json({
    success: true,
    data: {
      temp:          Math.round(json.current.temp_c),
      feels_like:    Math.round(json.current.feelslike_c),
      humidity:      json.current.humidity,
      rain:          json.current.precip_mm,
      wind:          Math.round(json.current.wind_kph),
      uv:            json.current.uv,
      description:   json.current.condition.text,
      condition_icon: `https:${json.current.condition.icon}`,
    },
  });
}));

export default router;