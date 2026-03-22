'use client';

import { useEffect, useState } from 'react';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';
import Image from 'next/image';
import Link from 'next/link';
import OnWhatsappToggle from 'app/components/OnWhatsappToggle';
import {
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  Tooltip, Legend,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface DiagnosisItem {
  id: number;
  cloudinary_url: string;
  raw_result: string;
  insight: string;
  timestamp: string;
}

interface ChartDataItem {
  name: string;
  count: number;
}

const COLORS = ['#4CAF50', '#FF9800', '#2196F3', '#f43f5e', '#14b8a6', '#8e44ad', '#d35400'];
const CHART_TYPES = ['bar', 'pie', 'line'] as const;
type ChartType = typeof CHART_TYPES[number];
const STORAGE_KEY = 'agrosight_chart_type';

export default function UploadsHistory() {
  const [uploads, setUploads] = useState<DiagnosisItem[]>([]);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartType, setChartType] = useState<ChartType>('bar');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ChartType | null;
    if (stored && CHART_TYPES.includes(stored)) {
      setChartType(stored);
    }
  }, []);

  const setAndPersistChartType = (type: ChartType) => {
    setChartType(type);
    localStorage.setItem(STORAGE_KEY, type);
  };

  const nextChartType = () => {
    const currentIndex = CHART_TYPES.indexOf(chartType);
    const nextType = CHART_TYPES[(currentIndex + 1) % CHART_TYPES.length];
    setAndPersistChartType(nextType);
  };

  useEffect(() => {
    const fetchUploads = async () => {
      try {
        const { accessToken, refreshToken } = getTokensFromLocalStorage();
        if (!accessToken || !refreshToken) throw new Error('Missing auth tokens');

        const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);

        const res = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/diagnosis/history/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const { detail } = await res.json();
          throw new Error(detail || 'Failed to fetch diagnosis history');
        }

        const data: DiagnosisItem[] = await res.json();
        setUploads(data);

        const summary = data.reduce((acc: Record<string, number>, item) => {
          const label = item.raw_result?.trim() || 'Unknown';
          acc[label] = (acc[label] || 0) + 1;
          return acc;
        }, {});

        const chart = Object.entries(summary).map(([name, count]) => ({ name, count }));
        setChartData(chart);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setError(msg);
        console.error('📤 Upload history fetch error:', msg);
      } finally {
        setLoading(false);
      }
    };

    fetchUploads();
  }, []);

  const renderChart = () => {
    if (chartType === 'bar') {
      return (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} height={60} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#4CAF50" />
        </BarChart>
      );
    }

    if (chartType === 'line') {
      return (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} height={60} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="count" stroke="#3b82f6" />
        </LineChart>
      );
    }

    return (
      <PieChart>
        <Tooltip />
        <Legend />
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="name"
          outerRadius={100}
          label
        >
          {chartData.map((_, i) => (
            <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    );
  };

  if (loading) return <div className="weatherStatus">Loading uploads...</div>;
  if (error) return <div className="weatherStatus errorText">{error}</div>;
  if (uploads.length === 0) return <div className="weatherStatus">
          <p className="signupRedirect">
            <Link className="links" href="/web">
             You have no uploads yet. Send a picture of your affected crop and get help.
            </Link>
          </p>
          <OnWhatsappToggle />
          <p className="signupRedirect">
            <Link className="links" href="/shopper_dashboard">
              Back
            </Link>
          </p>
    </div>;

  return (
    <div className="weatherWidgetCard">
      <div className="flex justify-between items-center mb-4">
        <h2 className="weatherWidgetHeading">🧠 Upload History</h2>
        <button
          onClick={nextChartType}
          className="bg-blue-600 text-white rounded px-3 py-1 text-xs hover:bg-blue-700"
        >
          View: {chartType.toUpperCase()} → Switch
        </button>
      </div>

      <div style={{ width: '100%', height: 300, marginBottom: '2rem' }}>
        <ResponsiveContainer>
          {renderChart()}
        </ResponsiveContainer>
      </div>

      <ul className="uploadList">
        {uploads.map((item) => (
          <li key={item.id} className="uploadCard">
            <div className="uploadImageWrapper">
              <Image
                src={item.cloudinary_url}
                alt="diagnosis"
                fill
                className="uploadImage"
              />
            </div>
            <div className="uploadDetails">
              <p><strong>🪻 Diagnosis:</strong> {item.raw_result}</p>
              <p><strong>📝 Insight:</strong> {item.insight}</p>
              <p><strong>📅 Time:</strong> {new Date(item.timestamp).toLocaleString()}</p>
            </div>
          </li>
        ))}
      </ul>
          <p className="signupRedirect">
            <Link className="links" href="/shopper_dashboard">
              Back
            </Link>
          </p>
          <p className="signupRedirect">
            <Link className="links" href="/">
              Home
            </Link>
          </p>
    </div>
  );
}
