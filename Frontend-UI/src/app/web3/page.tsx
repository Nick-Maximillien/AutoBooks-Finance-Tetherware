'use client';

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';

export default function Web3OnboardingPage() {
  const [loading, setLoading] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState("celo-sepolia");
  const [onboardingResult, setOnboardingResult] = useState<any>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  const networks = [
    { id: "celo-sepolia", name: "Celo (Recommended for Low Gas)", recommended: true },
    { id: "ethereum-sepolia", name: "Ethereum", recommended: false },
    { id: "bnb-testnet", name: "BNB Smart Chain", recommended: false },
    { id: "base-sepolia", name: "Base (Coinbase L2)", recommended: false },
    { id: "arbitrum-sepolia", name: "Arbitrum One", recommended: false },
    { id: "polygon-amoy", name: "Polygon", recommended: false },
    { id: "optimism-sepolia", name: "Optimism", recommended: false },
    { id: "lisk-sepolia", name: "Lisk", recommended: false },
  ];

  const handleActivateWeb3 = async () => {
    setLoading(true);
    setError("");
    
    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      if (!accessToken || !refreshToken) throw new Error('Missing authentication tokens. Please log in.');

      const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';

      const response = await fetch(`${baseUrl}/web3/activate/`, { 
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ network: selectedNetwork })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to activate Web3 services.");
      }

      setOnboardingResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="card">
        <div className="header-section">
          <div className="icon-wrapper">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1>Activate Web3 Treasury</h1>
          <p>
            Opt-in to autonomous vendor payments, micro-payroll, and yield farming. 
            Your ledger will be automatically funded with an initial on-chain subsidy.
          </p>
        </div>

        {!onboardingResult ? (
          <div className="form-section">
            <div className="input-group">
              <label>Select Primary Blockchain Network</label>
              <select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
              >
                {networks.map((net) => (
                  <option key={net.id} value={net.id}>
                    {net.name} {net.recommended ? "⭐" : ""}
                  </option>
                ))}
              </select>
              <small>Note: Your generated wallet address will be fully EVM-compatible across all available chains.</small>
            </div>

            {error && (
              <div className="alert error">
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              onClick={handleActivateWeb3}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Generating Keys & Syncing Ledger..." : "Activate Web3 & Create Wallet"}
            </button>
          </div>
        ) : (
          <div className="success-section">
            <div className="success-banner">
              <h3>✅ Activation Successful!</h3>
              <p>{onboardingResult.message}</p>
              
              <div className="info-box">
                <span className="info-label">Universal EVM Address</span>
                <span className="info-value mono">{onboardingResult.wallet_address}</span>
              </div>

              <div className="info-box">
                <span className="info-label">IFRS Ledger Sync</span>
                <span className="info-value">{onboardingResult.financial_impact}</span>
              </div>
            </div>

            <button onClick={() => router.push("/dashboard")} className="btn-secondary">
              Return to Dashboard
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .page-container {
          min-height: 100vh;
          background-color: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .card {
          max-width: 500px;
          width: 100%;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
          padding: 40px;
          border: 1px solid #f1f5f9;
        }
        .header-section {
          text-align: center;
          margin-bottom: 32px;
        }
        .icon-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #eff6ff;
          color: #2563eb;
          margin-bottom: 16px;
        }
        .icon-wrapper svg {
          width: 32px;
          height: 32px;
        }
        h1 {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }
        p {
          color: #64748b;
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }
        .input-group {
          margin-bottom: 24px;
        }
        label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 8px;
        }
        select {
          width: 100%;
          padding: 12px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background-color: #f8fafc;
          font-size: 15px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.2s;
        }
        select:focus {
          border-color: #2563eb;
        }
        small {
          display: block;
          margin-top: 8px;
          font-size: 12px;
          color: #94a3b8;
        }
        .alert.error {
          background: #fef2f2;
          border: 1px solid #fee2e2;
          color: #b91c1c;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btn-primary {
          width: 100%;
          padding: 14px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-primary:hover:not(:disabled) {
          background: #1d4ed8;
        }
        .btn-primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .btn-secondary {
          width: 100%;
          padding: 14px;
          background: white;
          color: #334155;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-secondary:hover {
          background: #f8fafc;
        }
        .success-banner {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }
        .success-banner h3 {
          color: #166534;
          margin: 0 0 8px 0;
          font-size: 18px;
        }
        .success-banner p {
          color: #15803d;
          margin-bottom: 20px;
        }
        .info-box {
          background: white;
          border: 1px solid #dcfce7;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        .info-label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 4px;
        }
        .info-value {
          font-size: 14px;
          color: #0f172a;
          font-weight: 500;
          word-break: break-all;
        }
        .mono {
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}