"use client";

import React, { useEffect, useState } from "react";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from "@utils/tokenUtils";

/**
 * Interface Definitions
 */
interface Account {
    code: string;
    name: string;
    balance: number;
}

interface Subgroup {
    accounts: Account[];
    subtotal: number;
}

interface PnLData {
    grouped: { INCOME: Record<string, Subgroup>; EXPENSE: Record<string, Subgroup> };
    totals: { INCOME: number; EXPENSE: number };
    net_profit: number;
}

interface CashFlowData {
    operating: number;
    investing: number;
    financing: number;
    net_change: number;
}

/**
 * PnLAndCashFlow Component
 * Renders IFRS-compliant Profit and Loss and Cash Flow statements.
 * Synchronizes with the symbolic ledger backend via authenticated requests.
 */
export default function PnLAndCashFlow() {
    const [pnl, setPnL] = useState<PnLData | null>(null);
    const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
    const [loading, setLoading] = useState(true);

    /**
     * Data Acquisition
     * Orchestrates simultaneous fetching of performance and liquidity data.
     */
    async function fetchData() {
        try {
            const { accessToken, refreshToken } = getTokensFromLocalStorage();
            if (!accessToken || !refreshToken) throw new Error("Missing token");
            const fresh = await refreshAccessTokenIfNeeded(accessToken, refreshToken);

            const [pnlRes, cashFlowRes] = await Promise.all([
                fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/pnl/`, {
                    headers: { Authorization: `Bearer ${fresh}` },
                }),
                fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/cashflow/`, {
                    headers: { Authorization: `Bearer ${fresh}` },
                }),
            ]);

            if (pnlRes.ok) setPnL(await pnlRes.json());
            if (cashFlowRes.ok) setCashFlow(await cashFlowRes.json());
        } catch (err) {
            console.error("Error fetching performance data:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    /**
     * IFRS Number Formatting
     * Implements standard accounting notation: parentheses for negative balances/outflows.
     */
    const formatIFRS = (value: number | undefined) => {
        const num = Number(value || 0);
        if (num < 0) return `(${Math.abs(num).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    if (loading) return <div className="loading">Generating IFRS Statements...</div>;
    if (!pnl || !cashFlow) return <div className="loading">No performance data found.</div>;

    /**
     * Account Row Renderer
     * Iterates through subgroups and filters out inactive accounts with zero balances.
     */
    const renderAccounts = (subgroups: Record<string, Subgroup>) => {
        if (!subgroups) return null;
        
        return Object.entries(subgroups).map(([sg, data]) => {
            const activeAccounts = data.accounts.filter(a => a.balance !== 0);
            if (activeAccounts.length === 0) return null;

            return (
                <React.Fragment key={sg}>
                    {sg !== "Other" && (
                        <tr>
                            <td colSpan={3} className="subgroup-title">{sg}</td>
                        </tr>
                    )}
                    {activeAccounts.map(acc => (
                        <tr key={acc.code} className="account-row hover-highlight">
                            <td className="indent account-name">{acc.name}</td>
                            <td className="note-col">-</td>
                            <td className="amount-col">{formatIFRS(acc.balance)}</td>
                        </tr>
                    ))}
                </React.Fragment>
            );
        });
    };

    return (
        <div className="sfp-container">
            <div className="sfp-grid">
                
                {/* Statement of Profit or Loss */}
                <div className="statement-col">
                    <header className="sfp-header">
                        <h1>Statement of Profit or Loss</h1>
                        <p className="date-subtitle">For the reporting period</p>
                        <p className="currency-subtitle">(Expressed in KSH)</p>
                    </header>

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
                                <tr>
                                    <td colSpan={3} className="section-title">INCOME</td>
                                </tr>
                                {renderAccounts(pnl.grouped.INCOME)}
                                <tr>
                                    <td className="subtotal-label indent">Total Income</td>
                                    <td></td>
                                    <td className="amount-col subtotal-value">{formatIFRS(pnl.totals.INCOME)}</td>
                                </tr>

                                <tr>
                                    <td colSpan={3} className="section-title pt-ext">EXPENSES</td>
                                </tr>
                                {renderAccounts(pnl.grouped.EXPENSE)}
                                <tr>
                                    <td className="subtotal-label indent">Total Expenses</td>
                                    <td></td>
                                    <td className="amount-col subtotal-value">{formatIFRS(pnl.totals.EXPENSE)}</td>
                                </tr>

                                <tr>
                                    <td className="total-label">Profit (Loss) for the period</td>
                                    <td></td>
                                    <td className="amount-col total-value">{formatIFRS(pnl.net_profit)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Statement of Cash Flows */}
                <div className="statement-col">
                    <header className="sfp-header">
                        <h1>Statement of Cash Flows</h1>
                        <p className="date-subtitle">For the reporting period</p>
                        <p className="currency-subtitle">(Expressed in KSH)</p>
                    </header>

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
                                <tr>
                                    <td colSpan={3} className="section-title">CASH FLOWS FROM OPERATING ACTIVITIES</td>
                                </tr>
                                <tr className="account-row hover-highlight">
                                    <td className="indent account-name">Net cash from operating activities</td>
                                    <td className="note-col">-</td>
                                    <td className="amount-col">{formatIFRS(cashFlow.operating)}</td>
                                </tr>

                                <tr>
                                    <td colSpan={3} className="section-title pt-ext">CASH FLOWS FROM INVESTING ACTIVITIES</td>
                                </tr>
                                <tr className="account-row hover-highlight">
                                    <td className="indent account-name">Net cash from investing activities</td>
                                    <td className="note-col">-</td>
                                    <td className="amount-col">{formatIFRS(cashFlow.investing)}</td>
                                </tr>

                                <tr>
                                    <td colSpan={3} className="section-title pt-ext">CASH FLOWS FROM FINANCING ACTIVITIES</td>
                                </tr>
                                <tr className="account-row hover-highlight">
                                    <td className="indent account-name">Net cash from financing activities</td>
                                    <td className="note-col">-</td>
                                    <td className="amount-col">{formatIFRS(cashFlow.financing)}</td>
                                </tr>

                                <tr>
                                    <td className="total-label">Net increase (decrease) in cash</td>
                                    <td></td>
                                    <td className="amount-col total-value">{formatIFRS(cashFlow.net_change)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            <style jsx>{`
                .sfp-container {
                    width: 100%;
                    max-width: 100%;
                    margin: 0 auto 2rem auto;
                    padding: 20px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    font-family: 'Times New Roman', Times, serif;
                    color: #0f172a;
                    box-sizing: border-box;
                }
                .sfp-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 40px;
                }
                @media (min-width: 1024px) {
                    .sfp-grid {
                        grid-template-columns: 1fr 1fr;
                        gap: 60px;
                    }
                }
                .statement-col {
                    display: flex;
                    flex-direction: column;
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
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 16px;
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
                .sfp-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
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
                    white-space: nowrap;
                }
                .section-title {
                    font-weight: bold;
                    text-transform: uppercase;
                    padding-top: 1.25rem !important;
                }
                .pt-ext {
                    padding-top: 2rem !important;
                }
                .subgroup-title {
                    font-style: italic;
                    font-weight: bold;
                    padding-top: 0.5rem !important;
                }
                .indent {
                    padding-left: 16px;
                }
                .account-row td {
                    padding: 4px 0;
                }
                .account-name {
                    word-wrap: break-word;
                    white-space: normal;
                    line-height: 1.3;
                    padding-right: 8px;
                }
                .hover-highlight:hover {
                    background-color: #f8fafc;
                }
                .subtotal-label {
                    font-weight: bold;
                    padding-top: 8px !important;
                }
                .subtotal-value {
                    border-top: 1px solid #0f172a;
                    font-weight: bold;
                    padding-top: 8px !important;
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
            `}</style>
        </div>
    );
}