'use client';

import React, { useState, useEffect } from 'react';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';

export default function JournalComponent() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJournal() {
      try {
        const { accessToken, refreshToken } = getTokensFromLocalStorage();
        if (!accessToken || !refreshToken) throw new Error('Missing tokens.');

        const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
        const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';
        
        const response = await fetch(`${baseUrl}/journal-entries/`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch journal.');

        const data = await response.json();
        
        const sortedData = data.sort((a: any, b: any) => {
           const txnA = a.transaction?.id || 0;
           const txnB = b.transaction?.id || 0;
           if (txnB !== txnA) return txnB - txnA;
           return a.entry_type === 'debit' ? -1 : 1;
        });

        setEntries(sortedData);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchJournal();
  }, []);

  const getTxnId = (entry: any) => entry.transaction?.id || 'N/A';

  const getFormattedDate = (entry: any) => {
    const rawDate = entry.transaction?.created_at || entry.transaction?.date || entry.created_at;
    if (!rawDate) return "--";
    try {
      const d = new Date(rawDate);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric', 
        month: 'short', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false // 24-hour time looks more technical
      }).format(d);
    } catch (e) {
      return rawDate.split('T')[0];
    }
  };

  const getDesc = (entry: any) => entry.transaction?.description || "AUTONOMOUS_LEDGER_ENTRY";

  const getAccountName = (entry: any) => {
    const rawName = entry.account?.name || entry.account?.ifrs_account || 'UNKNOWN';
    if (rawName.includes('_')) {
        return rawName.toUpperCase(); // Force uppercase for system feel
    }
    return rawName.toUpperCase();
  };

  const formatCurrency = (amount: string | number) => {
    const num = Number(amount);
    if (isNaN(num)) return '0.00';
    return new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2 }).format(num);
  };

  if (loading) return <div className="hw-state loading">SYNCING_LEDGER_BLOCKS...<span className="cursor">_</span></div>;
  if (error) return <div className="hw-state error">ERR: {error}</div>;
  if (entries.length === 0) return <div className="hw-state empty">LEDGER_EMPTY. NO_BLOCKS_FOUND.</div>;

  return (
    <div className="hw-journal-wrapper">
      <div className="hw-journal-header">
        <h3 className="hw-title">CRYPTOGRAPHIC_LEDGER</h3>
        <span className="hw-badge">[{entries.length} RECORDS]</span>
      </div>
      
      <div className="hw-table-container hw-custom-scrollbar">
        <table className="hw-journal-table">
          <thead>
            <tr>
              <th>TIMESTAMP</th>
              <th>TX_ID</th>
              <th>PAYLOAD_DESC</th>
              <th>TARGET_ACCOUNT</th>
              <th className="right-align">DR_IN</th>
              <th className="right-align">CR_OUT</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const currentTxnId = getTxnId(entry);
              const previousTxnId = idx > 0 ? getTxnId(entries[idx - 1]) : null;
              const isNewTransaction = idx === 0 || currentTxnId !== previousTxnId;
              
              return (
                <tr key={entry.id || idx} className={isNewTransaction ? "hw-new-txn-row" : "hw-sub-txn-row"}>
                  <td className="hw-date-col">{isNewTransaction ? getFormattedDate(entry) : ""}</td>
                  <td className="hw-id-col">{isNewTransaction ? `0x${currentTxnId.toString().padStart(4, '0')}` : ""}</td>
                  <td className="hw-desc-col">
                    <div className="hw-truncate" title={getDesc(entry)}>
                      {isNewTransaction ? getDesc(entry) : ""}
                    </div>
                  </td>
                  <td className="hw-account-cell">
                    {entry.entry_type === 'credit' && <span className="hw-cr-indent">└─</span>}
                    {getAccountName(entry)}
                  </td>
                  <td className="right-align hw-dr-amt">
                    {entry.entry_type === 'debit' ? formatCurrency(entry.amount) : ""}
                  </td>
                  <td className="right-align hw-cr-amt">
                    {entry.entry_type === 'credit' ? formatCurrency(entry.amount) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .hw-journal-wrapper {
          background: #020617; /* Deep terminal background */
          border-radius: 8px;
          border: 2px solid #1e293b;
          box-shadow: 0 10px 30px rgba(0,0,0,0.8), inset 0 0 20px rgba(0,0,0,1);
          display: flex;
          flex-direction: column;
          height: 500px; 
          overflow: hidden;
          font-family: 'Courier New', Courier, monospace;
          position: relative;
        }

        /* Subtle scanline effect */
        .hw-journal-wrapper::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0),
            rgba(255, 255, 255, 0) 50%,
            rgba(0, 0, 0, 0.15) 50%,
            rgba(0, 0, 0, 0.15)
          );
          background-size: 100% 4px;
          pointer-events: none;
          opacity: 0.3;
          z-index: 20;
        }

        .hw-journal-header {
          padding: 16px 20px;
          border-bottom: 2px solid #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #000000;
          flex-shrink: 0;
          z-index: 10;
        }

        .hw-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255,255,255,0.3);
        }

        .hw-badge {
          background: #0f172a;
          color: #38bdf8;
          border: 1px solid #38bdf8;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 900;
          letter-spacing: 1px;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.2);
        }

        .hw-table-container {
          overflow-y: auto;
          flex: 1;
          min-height: 0;
          background: #020617;
          position: relative;
          z-index: 5;
        }

        .hw-journal-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        th {
          background: #0f172a;
          padding: 14px 16px;
          font-size: 0.75rem;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: #94a3b8;
          border-bottom: 2px solid #334155;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        td {
          padding: 10px 16px;
          font-size: 0.85rem;
          vertical-align: top;
          color: #cbd5e1;
        }

        .hw-new-txn-row td {
          border-top: 1px solid #1e293b;
          padding-top: 16px; 
        }

        tr:hover td { 
          background: rgba(56, 189, 248, 0.05); 
        }

        .right-align { text-align: right; }
        
        .hw-date-col { 
          color: #64748b; 
          white-space: nowrap; 
          font-size: 0.75rem; 
        }
        
        .hw-id-col { 
          color: #f59e0b; 
          font-weight: bold;
        }
        
        .hw-desc-col { 
          width: 35%; 
          color: #94a3b8; 
        }
        
        .hw-truncate {
          display: -webkit-box; 
          -webkit-line-clamp: 2; 
          -webkit-box-orient: vertical; 
          overflow: hidden; 
          line-height: 1.4;
        }

        .hw-account-cell { 
          font-weight: bold; 
          color: #e2e8f0; 
          white-space: nowrap; 
        }
        
        .hw-cr-indent { 
          color: #64748b; 
          margin-right: 8px; 
          margin-left: 15px; 
        }

        .hw-dr-amt { 
          color: #34d399; /* Green for debit in (assets usually) */
          font-weight: 900; 
          white-space: nowrap; 
          text-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
        }
        
        .hw-cr-amt { 
          color: #38bdf8; /* Blue for credit out */
          font-weight: 900; 
          white-space: nowrap; 
          text-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
        }

        .hw-state { 
          padding: 40px; 
          text-align: center; 
          font-family: 'Courier New', Courier, monospace;
          font-weight: bold;
          letter-spacing: 2px;
          background: #020617;
          border: 2px solid #1e293b;
          border-radius: 8px;
        }
        .loading { color: #38bdf8; }
        .error { color: #ef4444; }
        .empty { color: #64748b; }
        
        .cursor {
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        
        .hw-custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .hw-custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 0; }
        .hw-custom-scrollbar::-webkit-scrollbar-track { background: #000; }
      `}</style>
    </div>
  );
}