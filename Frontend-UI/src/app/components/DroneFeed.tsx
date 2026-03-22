'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';

interface DroneStatus {
  status: string;
  coordinates: string;
  image_url?: string;
}

export default function DroneFeed({ token }: { token: string }) {
  const [droneData, setDroneData] = useState<DroneStatus | null>(null);

  const fetchDroneData = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/drone-status/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data: DroneStatus = await res.json();
        setDroneData(data);
      }
    } catch (err) {
      console.error('Error fetching drone data:', err);
    }
  }, [token]);

  useEffect(() => {
    const interval = setInterval(fetchDroneData, 2000); // poll every 2s
    fetchDroneData();
    return () => clearInterval(interval);
  }, [fetchDroneData]);

  return (
    <div className="droneFeedContainer">
      <h1 className="droneFeedHeading">Active Drone Status</h1>
      {droneData ? (
        <div className="droneFeedCard">
          <h3 className="droneStatusText">Status: {droneData.status}</h3>
          <h4 className="droneCoordText">Coordinates: {droneData.coordinates}</h4>
          {droneData.image_url && (
            <Image
              className="droneImage"
              src={droneData.image_url}
              alt="drone stream"
              width={500}
              height={300}
            />
          )}
        </div>
      ) : (
        <p className="droneNoDataText">No data yet...</p>
      )}
    </div>
  );
}
