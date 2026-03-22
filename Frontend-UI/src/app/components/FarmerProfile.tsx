'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '@utils/tokenUtils';

interface FarmerProfileType {
  business_name?: string;
  email?: string;
  phone?: string;
  image?: string;
  address?: string;
  created_at?: string;
  current_period_opened?: boolean;
  financial_year_start?: string;
  financial_year_end?: string;
}

export default function FarmerProfile() {
  const [profile, setProfile] = useState<FarmerProfileType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { accessToken, refreshToken } = getTokensFromLocalStorage();
        if (!accessToken || !refreshToken) return;
        const validToken = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/business/profile/`, {
          headers: { Authorization: `Bearer ${validToken}` },
        });
        if (!res.ok) throw new Error('Failed to fetch farmer profile');
        const data: FarmerProfileType = await res.json();
        setProfile(data);
      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('Could not load profile.');
      }
    };
    fetchProfile();
  }, []);

  if (error) return <div className="profile-pill err">{error}</div>;
  if (!profile) return <div className="profile-pill loading">Loading...</div>;

  return (
    <div className="profile-pill-wrapper">
      <div className="profile-pill">
        {profile.image ? (
          <Image
            className="avatar"
            src={`${process.env.NEXT_PUBLIC_DJANGO_API_URL}${profile.image}`}
            alt="profile"
            width={28}
            height={28}
          />
        ) : (
          <div className="avatar-fallback">🏢</div>
        )}
        <span className="biz-name">{profile.business_name || 'My Business'}</span>
      </div>

      {/* Hover Tooltip to keep backend data accessible but out of the way */}
      <div className="profile-tooltip">
        <p><b>Email:</b> {profile.email || 'N/A'}</p>
        <p><b>Phone:</b> {profile.phone || 'N/A'}</p>
        <p><b>Address:</b> {profile.address || 'N/A'}</p>
        <p><b>Created At:</b> {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}</p>
        <p><b>FY:</b> {profile.financial_year_start} to {profile.financial_year_end}</p>
      </div>

      <style jsx>{`
        .profile-pill-wrapper {
          position: relative;
          display: inline-block;
        }
        .profile-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f1f5f9;
          padding: 4px 12px 4px 4px;
          border-radius: 50px;
          border: 1px solid #cbd5e1;
          cursor: pointer;
          font-size: 0.85rem;
          color: #0f172a;
          font-weight: 600;
        }
        .avatar {
          border-radius: 50%;
          object-fit: cover;
        }
        .avatar-fallback {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }
        .profile-tooltip {
          position: absolute;
          top: 120%;
          left: 0;
          background: #0f172a;
          color: #f8fafc;
          padding: 12px;
          border-radius: 8px;
          width: 240px;
          font-size: 0.75rem;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s;
          z-index: 50;
        }
        .profile-pill-wrapper:hover .profile-tooltip {
          opacity: 1;
          visibility: visible;
        }
        .profile-tooltip p {
          margin: 4px 0;
        }
        .profile-tooltip b {
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}