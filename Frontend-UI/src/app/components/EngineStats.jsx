'use client';

import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';

function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 3600));
  const hours = Math.floor((seconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} second${secs !== 1 ? 's' : ''}`);

  return parts.join(', ');
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#9c27b0', '#f44336'];

export default function EngineStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_FAST_API_URL}/observe/engine/stats/`);
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error('Error fetching engine stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <p>Loading engine stats...</p>;
  if (!data) return <p>Failed to load engine stats.</p>;

  const {
    uptime_seconds,
    inference_total,
    inference_failures,
    openai_success,
    openai_fallback,
    total_uploads,
    web_uploads,
    whatsapp_uploads,
    health_pings,
    recent_classes,
    celery_reachable,
    celery_tasks,
    average_task_latency_sec,
    average_model_latency_sec,
    average_inference_latency_sec,
    exceptions
  } = data;

  const failureRate = inference_total > 0
    ? ((inference_failures / inference_total) * 100).toFixed(1)
    : '0.0';

  const inferenceData = [
    { name: 'Successful', value: inference_total - inference_failures },
    { name: 'Failures', value: inference_failures }
  ];

  const uploadData = [
    { name: 'Web Uploads', value: web_uploads },
    { name: 'WhatsApp Uploads', value: whatsapp_uploads }
  ];

  const latencyData = [
    { name: 'Task', value: average_task_latency_sec },
    { name: 'Model', value: average_model_latency_sec },
    { name: 'Inference', value: average_inference_latency_sec }
  ];

  const openaiData = [
    { name: 'OpenAI Success', value: openai_success },
    { name: 'OpenAI Fallback', value: openai_fallback }
  ];

  const classData = recent_classes.map(([label, count]) => ({ name: label, value: count }));

  return (
    <div className="p-6 space-y-8 bg-white shadow rounded-xl">
      <h2 className="text-2xl font-bold">🚀 Engine Dashboard</h2>

      {/* Core Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <div className="p-4 bg-blue-50 rounded shadow">
          <p className="text-sm text-gray-500">Uptime</p>
          <p className="text-lg font-semibold">{formatUptime(uptime_seconds)}</p>
        </div>
        <div className="p-4 bg-green-50 rounded shadow">
          <p className="text-sm text-gray-500">Inferences</p>
          <p className="text-lg font-semibold">{inference_total}</p>
        </div>
        <div className="p-4 bg-yellow-50 rounded shadow">
          <p className="text-sm text-gray-500">Failure Rate</p>
          <p className="text-lg font-semibold">{failureRate}%</p>
        </div>
        <div className="p-4 bg-purple-50 rounded shadow">
          <p className="text-sm text-gray-500">Uploads</p>
          <p className="text-lg font-semibold">{total_uploads}</p>
        </div>
        <div className="p-4 bg-pink-50 rounded shadow">
          <p className="text-sm text-gray-500">Health Pings</p>
          <p className="text-lg font-semibold">{health_pings}</p>
        </div>
        <div className="p-4 bg-indigo-50 rounded shadow">
          <p className="text-sm text-gray-500">Celery Status</p>
          <p className={`text-lg font-semibold ${celery_reachable ? 'text-green-600' : 'text-red-600'}`}>
            {celery_reachable ? 'Connected' : 'Disconnected'}
          </p>
        </div>
      </div>

      {/* OpenAI Fallbacks */}
      <div>
        <h3 className="font-semibold text-lg mb-1">🤖 OpenAI Usage</h3>
        <p className="text-sm text-gray-500 mb-2">Success vs fallback (e.g. when OpenAI failed).</p>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={openaiData} dataKey="value" nameKey="name" outerRadius={100} label>
              {openaiData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Inference Chart */}
      <div>
        <h3 className="font-semibold text-lg mb-1">🧠 Inference Success vs Failures</h3>
        <p className="text-sm text-gray-500 mb-2">Total inferences vs failures.</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={inferenceData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Uploads */}
      <div>
        <h3 className="font-semibold text-lg mb-1">📤 Upload Sources</h3>
        <p className="text-sm text-gray-500 mb-2">Web vs WhatsApp uploads.</p>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={uploadData} dataKey="value" nameKey="name" outerRadius={100} label>
              {uploadData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Latency */}
      <div>
        <h3 className="font-semibold text-lg mb-1">⏱️ Latency Metrics</h3>
        <p className="text-sm text-gray-500 mb-2">Average task, model and inference latencies (seconds).</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={latencyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#ffc658" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Classifications */}
      <div>
        <h3 className="font-semibold text-lg mb-1">🌿 Recent Class Detections</h3>
        <p className="text-sm text-gray-500 mb-2">Latest classification categories detected.</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={classData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Celery Worker Stats */}
      <div>
        <h3 className="font-semibold text-lg mt-4">⚙️ Celery Worker Stats</h3>
        <pre className="bg-gray-100 p-2 rounded text-sm overflow-x-auto">
          {JSON.stringify(celery_tasks.stats, null, 2)}
        </pre>
      </div>

      {/* Celery Queues */}
      <div>
        <h3 className="font-semibold text-lg mt-4">📦 Celery Queues</h3>
        <p><strong>Active:</strong> {JSON.stringify(celery_tasks.active)}</p>
        <p><strong>Reserved:</strong> {JSON.stringify(celery_tasks.reserved)}</p>
        <p><strong>Scheduled:</strong> {JSON.stringify(celery_tasks.scheduled)}</p>
      </div>

      {/* Exceptions */}
      <div>
        <h3 className="font-semibold text-lg mt-4 text-red-700">🔥 Exceptions</h3>
        <pre className="bg-red-100 text-red-800 p-2 rounded text-sm overflow-x-auto">
          {Object.keys(exceptions).length > 0
            ? JSON.stringify(exceptions, null, 2)
            : 'None'}
        </pre>
      </div>
    </div>
  );
}
