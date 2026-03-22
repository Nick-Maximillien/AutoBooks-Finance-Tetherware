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

  // FIX: Now includes hours, minutes, and seconds
  const getFormattedDate = (entry: any) => {
    // FIX: Prioritize created_at FIRST. If it fails, fallback to date.
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
        hour12: true
      }).format(d);
    } catch (e) {
      return rawDate.split('T')[0];
    }
  };

  const getDesc = (entry: any) => entry.transaction?.description || "Autonomous Ledger Entry";

  const getAccountName = (entry: any) => {
    const rawName = entry.account?.name || entry.account?.ifrs_account || 'Unknown';
    if (rawName.includes('_')) {
        return rawName.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    return rawName;
  };

  const formatCurrency = (amount: string | number) => {
    const num = Number(amount);
    if (isNaN(num)) return 'KSH 0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' })
      .format(num).replace('KES', 'KSH');
  };

  if (loading) return <div className="loading">📖 Syncing General Journal...</div>;
  if (error) return <div className="error">❌ {error}</div>;
  if (entries.length === 0) return <div className="empty">📭 The journal is empty.</div>;

  return (
    <div className="journal-wrapper">
      <div className="journal-header">
        <h3>General Journal</h3>
        <span className="badge">{entries.length} Entries</span>
      </div>
      
      <div className="table-container custom-scrollbar">
        <table className="journal-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Txn ID</th>
              <th>Description</th>
              <th>Account</th>
              <th className="right-align">Debit (DR)</th>
              <th className="right-align">Credit (CR)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, idx) => {
              const currentTxnId = getTxnId(entry);
              const previousTxnId = idx > 0 ? getTxnId(entries[idx - 1]) : null;
              const isNewTransaction = idx === 0 || currentTxnId !== previousTxnId;
              
              return (
                <tr key={entry.id || idx} className={isNewTransaction ? "new-txn-row" : "sub-txn-row"}>
                  <td className="date-col">{isNewTransaction ? getFormattedDate(entry) : ""}</td>
                  <td className="id-col">{isNewTransaction ? `#${currentTxnId}` : ""}</td>
                  <td className="desc-col">
                    <div className="truncate-multiline" title={getDesc(entry)}>
                      {isNewTransaction ? getDesc(entry) : ""}
                    </div>
                  </td>
                  <td className="account-cell">
                    {entry.entry_type === 'credit' && <span className="cr-indent">↳</span>}
                    {getAccountName(entry)}
                  </td>
                  <td className="right-align dr-amt">
                    {entry.entry_type === 'debit' ? formatCurrency(entry.amount) : ""}
                  </td>
                  <td className="right-align cr-amt">
                    {entry.entry_type === 'credit' ? formatCurrency(entry.amount) : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .journal-wrapper {
          background: #ffffff;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
          display: flex;
          flex-direction: column;
          height: 450px; /* FIX: Locked height so it doesn't push Analytics off-screen */
          overflow: hidden;
        }

        .journal-header {
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
          flex-shrink: 0; /* Prevents header from collapsing */
        }

        .journal-header h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
          color: #0f172a;
        }

        .badge {
          background: #eef2ff;
          color: #4f46e5;
          padding: 4px 12px;
          border-radius: 99px;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .table-container {
          overflow-y: auto;
          flex: 1;
          min-height: 0; /* FIX: Forces flexbox to respect the parent's max-height and allow scrolling */
        }

        .journal-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        th {
          background: #ffffff;
          padding: 12px 16px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          border-bottom: 2px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        td {
          padding: 8px 16px;
          font-size: 0.9rem;
          vertical-align: top;
          color: #334155;
        }

        .new-txn-row td {
          border-top: 1px solid #e2e8f0;
          padding-top: 16px; 
        }

        tr:hover td { background: #f8fafc; }

        .right-align { text-align: right; }
        .date-col { font-weight: 600; color: #475569; white-space: nowrap; font-size: 0.8rem; }
        .id-col { color: #94a3b8; font-family: 'ui-monospace', monospace; }
        
        .desc-col { width: 30%; color: #64748b; font-style: italic; }
        .truncate-multiline {
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;
        }

        .account-cell { font-weight: 600; color: #0f172a; white-space: nowrap; }
        .cr-indent { color: #94a3b8; margin-right: 8px; margin-left: 20px; }

        .dr-amt { color: #059669; font-family: 'ui-monospace', monospace; font-weight: 600; white-space: nowrap; }
        .cr-amt { color: #2563eb; font-family: 'ui-monospace', monospace; font-weight: 600; white-space: nowrap; }

        .loading, .error, .empty { padding: 40px; text-align: center; color: #64748b; font-weight: 500; }
        
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}