'use client'

import React, { useEffect, useState } from "react";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from "@utils/tokenUtils";

interface Account {
    code: string;
    name: string;
    balance: number;
}

interface Subgroup {
    accounts: Account[];
    subtotal: number;
}

interface Period {
    start_date: string | null;
    end_date: string | null;
}

interface BalanceSheetData {
    grouped: {
        ASSET?: Record<string, Subgroup>;
        LIABILITY?: Record<string, Subgroup>;
        EQUITY?: Record<string, Subgroup>;
    };
    totals?: { ASSET?: number; LIABILITY?: number; EQUITY?: number };
    warning?: string;
    assets?: number;
    liabilities?: number;
    equity?: number;
    period_data?: Period;
}

export default function FinancialPosition() {
    const [data, setData] = useState<BalanceSheetData | null>(null);
    const [editing, setEditing] = useState<{ code: string; value: number; creditCode?: string; entryType?: "debit" | "credit"; } | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    async function fetchData() {
        try {
            const { accessToken, refreshToken } = getTokensFromLocalStorage();
            if (!accessToken || !refreshToken) throw new Error("Missing token");

            const fresh = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
            setToken(fresh);

            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/balance-sheet/`, {
                headers: { Authorization: `Bearer ${fresh}` },
            });

            if (res.ok) {
                setData(await res.json());
            }
        } catch (err) {
            console.error("Error fetching statement of financial position:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    async function saveAdjustment() {
        if (!editing || !editing.creditCode || !token) return;

        const isDebit = editing.entryType === "credit" ? false : true;
        await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/manual-adjustment/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                debit_account: isDebit ? editing.code : editing.creditCode,
                credit_account: isDebit ? editing.creditCode : editing.code,
                amount: editing.value,
            }),
        });
        setEditing(null);
        fetchData();
    }

    if (loading) return <div className="loading">Generating IFRS Statement...</div>;
    if (!data) return <div className="loading">No financial data found.</div>;

    // Strict IFRS formatting: Parentheses for negative balances (Contra-accounts)
    const formatIFRS = (value: number | undefined) => {
        const num = Number(value || 0);
        if (num < 0) return `(${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const allAccounts = [
        ...Object.values(data.grouped.ASSET || {}).flatMap(sg => sg.accounts),
        ...Object.values(data.grouped.LIABILITY || {}).flatMap(sg => sg.accounts),
        ...Object.values(data.grouped.EQUITY || {}).flatMap(sg => sg.accounts),
    ];

    const nonCurrentAssets = data.grouped.ASSET?.["Non-Current Assets"];
    const currentAssets = data.grouped.ASSET?.["Current Assets"];
    const equity = data.grouped.EQUITY?.["Equity"];
    const nonCurrentLiabs = data.grouped.LIABILITY?.["Non-Current Liabilities"];
    const currentLiabs = data.grouped.LIABILITY?.["Current Liabilities"];

    const renderSubgroup = (title: string, subgroup?: Subgroup) => {
        if (!subgroup || subgroup.accounts.length === 0) return null;
        
        const allZero = subgroup.accounts.every(acc => acc.balance === 0);
        if (allZero && !editing) return null;

        return (
            <React.Fragment>
                {title !== "Equity" && (
                    <tr>
                        <td colSpan={3} className="subgroup-title">{title}</td>
                    </tr>
                )}
                {subgroup.accounts.filter(a => a.balance !== 0 || editing?.code === a.code).map(acc => (
                    <React.Fragment key={acc.code}>
                        {editing?.code === acc.code ? (
                            <tr>
                                <td colSpan={3} className="edit-cell">
                                    <div className="edit-module">
                                        <span className="edit-label">Adjust {acc.name}:</span>
                                        <div className="edit-controls">
                                            <input
                                                type="number"
                                                className="edit-input"
                                                value={editing.value}
                                                onChange={(e) => setEditing((prev) => prev && { ...prev, value: parseFloat(e.target.value) })}
                                            />
                                            <select
                                                className="edit-select"
                                                value={editing.entryType || "debit"}
                                                onChange={(e) => setEditing((prev) => prev && { ...prev, entryType: e.target.value as "debit" | "credit" })}
                                            >
                                                <option value="debit">DR</option>
                                                <option value="credit">CR</option>
                                            </select>
                                            <select
                                                className="edit-select offset-select"
                                                value={editing.creditCode || ""}
                                                onChange={(e) => setEditing((prev) => prev && { ...prev, creditCode: e.target.value })}
                                            >
                                                <option value="" disabled>Offset Account</option>
                                                {allAccounts.filter((a) => a.code !== acc.code).map((a) => (
                                                    <option key={a.code} value={a.code}>{a.name}</option>
                                                ))}
                                            </select>
                                            <button className="save-btn" onClick={saveAdjustment}>Post</button>
                                            <button className="cancel-btn" onClick={() => setEditing(null)}>×</button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            <tr className="account-row hover-highlight">
                                <td className="indent account-name">{acc.name}</td>
                                <td className="note-col">-</td>
                                <td className="amount-col">
                                    <span 
                                        className="account-balance" 
                                        onClick={() => setEditing({ code: acc.code, value: acc.balance, creditCode: "", entryType: "debit" })}
                                        title="Click to post manual adjustment"
                                    >
                                        {formatIFRS(acc.balance)}
                                    </span>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}
                <tr>
                    <td className={title === "Equity" ? "subtotal-label" : "subtotal-label indent"}>Total {title.toLowerCase()}</td>
                    <td></td>
                    <td className="amount-col subtotal-value">{formatIFRS(subgroup.subtotal)}</td>
                </tr>
            </React.Fragment>
        );
    };

    const totalEquityLiabilities = Number(data.liabilities || 0) + Number(data.equity || 0);

    return (
        <div className="sfp-container">
            <header className="sfp-header">
                <h1>Statement of Financial Position</h1>
                <p className="date-subtitle">As at {data.period_data?.end_date}</p>
                <p className="currency-subtitle">(Expressed in KSH)</p>
            </header>

            {data.warning && (
                <div className="audit-warning">
                    <strong>⚠️ IFRS Equation Imbalance:</strong> {data.warning}
                </div>
            )}

            <div className="table-responsive">
                <table className="sfp-table">
                    <thead>
                        <tr>
                            <th className="left"></th>
                            <th className="note-col">Note</th>
                            <th className="amount-col">KSH</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* ================= ASSETS ================= */}
                        <tr>
                            <td colSpan={3} className="section-title">ASSETS</td>
                        </tr>
                        
                        {renderSubgroup("Non-current assets", nonCurrentAssets)}
                        {renderSubgroup("Current assets", currentAssets)}

                        <tr>
                            <td className="total-label">Total assets</td>
                            <td></td>
                            <td className="amount-col total-value">{formatIFRS(data.assets)}</td>
                        </tr>

                        {/* ================= EQUITY & LIABILITIES ================= */}
                        <tr>
                            <td colSpan={3} className="section-title pt-ext">EQUITY AND LIABILITIES</td>
                        </tr>

                        {/* Equity */}
                        {renderSubgroup("Equity", equity)}

                        {/* Liabilities */}
                        <tr>
                            <td colSpan={3} className="section-title liability-title">Liabilities</td>
                        </tr>

                        {renderSubgroup("Non-current liabilities", nonCurrentLiabs)}
                        {renderSubgroup("Current liabilities", currentLiabs)}

                        <tr>
                            <td className="subtotal-label liability-total">Total liabilities</td>
                            <td></td>
                            <td className="amount-col subtotal-value">{formatIFRS(data.liabilities)}</td>
                        </tr>

                        <tr>
                            <td className="total-label">Total equity and liabilities</td>
                            <td></td>
                            <td className="amount-col total-value">{formatIFRS(totalEquityLiabilities)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                .sfp-container {
                    width: 100%;
                    max-width: 100%;
                    margin: 0 auto;
                    padding: 20px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    font-family: 'Times New Roman', Times, serif;
                    color: #0f172a;
                    box-sizing: border-box;
                }
                .table-responsive {
                    width: 100%;
                }
                .loading {
                    text-align: center;
                    padding: 40px;
                    font-family: Inter, sans-serif;
                    color: #64748b;
                }
                .sfp-header {
                    text-align: center;
                    margin-bottom: 24px;
                }
                .sfp-header h1 {
                    font-size: 18px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 6px 0;
                    font-weight: bold;
                }
                .date-subtitle {
                    font-size: 14px;
                    font-style: italic;
                    margin: 0 0 4px 0;
                }
                .currency-subtitle {
                    font-size: 12px;
                    color: #475569;
                    margin: 0;
                }
                .audit-warning {
                    background: #fef2f2;
                    border-left: 4px solid #ef4444;
                    padding: 12px;
                    color: #b91c1c;
                    margin-bottom: 20px;
                    font-family: Inter, sans-serif;
                    font-size: 12px;
                }
                
                /* IFRS Table Styles */
                .sfp-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px; /* Reduced slightly to ensure grid fit */
                }
                .sfp-table th, .sfp-table td {
                    padding: 6px 0;
                    vertical-align: bottom;
                }
                .sfp-table th {
                    border-bottom: 2px solid #0f172a;
                    font-weight: normal;
                    font-style: italic;
                    color: #475569;
                }
                .sfp-table th.left { 
                    text-align: left; 
                    width: 60%;
                }
                .note-col {
                    text-align: center;
                    width: 10%;
                    color: #94a3b8;
                }
                .amount-col {
                    text-align: right;
                    width: 30%;
                    white-space: nowrap; /* Protects numbers from wrapping */
                }
                
                /* Structural Typography */
                .section-title {
                    font-weight: bold;
                    text-transform: uppercase;
                    padding-top: 1.25rem !important;
                }
                .pt-ext {
                    padding-top: 2rem !important;
                }
                .liability-title {
                    font-style: italic;
                    font-weight: bold;
                    text-transform: none;
                    padding-top: 1.25rem !important;
                }
                .subgroup-title {
                    font-style: italic;
                    font-weight: bold;
                    padding-top: 0.5rem !important;
                }
                .indent {
                    padding-left: 16px; /* Reduced indentation */
                }
                
                /* Account Rows */
                .account-row td {
                    padding: 4px 0;
                }
                .account-name {
                    word-wrap: break-word; /* Allows long titles to wrap */
                    white-space: normal;
                    line-height: 1.3;
                    padding-right: 8px;
                }
                .hover-highlight:hover {
                    background-color: #f8fafc;
                }
                .account-balance {
                    cursor: pointer;
                    border-bottom: 1px dashed #cbd5e1;
                    transition: color 0.2s;
                }
                .account-balance:hover {
                    color: #2563eb;
                    border-bottom-color: #2563eb;
                }

                /* Totals & Lines */
                .subtotal-label {
                    font-weight: bold;
                    padding-top: 8px !important;
                }
                .subtotal-value {
                    border-top: 1px solid #0f172a;
                    font-weight: bold;
                    padding-top: 8px !important;
                }
                .liability-total {
                    padding-top: 1.25rem !important;
                }
                .total-label {
                    font-weight: bold;
                    font-size: 15px;
                    padding-top: 1.5rem !important;
                }
                .total-value {
                    border-top: 1px solid #0f172a;
                    border-bottom: 4px double #0f172a; 
                    font-weight: bold;
                    font-size: 15px;
                    padding-top: 8px !important;
                    padding-bottom: 4px !important;
                }

                /* Inline Editor - Fully responsive */
                .edit-cell {
                    padding: 8px 0 !important;
                }
                .edit-module {
                    background: #f8fafc;
                    padding: 10px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                    font-family: Inter, sans-serif;
                    font-size: 12px;
                    box-sizing: border-box;
                    width: 100%;
                }
                .edit-label {
                    display: block;
                    font-weight: bold;
                    color: #334155;
                    margin-bottom: 6px;
                    width: 100%;
                }
                .edit-controls {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 6px;
                    width: 100%;
                }
                .edit-input {
                    width: 70px;
                    flex-grow: 1;
                    padding: 6px;
                    border: 1px solid #cbd5e1;
                    border-radius: 4px;
                }
                .edit-select {
                    padding: 6px;
                    border: 1px solid #cbd5e1;
                    border-radius: 4px;
                    background: white;
                }
                .offset-select {
                    flex: 2;
                    min-width: 110px;
                    max-width: 100%;
                }
                .save-btn {
                    background: #0f172a;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 6px 12px;
                    font-weight: bold;
                    cursor: pointer;
                }
                .cancel-btn {
                    background: none;
                    border: none;
                    color: #ef4444;
                    font-size: 18px;
                    font-weight: bold;
                    cursor: pointer;
                    padding: 0 4px;
                }
            `}</style>
        </div>
    );
}