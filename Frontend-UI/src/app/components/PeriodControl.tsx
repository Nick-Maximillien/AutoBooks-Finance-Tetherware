'use client';

import React, { useState } from 'react';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';

// 1. ADD THE PROP HERE
interface PeriodControlProps {
  isExportDone?: boolean;
}

export default function PeriodControl({ isExportDone = false }: PeriodControlProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  const handleClosePeriod = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      if (!accessToken || !refreshToken) throw new Error('Missing authentication tokens.');

      const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';

      // Maps to the CloseFinancialPeriodView we verified in views.py
      const response = await fetch(`${baseUrl}/financial-period/close/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to close period.');

      setMessage({ type: 'success', text: data.message || 'Financial Year Closed Successfully!' });
      setConfirming(false);
      
      // Auto-refresh the dashboard after 2.5 seconds so the new Balance Sheet/P&L renders
      setTimeout(() => window.location.reload(), 2500);
      
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="period-control-card">
      <div className="header">
        <h3>Year-End Close</h3>
        <span className="status-badge">Requires Authorization</span>
      </div>

      <div className="content">
        {message ? (
          <div className={`message-box ${message.type}`}>
            {message.type === 'success' ? '' : ''} {message.text}
          </div>
        ) : !confirming ? (
          <>
            <p className="description">
              Lock the current financial year. This will autonomously run <strong>IFRS Depreciation & Appreciation</strong>, transfer Net Income to <strong>Retained Earnings</strong>, and roll the ledger forward.
            </p>
            
            {/* 2. WIRE THE PROP TO DISABLE THIS BUTTON */}
            <button 
              className={`initiate-btn ${!isExportDone ? 'disabled-btn' : ''}`} 
              onClick={() => setConfirming(true)}
              disabled={!isExportDone}
            >
              {!isExportDone ? ' Export Ledger to Unlock' : 'Initiate Period Close'}
            </button>
          </>
        ) : (
          <div className="confirmation-zone">
            <p className="warning-text"> <strong>IRREVERSIBLE ACTION:</strong> Are you absolutely sure you want to lock this period?</p>
            <div className="action-buttons">
              <button className="cancel-btn" onClick={() => setConfirming(false)} disabled={loading}>
                Cancel
              </button>
              <button className="confirm-btn" onClick={handleClosePeriod} disabled={loading}>
                {loading ? 'Executing Close...' : 'Confirm & Lock Ledger'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .period-control-card {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
          padding: 1.5rem;
          margin-bottom: 2rem;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .header h3 { margin: 0; color: #0f172a; font-size: 1.25rem; font-weight: 700; }
        
        .status-badge {
          background: #fef3c7; color: #b45309; padding: 4px 10px; border-radius: 99px; font-size: 0.75rem; font-weight: 700;
        }

        .description { color: #64748b; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1.25rem; }

        .initiate-btn {
          width: 100%; background: #0f172a; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;
        }
        .initiate-btn:hover:not(:disabled) { background: #334155; }

        /* 3. ADD STYLING FOR THE DISABLED STATE */
        .disabled-btn {
          background: #94a3b8 !important;
          cursor: not-allowed;
          opacity: 0.7;
        }

        .confirmation-zone {
          background: #fef2f2; border: 1px solid #fecaca; padding: 1rem; border-radius: 8px;
        }

        .warning-text { color: #991b1b; font-size: 0.9rem; margin-top: 0; margin-bottom: 1rem; }

        .action-buttons { display: flex; gap: 10px; }

        .cancel-btn {
          flex: 1; background: white; border: 1px solid #cbd5e1; color: #475569; padding: 8px; border-radius: 6px; font-weight: 600; cursor: pointer;
        }

        .confirm-btn {
          flex: 2; background: #dc2626; border: none; color: white; padding: 8px; border-radius: 6px; font-weight: 600; cursor: pointer;
        }
        .confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .message-box { padding: 1rem; border-radius: 8px; font-weight: 600; font-size: 0.95rem; }
        .message-box.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
        .message-box.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
      `}</style>
    </div>
  );
}