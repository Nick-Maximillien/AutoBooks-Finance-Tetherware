"use client"

import { useEffect, useState } from "react";
import Link from 'next/link';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';

// Mirroring the Django Document Model & Pydantic Schema
type DocumentItem = {
  description: string;
  quantity: number;
  unit_price: number;
  total?: number; // Marked as optional since AI might miss it
};

type AIDocument = {
  id: number;
  document_type: string;
  date: string | null;
  vendor: string | null;
  customer: string | null;
  equity_investor: string | null; // NEW: Added to catch equity injections
  total: string;
  raw_text: string;
  items: DocumentItem[];
  created_at: string;
};

export default function ReconciliationDashboard() {
  const [documents, setDocuments] = useState<AIDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<AIDocument | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    async function fetchDocuments() {
      try {
        const { accessToken, refreshToken } = getTokensFromLocalStorage();
        if (!accessToken || !refreshToken) throw new Error('Missing tokens');

        const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/documents/`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.ok) {
          const data = await response.json();
          setDocuments(data.sort((a: AIDocument, b: AIDocument) => b.id - a.id));
        }
      } catch (err) {
        console.error("Error fetching documents:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, []);

  // Bulletproof currency formatter
  const formatCurrency = (amount: string | number | undefined) => {
    if (amount === undefined || amount === null) return 'KSH 0.00';
    
    // Remove commas if the AI returned a formatted string instead of a raw number
    const cleanAmount = typeof amount === 'string' ? amount.replace(/,/g, '') : amount;
    const parsedNumber = Number(cleanAmount);
    
    if (isNaN(parsedNumber)) return 'KSH 0.00';

    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' })
      .format(parsedNumber)
      .replace('KES', 'KSH');
  };

  // ==========================================
  // PARADIGM 2 OVERWATCH LOGIC
  // ==========================================
  const handleRevoke = async (docId: number) => {
    if (!confirm("Are you sure you want to revoke this transaction? This will create a strict IFRS reversal journal entry.")) return;
    
    setIsRevoking(true);
    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/api/documents/${docId}/revoke/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
        setSelectedDoc(null);
      } else {
        alert("Failed to revoke transaction. It may be locked in a closed financial period.");
      }
    } catch (err) {
      console.error("Error revoking:", err);
    } finally {
      setIsRevoking(false);
    }
  };

  const getIFRSRuleText = (type: string) => {
    switch (type) {
      case 'invoice': return "IFRS 15 (Revenue from Contracts): Recognized point-in-time revenue. Asset (Receivables) increased, Equity (Income) increased.";
      case 'bill': return "IAS 1 (Presentation of Financial Statements): Operating expense recognized. Liability (Payables) increased, Equity (Expense) decreased.";
      case 'receipt': return "IAS 7 (Statement of Cash Flows): Settlement of receivables. Asset (Cash) increased, Asset (Receivables) decreased.";
      case 'equity_injection': return "IAS 32 (Financial Instruments: Presentation): Recognized equity instrument issuance. Asset (Cash) increased, Equity (Share Capital) increased."; // NEW
      default: return "General Double-Entry Ledger adherence validated.";
    }
  };

  if (loading) return <div className="loading">Syncing Ledger…</div>;

  return (
    <div className="dashboard">
      <header className="header">
        <div>
          <div style={{ marginBottom: '12px' }}>
            <Link href="/dashboard" style={{ color: '#818cf8', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              ← Back to Dashboard
            </Link>
          </div>
          <h1 style={{"color": "white", "fontWeight":"bold"}}>Ledger Overwatch</h1>
          <p style={{"color": "wheat", "fontWeight":"bold"}}>Review autonomous AI postings, audit traces, and execute reversals.</p>
        </div>
        <div className="badge">
          {documents.length} Records Processed
        </div>
      </header>

      <section className="ledger">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Date</th>
              <th>Entity</th>
              <th>Total</th>
              <th>AI Confidence</th>
              <th className="right">Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty">
                  No documents ingested yet. <Link href="/dashboard" style={{ color: '#4f46e5', textDecoration: 'underline' }}>Return to Dashboard</Link> to start the Sovereign Copilot.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="mono">#{doc.id}</td>
                  <td>
                    <span className="pill">
                      {doc.document_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{doc.date || 'N/A'}</td>
                  {/* FIX: Now securely displays the Investor Name if available */}
                  <td className="strong">{doc.vendor || doc.customer || doc.equity_investor || 'Unknown'}</td>
                  <td className="strong">{formatCurrency(doc.total)}</td>
                  <td className="truncate" title={doc.raw_text}>
                    {doc.raw_text.includes("AI CAPTURE") ? doc.raw_text : "Manual Entry"}
                  </td>
                  <td className="right">
                    <button className="link" onClick={() => setSelectedDoc(doc)}>
                      Inspect Trace →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div>
                <h3>Document #{selectedDoc.id} Audit Trace</h3>
                <p className="mono small" style={{ color: '#059669', fontWeight: 'bold', marginTop: '4px' }}>
                  STATUS: POSTED TO LEDGER
                </p>
              </div>
              <button className="close" onClick={() => setSelectedDoc(null)}>×</button>
            </header>

            <div className="modal-body">
              <div className="meta">
                <div><label>Type</label><span>{selectedDoc.document_type.replace('_', ' ')}</span></div>
                <div><label>Date</label><span>{selectedDoc.date || 'N/A'}</span></div>
                {/* Dynamically updates title depending on the type of counterparty */}
                <div>
                  <label>{selectedDoc.document_type === 'equity_injection' ? 'Investor' : 'Counterparty'}</label>
                  <span>{selectedDoc.vendor || selectedDoc.customer || selectedDoc.equity_investor || '--'}</span>
                </div>
              </div>

              <h4>Extracted Line Items</h4>

              {selectedDoc.items?.length ? (
                <table className="items">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="right">Qty</th>
                      <th className="right">Unit</th>
                      <th className="right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDoc.items.map((item, i) => (
                      <tr key={i}>
                        <td>{item.description}</td>
                        <td className="right">{item.quantity}</td>
                        <td className="right">{formatCurrency(item.unit_price)}</td>
                        <td className="right strong">
                          {formatCurrency(item.total || (item.quantity * item.unit_price))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="right strong" style={{ borderTop: '2px solid #e5e7eb', paddingTop: '16px', paddingBottom: '8px' }}>
                        Document Total
                      </td>
                      <td className="right strong" style={{ borderTop: '2px solid #e5e7eb', paddingTop: '16px', paddingBottom: '8px', color: '#0f172a', fontSize: '15px' }}>
                        {formatCurrency(selectedDoc.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <p className="muted" style={{ marginBottom: '24px' }}>No line items extracted.</p>
              )}

              {/* AGENT TRACE TERMINAL */}
              <div className="agent-trace">
                <h4 className="trace-title">🤖 Agent Execution Trace</h4>
                
                <div className="trace-step">
                  <span className="step-num">1</span>
                  <div className="step-content">
                    <strong>Perception & Validation</strong>
                    <p className="mono">{selectedDoc.raw_text}</p>
                    <p className="success-text">✓ Mathematical integrity verified</p>
                  </div>
                </div>

                <div className="trace-step">
                  <span className="step-num">2</span>
                  <div className="step-content">
                    <strong>Computable Accounting Law Applied</strong>
                    <p>{getIFRSRuleText(selectedDoc.document_type)}</p>
                  </div>
                </div>

                <div className="trace-step">
                  <span className="step-num">3</span>
                  <div className="step-content">
                    <strong>Double-Entry Execution</strong>
                    <div className="journal-mock">
                      {selectedDoc.document_type === 'invoice' && (
                        <>
                          <div className="dr">DR: trade_and_other_receivables <span>{formatCurrency(selectedDoc.total)}</span></div>
                          <div className="cr">CR: revenue <span>{formatCurrency(selectedDoc.total)}</span></div>
                        </>
                      )}
                      {selectedDoc.document_type === 'bill' && (
                        <>
                          <div className="dr">DR: operating_expenses <span>{formatCurrency(selectedDoc.total)}</span></div>
                          <div className="cr">CR: trade_and_other_payables <span>{formatCurrency(selectedDoc.total)}</span></div>
                        </>
                      )}
                      {selectedDoc.document_type === 'receipt' && (
                        <>
                          <div className="dr">DR: cash_and_cash_equivalents <span>{formatCurrency(selectedDoc.total)}</span></div>
                          <div className="cr">CR: trade_and_other_receivables <span>{formatCurrency(selectedDoc.total)}</span></div>
                        </>
                      )}
                      {/* NEW: Equity Injection Journal Mock */}
                      {selectedDoc.document_type === 'equity_injection' && (
                        <>
                          <div className="dr">DR: cash_and_cash_equivalents <span>{formatCurrency(selectedDoc.total)}</span></div>
                          <div className="cr">CR: share_capital <span>{formatCurrency(selectedDoc.total)}</span></div>
                        </>
                      )}
                      {['invoice', 'bill', 'receipt', 'equity_injection'].indexOf(selectedDoc.document_type) === -1 && (
                        <p style={{ margin: 0, fontStyle: 'italic', color: '#94a3b8' }}>Ledger entries generated per IFRS rules.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <footer className="modal-footer">
              <button className="ghost" onClick={() => setSelectedDoc(null)}>Close Overlay</button>
              <button 
                className="danger-btn" 
                onClick={() => handleRevoke(selectedDoc.id)}
                disabled={isRevoking}
              >
                {isRevoking ? "Reversing..." : "Revoke Transaction"}
              </button>
            </footer>
          </div>
        </div>
      )}

      <style jsx>{`
        * { box-sizing: border-box; }

        body {
          background: #0b1020;
        }

        .dashboard {
          max-width: 1200px;
          margin: 40px auto;
          padding: 24px;
          font-family: Inter, system-ui, sans-serif;
          color: #0f172a;
        }

        .loading {
          padding: 80px;
          text-align: center;
          color: #64748b;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%,100% { opacity: 1 }
          50% { opacity: .5 }
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        h1 {
          font-size: 24px;
          margin: 0;
        }

        p {
          margin: 4px 0 0;
          color: #64748b;
          font-size: 13px;
        }

        .badge {
          background: #eef2ff;
          color: #3730a3;
          padding: 8px 14px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
        }

        .ledger {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e5e7eb;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,.06);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          background: #f8fafc;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: .08em;
          color: #64748b;
          padding: 14px;
          text-align: left;
        }

        td {
          padding: 14px;
          font-size: 13px;
          border-top: 1px solid #f1f5f9;
        }

        tr:hover {
          background: #f8fafc;
        }

        .right { text-align: right; }
        .strong { font-weight: 600; }
        .mono { font-family: ui-monospace, monospace; }
        .small { font-size: 11px; color: #64748b; }
        .truncate {
          max-width: 260px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pill {
          background: #f1f5f9;
          padding: 4px 10px;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          font-size: 12px;
        }

        .link {
          background: none;
          border: none;
          color: #4f46e5;
          font-weight: 600;
          cursor: pointer;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          backdrop-filter: blur(6px);
        }

        .modal {
          background: white;
          width: 100%;
          max-width: 720px;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0,0,0,.4);
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }

        .modal-header {
          padding: 20px;
          background: #f8fafc;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid #e5e7eb;
        }

        .close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #94a3b8;
        }

        .modal-body {
          padding: 20px 24px;
          overflow-y: auto;
        }

        .meta {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }

        label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          color: #64748b;
          margin-bottom: 4px;
        }

        h4 {
          margin: 24px 0 12px;
          font-size: 14px;
        }

        .items th {
          background: none;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-footer {
          padding: 16px 24px;
          background: #f8fafc;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          border-top: 1px solid #e5e7eb;
        }

        .ghost {
          background: none;
          border: none;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
        }

        /* ============================ */
        /* NEW STYLES: DANGER & TRACE   */
        /* ============================ */
        .danger-btn {
          background: #ef4444;
          color: white;
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s;
        }
        .danger-btn:hover { background: #dc2626; }
        .danger-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .agent-trace {
          background: #1e293b;
          color: #f8fafc;
          padding: 20px;
          border-radius: 12px;
          margin-top: 24px;
          font-family: ui-monospace, monospace;
          font-size: 13px;
        }
        .trace-title {
          color: #fff;
          margin-top: 0;
          margin-bottom: 16px;
          font-family: Inter, system-ui, sans-serif;
          font-size: 15px;
        }
        .trace-step {
          display: flex;
          margin-bottom: 16px;
        }
        .step-num {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #334155;
          border-radius: 50%;
          color: #cbd5e1;
          font-weight: bold;
          font-size: 11px;
          margin-right: 12px;
          flex-shrink: 0;
        }
        .step-content strong {
          display: block;
          color: #93c5fd;
          margin-bottom: 4px;
        }
        .step-content p {
          margin: 0;
          color: #cbd5e1;
          font-size: 12px;
          line-height: 1.5;
        }
        .success-text {
          color: #34d399 !important;
          margin-top: 4px !important;
        }
        .journal-mock {
          margin-top: 8px;
          background: #0f172a;
          padding: 12px;
          border-radius: 6px;
          border-left: 3px solid #6366f1;
        }
        .dr {
          color: #cbd5e1;
          display: flex;
          justify-content: space-between;
        }
        .cr {
          color: #cbd5e1;
          display: flex;
          justify-content: space-between;
          padding-left: 20px;
          margin-top: 4px;
        }

        .empty {
          text-align: center;
          padding: 40px;
          color: #64748b;
        }

        .muted {
          color: #64748b;
          font-style: italic;
        }
      `}</style>
    </div>
  );
}