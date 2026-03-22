'use client';

import { useEffect, useState } from 'react';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '@utils/tokenUtils';

interface Farm {
  id: number;
  name: string;
  location: string;
  size_hectares: number;
}

export default function Farms() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        const { accessToken, refreshToken } = getTokensFromLocalStorage();
        if (!accessToken || !refreshToken) throw new Error('Missing tokens');

        const validToken = await refreshAccessTokenIfNeeded(accessToken, refreshToken);

        const res = await fetch(`${process.env.NEXT_PUBLIC_DJANGO_API_URL}/dashboard/`, {
          headers: {
            Authorization: `Bearer ${validToken}`,
          },
        });

        if (!res.ok) throw new Error('Failed to fetch farms');

        const data: Farm[] = await res.json();
        setFarms(data);
      } catch (err) {
        console.error('❌ Farms fetch error:', err);
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchFarms();
  }, []);

  if (loading) return <p className="farmStatus">Loading farms...</p>;
  if (error) return <p className="farmStatus errorText">{error}</p>;

  return (
    <div className="farmList">
      <h2 className="farmListHeading">Your Farms</h2>
      {farms.length === 0 ? (
        <p className="farmStatus">No farms created yet.</p>
      ) : (
        farms.map((farm) => (
          <div key={farm.id} className="farmCard">
            <h4>{farm.name} Farm</h4>
            <p><strong>📍 Location:</strong> {farm.location}</p>
            <p><strong>🌾 Size:</strong> {farm.size_hectares} hectares</p>
          </div>
        ))
      )}
    </div>
  );
}
