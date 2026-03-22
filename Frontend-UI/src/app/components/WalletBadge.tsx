'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext'; // Adjust path
import { refreshAccessTokenIfNeeded } from '../../utils/tokenUtils'; // Adjust path

export default function WalletBadge() {
  const { accessToken, refreshToken } = useAuth();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const DJANGO_URL = process.env.NEXT_PUBLIC_DJANGO_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    const fetchWallet = async () => {
      if (!accessToken) return;
      
      try {
        // Ensure token is fresh before requesting
        const freshToken = await refreshAccessTokenIfNeeded(accessToken, refreshToken);

        // Fetch from the wallet management endpoint you defined in urls.py
        const res = await fetch(`${DJANGO_URL}/management/wallet/`, {
          headers: {
            'Authorization': `Bearer ${freshToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (res.ok) {
          const data = await res.json();
          // Adjust this key based on exactly what your Django view returns 
          if (data.wallet_address) {
            setWalletAddress(data.wallet_address);
          }
        }
      } catch (error) {
        console.error("Failed to fetch wallet address:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWallet();
  }, [accessToken, refreshToken, DJANGO_URL]);

  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      alert("Wallet address copied!");
    }
  };

  // Format the address for display (e.g., 0x1234...ABCD)
  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  if (loading) return <div className="wallet-badge loading">Syncing Enclave...</div>;

  if (!walletAddress) {
    return (
      <a 
        href="/downloads/claware-setup.exe" 
        className="wallet-badge disconnected onboard-btn" 
        title="Download Claware Hardware Wallet"
      >
        <span className="dot red"></span> Onboard to Web3
        <span className="download-icon">📥</span>

        <style jsx>{`
          .wallet-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            cursor: pointer;
            transition: all 0.2s ease;
            text-decoration: none;
          }
          .wallet-badge.disconnected {
            background: #fef2f2;
            color: #ef4444;
            border: 1px solid #fecaca;
          }
          .wallet-badge.disconnected.onboard-btn:hover {
            background: #fee2e2;
            transform: translateY(-1px);
            box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);
          }
          .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
          }
          .dot.red {
            background-color: #ef4444;
            box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
          }
          .download-icon {
            font-size: 1rem;
            margin-left: 2px;
          }
        `}</style>
      </a>
    );
  }

  return (
    <div className="wallet-badge connected" onClick={handleCopy} title="Click to copy full address">
      <span className="dot green"></span>
      <span className="address-text">{formatAddress(walletAddress)}</span>
      <span className="copy-icon">📋</span>

      <style jsx>{`
        .wallet-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .wallet-badge.connected {
          background: #ecfdf5;
          color: #059669;
          border: 1px solid #a7f3d0;
        }
        .wallet-badge.connected:hover {
          background: #d1fae5;
          transform: translateY(-1px);
        }
        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .dot.green {
          background-color: #10b981;
          box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
        }
        .copy-icon {
          opacity: 0.5;
        }
        .wallet-badge:hover .copy-icon {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}