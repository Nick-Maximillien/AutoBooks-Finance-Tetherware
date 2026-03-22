'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getTokensFromLocalStorage,
  refreshAccessTokenIfNeeded,
} from '../../utils/tokenUtils';

interface WeatherEntry {
  temperature: number;
  humidity: number;
  timestamp: string;
  season: string;
  weather: string;
}

const WeatherHistoryChart = () => {
  const [data, setData] = useState<WeatherEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchWeatherHistory = async () => {
      try {
        const { accessToken, refreshToken } = getTokensFromLocalStorage();
        if (!accessToken || !refreshToken) {
          throw new Error('Authentication tokens are missing');
        }

        const validToken = await refreshAccessTokenIfNeeded(accessToken, refreshToken);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_DJANGO_API_URL}/weather/history`,
          {
            headers: {
              Authorization: `Bearer ${validToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const rawData: WeatherEntry[] = await response.json();
        const parsedData = rawData.map((entry) => ({
          ...entry,
          timestamp: new Date(entry.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        }));

        setData(parsedData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('🌩️ Weather history fetch error:', message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeatherHistory();
  }, []);

  return (
    <div className="weather-chart-container portrait:pt-6 landscape:pt-2">
      {loading && (
        <p className="weather-chart-status loading portrait:text-sm landscape:text-base">
          Loading weather history...
        </p>
      )}
      {error && (
        <p className="weather-chart-status error portrait:text-sm landscape:text-base">
          Error: {error}
        </p>
      )}
      {!loading && !error && data.length === 0 && (
        <p className="weather-chart-status empty portrait:text-sm landscape:text-base">
          No weather history available.
        </p>
      )}
      {!loading && !error && data.length > 0 && (
        <div className="weather-chart-wrapper">
          <h2 className="weather-chart-heading portrait:text-lg landscape:text-xl">
            📈 Weather Trends (Past 5 Records)
          </h2>
          <div className="weather-chart-responsive portrait:h-[300px] landscape:h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="temperature"
                  stroke="#f97316"
                  name="Temp (°C)"
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  stroke="#3b82f6"
                  name="Humidity (%)"
                  dot={{ r: 3 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherHistoryChart;
