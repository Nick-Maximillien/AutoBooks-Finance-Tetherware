'use client';

import { useEffect, useState } from 'react';
import axios, { AxiosError } from 'axios';
import Image from 'next/image';
import { useAuth } from 'context/AuthContext';

interface DroneData {
  timestamp: string;
  coordinates: string;
  image_url: string;
  analysis: string;
}

export default function DroneData() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<DroneData[]>([]);

  useEffect(() => {
    if (!accessToken) return;

    const fetchData = async () => {
      try {
        const res = await axios.get(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/drone-data/`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setData(res.data);
      } catch (err: unknown) {
        const axiosError = err as AxiosError;
        if (axiosError.response?.status === 401) {
          console.error('Unauthorized. Please login again.');
          clearInterval(interval);
        } else {
          console.error('Fetch error:', axiosError.message);
        }
      }
    };

    const interval = setInterval(fetchData, 1000000); // ~16 minutes
    fetchData();
    return () => clearInterval(interval);
  }, [accessToken]);

  return (
    <div className="droneDataSection">
      <h2 className="droneDataHeading">Drone Data Feed</h2>
      {data.length === 0 ? (
        <p className="droneEmptyText">No data yet...</p>
      ) : (
        data.map((entry, index) => (
          <div key={index} className="droneCard">
            <p><b>Time:</b> {new Date(entry.timestamp).toLocaleString()}</p>
            <p><b>GPS Coordinates:</b> {entry.coordinates}</p>
            <Image
              src={entry.image_url}
              alt="Drone Capture"
              width={500}
              height={300}
              className="droneImage"
            />
            <p><b>Analysis:</b> {entry.analysis}</p>
          </div>
        ))
      )}
    </div>
  );
}
