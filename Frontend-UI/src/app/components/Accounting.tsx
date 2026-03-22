"use client"

import { useEffect, useState } from "react";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';


type BalanceSheet = {
    assets: number;
    liabilities: number;
    equity: number;
};

type ProfitLoss = {
    revenue: number;
    expenses: number;
    net_profit: number;
}

type PayrollEmployee = {
    employee: string;
    salary: number;
};

type PayrollSummary = {
    employees: PayrollEmployee[];
    total: number;
};

export default function AccountingDashboard() {
    const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
    const [profitLoss, setProfitLoss] = useState<ProfitLoss | null>(null);
    const [payroll, setPayroll] = useState<PayrollSummary | null>(null);
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            try {
                const { accessToken, refreshToken } = getTokensFromLocalStorage();
                if (!accessToken || !refreshToken) throw new Error('Missing tokens');

                const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
                
                const headers = { Authorization: `Bearer ${token}` };
                
                const [bsRes, pnlRes, prRes] = await Promise.all([
                    fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/balance-sheet/`, { headers }),
                    fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/profit-loss/`, { headers }),
                    fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/payroll-summary/`, { headers }),
                ]);

                if (bsRes.ok) setBalanceSheet(await bsRes.json());
                if (pnlRes.ok) setProfitLoss(await pnlRes.json());
                if (prRes.ok) setPayroll(await prRes.json());
            } catch (err) {
                console.error("Error fetching accounting data:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    if (loading) return <div className="p-4 text-center">Loading...</div>;

    return (
        <div className="p-6 grid gap-6 md:grid-cols-3">
            {/* Balance Sheet */}
            <div className="p-4 bg-white shadow rounded-2xl">
                <h2 className="text-xl font-semibold mb-4">Balance Sheet</h2>
                {balanceSheet ? (
                    <ul className="space-y-2">
                        <li>Assets: <strong>${balanceSheet.assets.toFixed(2)}</strong></li>
                        <li>Liabilites: <strong>${balanceSheet.liabilities.toFixed(2)}</strong></li>
                        <li>Equity: <strong>${balanceSheet.equity.toFixed(2)}</strong></li>
                    </ul>
                ) : (
                    <p>No data</p>
                )}
            </div>

            {/* Profit & Loss */}
            <div className="p-4 bg-white shadow rounded-2xl">
                <h2 className="text-xl font-semibold mb-4">Profit and Loss</h2>
                {profitLoss ? (
                    <ul className="space-y-2">
                        <li>Revenue: <strong>${profitLoss.revenue.toFixed(2)}</strong></li>
                        <li>Expenses: <strong>${profitLoss.expenses.toFixed(2)}</strong></li>
                        <li>Net Profit: <strong>${profitLoss.net_profit.toFixed(2)}</strong></li>
                    </ul>
                ) : (
                    <p>No data</p>
                )}
            </div>

            {/* Payroll Summary */}
            <div className="p-4 bg-white shadow rounded-2xl">
                <h2 className="text-xl font-semiblobd mb-4">Payroll</h2>
                {payroll ? (
                    <div>
                        <ul className="space-y-1">
                            {payroll.employees.map((emp, idx) => (
                                <li key={idx}>
                                    {emp.employee}: <strong>${emp.salary.toFixed(2)}</strong>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-3 font-bold">
                            Total: ${payroll.total.toFixed(2)}
                        </p>
                    </div>
                ) : (
                    <p>No data</p>
                )}
            </div>
        </div>
    );

}