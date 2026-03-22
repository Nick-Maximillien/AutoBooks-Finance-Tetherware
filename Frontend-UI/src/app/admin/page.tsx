"use client";

import React, { useState, useEffect } from "react";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';
import WalletBadge from "app/components/WalletBadge"; // Adjust path as needed

// Types
interface Employee { name: string; wallet: string; salary_per_period: number; }
interface Shareholder { name: string; wallet: string; equity_percentage: number; total_investment: number; }
interface TaxData {
  current_tax_liability: number; tax_expense: number; deferred_tax_liability: number; deferred_tax_asset: number;
  total_escrowed: number; statutory_tax_rate: number;
  recent_escrows: { date: string; description: string; tx_hash: string; amount: number; }[];
}
// UPDATED: Using balance_USDT to match Django backend views
interface WalletData { wallet_address: string; primary_network: string; balance_USDT: string; } 

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"wallet" | "employees" | "shareholders" | "tax_compliance">("wallet");
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error", msg: string } | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [taxData, setTaxData] = useState<TaxData | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [liquidityAmount, setLiquidityAmount] = useState("100");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      if (!accessToken || !refreshToken) return;
      const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';

      const headers = { Authorization: `Bearer ${token}` };
      const [empRes, shRes, taxRes, walRes] = await Promise.all([
        fetch(`${baseUrl}/management/employee/`, { headers }),
        fetch(`${baseUrl}/management/shareholder/`, { headers }),
        fetch(`${baseUrl}/management/tax-monitoring/`, { headers }),
        fetch(`${baseUrl}/management/wallet/`, { headers })
      ]);
      
      const empData = await empRes.json();
      const shData = await shRes.json();
      const taxDataRes = await taxRes.json();
      const walDataRes = await walRes.json();
      
      if (empData.employees?.length > 0) setEmployees(empData.employees);
      if (shData.shareholders) setShareholders(shData.shareholders);
      if (taxDataRes && !taxDataRes.error) setTaxData(taxDataRes);
      if (walDataRes && !walDataRes.error) setWalletData(walDataRes);
    } catch (error) {
      console.error("Failed to load admin data", error);
    }
  };

  const saveEmployees = async () => {
    setLoading(true); setNotification(null);
    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      const token = await refreshAccessTokenIfNeeded(accessToken!, refreshToken!);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';

      const response = await fetch(`${baseUrl}/management/employee/`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ employees })
      });
      if (response.ok) setNotification({ type: "success", msg: "Employee roster & wallets saved." });
      else throw new Error();
    } catch (err) { setNotification({ type: "error", msg: "Failed to save employees." }); }
    setLoading(false);
  };

  const saveShareholders = async () => {
    setLoading(true); setNotification(null);
    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      const token = await refreshAccessTokenIfNeeded(accessToken!, refreshToken!);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';

      const response = await fetch(`${baseUrl}/management/shareholder/`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ shareholders })
      });
      if (response.ok) setNotification({ type: "success", msg: "Cap Table Web3 mapping updated." });
      else throw new Error();
    } catch (err) { setNotification({ type: "error", msg: "Failed to update Cap Table." }); }
    setLoading(false);
  };

  const requestLiquidity = async () => {
    setLoading(true); setNotification(null);
    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      const token = await refreshAccessTokenIfNeeded(accessToken!, refreshToken!);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';

      const response = await fetch(`${baseUrl}/management/wallet/`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ amount_usdt: liquidityAmount }) // UPDATED to match Django view requirement
      });
      const data = await response.json();
      if (response.ok) {
        setNotification({ type: "success", msg: data.message });
        fetchData(); // Refresh balance after successful funding
      }
      else throw new Error(data.error);
    } catch (err: any) { setNotification({ type: "error", msg: err.message || "Liquidity request failed." }); }
    setLoading(false);
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Treasury & Administration</h1>
            <p>Manage IFRS records, Cap Table mapping, and Treasury Liquidity.</p>
          </div>
          {/* WALLET BADGE INTEGRATION: Will prompt .exe download if not connected */}
          <WalletBadge />
        </div>

        <div className="tabs">
          {["wallet", "employees", "shareholders", "tax_compliance"].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`tab-btn ${activeTab === tab ? "active" : ""}`}>
              {tab.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="content-area">
          {notification && (
            <div className={`alert ${notification.type}`}>{notification.msg}</div>
          )}

          {/* WALLET & LIQUIDITY TAB */}
          {activeTab === "wallet" && (
            <div>
              <h2 className="section-title">Treasury Wallet Management</h2>
              
              {!walletData ? (
                <div className="empty-state">Web3 Treasury not activated. Please download the Claware wallet and complete onboarding.</div>
              ) : (
                <div className="grid-split">
                  {/* Left Column: Live Balance & External Funding */}
                  <div className="flex-col">
                    <div className="card-box border-green bg-green">
                      <h3 className="text-sm font-bold uppercase mb-2 text-green">Live On-Chain Balance</h3>
                      <div className="metric-value text-green">{walletData.balance_USDT} USDT</div>
                      <p className="box-desc mt-2" style={{ color: '#15803d', margin: 0 }}>
                        Available for Payroll and Dividends on {walletData.primary_network}
                      </p>
                    </div>

                    <div className="card-box">
                      <h3 className="box-title">External Funding (Receive USDT)</h3>
                      <p className="box-desc">Transfer native USDT to this exact address via {walletData.primary_network}. External transfers bypass the IFRS ledger and must be reconciled manually.</p>
                      <div className="wallet-display">
                        <span className="mono">{walletData.wallet_address}</span>
                        <button onClick={() => navigator.clipboard.writeText(walletData.wallet_address)} className="btn-copy">Copy</button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Internal Funding */}
                  <div className="card-box border-blue fit-content">
                    <h3 className="box-title text-blue">Request Platform Liquidity</h3>
                    <p className="box-desc">Request a USDT advance from the Master Treasury. This is automatically recorded as a Short-Term Liability in the IFRS ledger.</p>
                    <div className="flex-row mt-4">
                      <div className="input-prefix">
                        <span className="prefix">USDT</span>
                        <input type="number" value={liquidityAmount} onChange={(e) => setLiquidityAmount(e.target.value)} min="1" className="flex-input" />
                      </div>
                      <button onClick={requestLiquidity} disabled={loading} className="btn-solid bg-blue">
                        {loading ? "Syncing..." : "Request Advance"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EMPLOYEES TAB */}
          {activeTab === "employees" && (
            <div>
              <h2 className="section-title">Employee Payroll Configurations</h2>
              {employees.length === 0 ? (
                <div className="empty-state">No employees configured yet. Click "Add Employee" below.</div>
              ) : (
                <div className="list-container">
                  {employees.map((emp, index) => (
                    <div key={index} className="list-item flex-row">
                      <div className="field-group flex-1">
                        <label>Name</label>
                        <input type="text" value={emp.name} onChange={(e) => { const newEmp = [...employees]; newEmp[index].name = e.target.value; setEmployees(newEmp); }} />
                      </div>
                      <div className="field-group flex-2">
                        <label>Web3 Wallet (0x...)</label>
                        <input type="text" value={emp.wallet} placeholder="0x..." className="mono" onChange={(e) => { const newEmp = [...employees]; newEmp[index].wallet = e.target.value; setEmployees(newEmp); }} />
                      </div>
                      <div className="field-group flex-1">
                        <label>Default Salary (KES)</label>
                        <input type="number" value={emp.salary_per_period} onChange={(e) => { const newEmp = [...employees]; newEmp[index].salary_per_period = Number(e.target.value); setEmployees(newEmp); }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="action-bar">
                <button onClick={() => setEmployees([...employees, { name: "", wallet: "", salary_per_period: 0 }])} className="btn-outline">+ Add Employee</button>
                <button onClick={saveEmployees} disabled={loading} className="btn-solid">Save Roster</button>
              </div>
            </div>
          )}

          {/* SHAREHOLDERS TAB */}
          {activeTab === "shareholders" && (
            <div>
              <h2 className="section-title">Capitalization Table & Dividend Routing</h2>
              <p className="subtitle">Equity percentages are dynamically calculated from recorded Equity Injection documents in the ledger.</p>
              
              {shareholders.length === 0 ? (
                <div className="empty-state">No shareholders found. Process an Equity Injection document to register investors.</div>
              ) : (
                <div className="list-container">
                  {shareholders.map((sh, index) => (
                    <div key={index} className="list-item flex-row highlight-row">
                      <div className="field-group flex-1">
                        <label>Investor</label>
                        <div className="value-text">{sh.name}</div>
                      </div>
                      <div className="field-group flex-1">
                        <label>Equity Stake</label>
                        <div className="value-highlight">{(sh.equity_percentage * 100).toFixed(2)}%</div>
                      </div>
                      <div className="field-group flex-3">
                        <label>Payout Wallet (0x...)</label>
                        <input type="text" value={sh.wallet || ''} placeholder="Configure wallet to enable dividend airdrops" className="mono border-blue" onChange={(e) => { const newSh = [...shareholders]; newSh[index].wallet = e.target.value; setShareholders(newSh); }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {shareholders.length > 0 && (
                <div className="action-bar">
                  <button onClick={saveShareholders} disabled={loading} className="btn-solid">Update Routing</button>
                </div>
              )}
            </div>
          )}

          {/* TAX COMPLIANCE TAB */}
          {activeTab === "tax_compliance" && (
            <div>
              <h2 className="section-title">Tax Monitoring & On-Chain Escrow</h2>
              {!taxData ? (
                <div className="empty-state">Loading tax data...</div>
              ) : (
                <>
                  <div className="metrics-grid">
                    <div className="metric-card border-red">
                      <label>Current Tax Liability</label>
                      <div className="metric-value text-red">KSH {taxData.current_tax_liability.toLocaleString()}</div>
                    </div>
                    <div className="metric-card border-gray">
                      <label>Tax Expense (P&L)</label>
                      <div className="metric-value text-dark">KSH {taxData.tax_expense.toLocaleString()}</div>
                    </div>
                    <div className="metric-card border-green bg-green">
                      <label>Total Web3 Escrowed</label>
                      <div className="metric-value text-green">KSH {taxData.total_escrowed.toLocaleString()}</div>
                    </div>
                  </div>

                  <div className="table-section mt-8">
                    <h3 className="section-subtitle">Recent Web3 Escrow Deposits</h3>
                    {taxData.recent_escrows.length === 0 ? (
                      <div className="empty-state">No on-chain tax escrows recorded yet.</div>
                    ) : (
                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr><th>Date</th><th>Description</th><th className="align-right">Amount (KSH)</th><th className="align-center">Tx Hash</th></tr>
                          </thead>
                          <tbody>
                            {taxData.recent_escrows.map((escrow, i) => (
                              <tr key={i}>
                                <td>{escrow.date}</td><td>{escrow.description}</td>
                                <td className="align-right text-green font-bold">{escrow.amount.toLocaleString()}</td>
                                <td className="align-center">
                                  {escrow.tx_hash ? <span className="hash-badge" title={escrow.tx_hash}>{escrow.tx_hash.slice(0, 6)}...{escrow.tx_hash.slice(-4)}</span> : <span className="text-gray">-</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      <style jsx>{`
        .dashboard-container { min-height: 100vh; background-color: #f8fafc; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .dashboard-card { max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden; }
        .header { background: #0f172a; padding: 24px; color: white; }
        .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
        .header p { margin: 4px 0 0 0; color: #94a3b8; font-size: 14px; }
        .tabs { display: flex; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
        .tab-btn { flex: 1; padding: 16px; background: transparent; border: none; border-bottom: 2px solid transparent; color: #64748b; font-size: 14px; font-weight: 600; text-transform: capitalize; cursor: pointer; transition: all 0.2s; }
        .tab-btn:hover { color: #334155; }
        .tab-btn.active { color: #2563eb; border-bottom-color: #2563eb; background: #eff6ff; }
        .content-area { padding: 24px; }
        .alert { padding: 12px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; margin-bottom: 24px; }
        .alert.success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
        .alert.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .section-title { font-size: 18px; color: #1e293b; margin: 0 0 8px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
        .subtitle { font-size: 13px; color: #64748b; margin-bottom: 16px; }
        .section-subtitle { font-size: 16px; color: #1e293b; margin: 0 0 16px 0; }
        .empty-state { padding: 32px; text-align: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 14px; }
        .grid-split { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px; }
        .flex-col { display: flex; flex-direction: column; gap: 24px; }
        .fit-content { height: fit-content; }
        .card-box { padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: white; }
        .card-box.border-blue { border-color: #bfdbfe; background: #f0f9ff; }
        .box-title { margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #0f172a; }
        .box-title.text-blue { color: #1e40af; }
        .text-sm { font-size: 14px; }
        .font-bold { font-weight: 700; }
        .uppercase { text-transform: uppercase; }
        .mb-2 { margin-bottom: 8px; }
        .mt-2 { margin-top: 8px; }
        .mt-4 { margin-top: 16px; }
        .box-desc { margin: 0 0 20px 0; font-size: 13px; color: #64748b; line-height: 1.5; }
        .wallet-display { display: flex; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
        .wallet-display .mono { flex: 1; padding: 12px; font-size: 13px; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #cbd5e1; }
        .btn-copy { background: white; border: none; padding: 0 16px; color: #2563eb; font-weight: 600; cursor: pointer; transition: background 0.2s; }
        .btn-copy:hover { background: #eff6ff; }
        .input-prefix { display: flex; background: white; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; flex: 1; }
        .prefix { background: #f1f5f9; padding: 10px 16px; color: #64748b; font-weight: 600; border-right: 1px solid #cbd5e1; }
        .flex-input { flex: 1; border: none; padding: 10px 16px; font-size: 15px; font-weight: 600; color: #0f172a; outline: none; }
        .list-container { display: flex; flex-direction: column; gap: 12px; }
        .list-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
        .highlight-row { background: #f0f9ff; border-color: #bfdbfe; }
        .flex-row { display: flex; gap: 16px; align-items: flex-end; }
        .flex-1 { flex: 1; } .flex-2 { flex: 2; } .flex-3 { flex: 3; }
        .field-group label { display: block; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 6px; }
        .field-group input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
        .field-group input:focus { border-color: #2563eb; outline: none; }
        .mono { font-family: monospace; }
        .value-text { font-size: 15px; font-weight: 500; color: #0f172a; padding: 10px 0; }
        .value-highlight { font-size: 16px; font-weight: 700; color: #2563eb; padding: 8px 0; }
        .action-bar { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
        .btn-outline { background: #eff6ff; color: #2563eb; border: 1px solid transparent; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; }
        .btn-outline:hover { background: #dbeafe; }
        .btn-solid { background: #0f172a; color: white; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; }
        .btn-solid:hover:not(:disabled) { background: #1e293b; }
        .btn-solid.bg-blue { background: #2563eb; }
        .btn-solid.bg-blue:hover:not(:disabled) { background: #1d4ed8; }
        .btn-solid:disabled { opacity: 0.5; cursor: not-allowed; }
        .metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
        .metric-card { padding: 20px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .border-red { border-color: #fecaca; } .border-green { border-color: #bbf7d0; } .bg-green { background: #f0fdf4; } .border-gray { border-color: #e2e8f0; }
        .metric-card label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
        .metric-value { font-size: 24px; font-weight: 700; }
        .text-red { color: #dc2626; } .text-green { color: #16a34a; } .text-dark { color: #0f172a; }
        .table-wrapper { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; color: #475569; font-size: 12px; text-transform: uppercase; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
        td { padding: 16px; font-size: 14px; border-bottom: 1px solid #f1f5f9; color: #334155; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #f8fafc; }
        .align-right { text-align: right; } .align-center { text-align: center; } .font-bold { font-weight: 600; } .text-gray { color: #94a3b8; }
        .hash-badge { display: inline-block; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 4px 8px; border-radius: 6px; font-family: monospace; font-size: 12px; font-weight: 600; cursor: pointer; }
      `}</style>
    </div>
  );
}