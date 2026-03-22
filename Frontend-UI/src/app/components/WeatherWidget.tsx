'use client';

import { useEffect, useState } from 'react';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';

interface WeatherData {
  temperature: number;
  humidity: number;
  weather: string;
  season: string;
  timestamp: string;
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWeather = async (lat: number, lon: number) => {
      try {
        const { accessToken, refreshToken } = getTokensFromLocalStorage();
        if (!accessToken || !refreshToken) throw new Error('Missing tokens');

        const validToken = await refreshAccessTokenIfNeeded(accessToken, refreshToken);

        const res = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/weather/live/`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${validToken}`,
            'X-Latitude': lat.toString(),
            'X-Longitude': lon.toString(),
          },
        });

        if (!res.ok) {
          const errorRes = await res.json();
          throw new Error(errorRes.detail || 'Failed to fetch weather data');
        }

        const data: WeatherData = await res.json();
        setWeather(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        console.error('🌩️ Weather fetch error:', msg);
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (geoErr) => {
          setError('Cannot update your weather because location is blocked or connection failed. Please enable location in your device.');
          console.error('📍 Geolocation error:', geoErr.message);
          setLoading(false);
        }
      );
    } else {
      setError('Geolocation not supported');
      setLoading(false);
    }
  }, []);

  if (loading) return <div className="weatherStatus">Loading weather...</div>;
  if (error) return <div className="weatherStatus errorText">{error}</div>;
  if (!weather) return <div className="weatherStatus">No weather data available</div>;

  const chartData = [
    {
      name: 'Now',
      Temperature: weather.temperature,
      Humidity: weather.humidity,
    },
  ];

  return (
    <div className="weatherWidgetCard">
      <h2 className="weatherWidgetHeading">🌤️ Current Weather</h2>
      <div className="mb-2">
        <p>
          <strong>📘 Condition:</strong> {weather.weather}
        </p>
        <p>
          <strong>🌾 Season:</strong> {weather.season}
        </p>
        <p>
          <strong>📅 Updated:</strong>{' '}
          {new Date(weather.timestamp).toLocaleString()}
        </p>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="Temperature" fill="#8884d8" unit="°C" />
          <Bar dataKey="Humidity" fill="#82ca9d" unit="%" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
