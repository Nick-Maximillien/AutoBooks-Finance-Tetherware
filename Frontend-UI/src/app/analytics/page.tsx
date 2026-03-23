"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from "recharts";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from "../../utils/tokenUtils";

/**
 * Chart Aesthetic Configuration
 * Defines the standard color palette for financial visualization.
 */
const COLORS = {
  income: "#10b981",
  expense: "#ef4444",
  assets: "#3b82f6",
  liabilities: "#f59e0b",
  equity: "#8b5cf6",
  cash: "#14b8a6",
  generic: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#6366f1", "#ec4899", "#14b8a6"]
};

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Financial Statement State
   * Stores raw data retrieved from the symbolic ledger.
   */
  const [pnlData, setPnlData] = useState<any>(null);
  const [bsData, setBsData] = useState<any>(null);
  const [cfData, setCfData] = useState<any>(null);

  /**
   * AI Insight State
   * Manages executive summaries and granular chart analysis.
   */
  const [cfoAnalysis, setCfoAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  /**
   * UI Preference State
   * Controls the visualization type for each financial metric.
   */
  const [pnlType, setPnlType] = useState<"bar" | "line" | "pie">("bar");
  const [bsType, setBsType] = useState<"bar" | "line" | "pie">("pie");
  const [cfType, setCfType] = useState<"bar" | "line" | "pie">("bar");
  const [granularType, setGranularType] = useState<"bar" | "line" | "pie">("pie");

  const [chartInsights, setChartInsights] = useState<{ [key: string]: string }>({});
  const [loadingInsights, setLoadingInsights] = useState<{ [key: string]: boolean }>({});

  const { accessToken, refreshToken } = getTokensFromLocalStorage();

  /**
   * Data Acquisition Pipeline
   * Synchronizes state with the Django backend financial endpoints.
   */
  const fetchFinancials = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';
      const headers = { Authorization: `Bearer ${token}` };

      const [pnlRes, bsRes, cfRes] = await Promise.all([
        fetch(`${baseUrl}/pnl/`, { headers }),
        fetch(`${baseUrl}/balance-sheet/`, { headers }),
        fetch(`${baseUrl}/cashflow/`, { headers })
      ]);

      if (!pnlRes.ok || !bsRes.ok || !cfRes.ok) throw new Error("Failed to fetch financial data from ledger.");

      setPnlData(await pnlRes.json());
      setBsData(await bsRes.json());
      setCfData(await cfRes.json());

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancials();
  }, []);

  /**
   * AI Analysis Engine
   * Interfaces with the LLM gateway to provide prose-based financial interpretation.
   */
  const requestAIInsight = async (prompt: string, key: string, isMacro = false) => {
    if (isMacro) setAnalyzing(true);
    else setLoadingInsights(prev => ({ ...prev, [key]: true }));

    try {
      const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';

      const res = await fetch(`${baseUrl}/api/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: prompt }),
      });

      if (!res.ok) throw new Error("AI Agent failed to analyze.");
      const data = await res.json();

      const content = data.reply || "";
      const splitIndex = content.search(/[chart_symbol_placeholder]/);
      const cleanText = splitIndex > 0 ? content.substring(0, splitIndex).trim() : content;

      if (isMacro) {
        setCfoAnalysis(cleanText);
      } else {
        setChartInsights(prev => ({ ...prev, [key]: cleanText }));
      }
    } catch (err: any) {
      const errMsg = `Analysis Error: ${err.message}`;
      if (isMacro) setCfoAnalysis(errMsg);
      else setChartInsights(prev => ({ ...prev, [key]: errMsg }));
    } finally {
      if (isMacro) setAnalyzing(false);
      else setLoadingInsights(prev => ({ ...prev, [key]: false }));
    }
  };

  const generateMacroAnalysis = () => {
    requestAIInsight("Review my entire Balance Sheet, P&L, and Cash Flow. Provide a 3-paragraph executive summary analyzing our overall financial health, highlighting red flags, and predicting our trajectory. Do not output raw tables, just the strategic prose.", "macro", true);
  };

  const generateMicroInsight = (chartKey: string, dataString: string) => {
    requestAIInsight(`Review this specific chart data: ${dataString}. Provide exactly 2 sentences of strategic insight pointing out the most important anomaly or trend. Do not output tables.`, chartKey, false);
  };

  /**
   * Formatting Utilities
   */
  const formatCurrency = (val: any) => `KSH ${Number(val).toLocaleString(undefined, {minimumFractionDigits: 2})}`;

  /**
   * Visualization Data Preparation
   */
  const incomeVal = Number(pnlData?.totals?.INCOME || 0);
  const expenseVal = Number(pnlData?.totals?.EXPENSE || 0);
  const pnlBarLineData = [{ name: "Current Period", Income: incomeVal, Expenses: expenseVal }];
  const pnlPieData = [
    { name: "Income", value: incomeVal, color: COLORS.income },
    { name: "Expenses", value: expenseVal, color: COLORS.expense }
  ];

  const assetsVal = Number(bsData?.assets || 0);
  const liabVal = Number(bsData?.liabilities || 0);
  const eqVal = Number(bsData?.equity || 0);
  const bsBarLineData = [{ name: "Position", Assets: assetsVal, Liabilities: liabVal, Equity: Math.abs(eqVal) }];
  const bsPieData = [
    { name: "Assets", value: assetsVal, color: COLORS.assets },
    { name: "Liabilities", value: liabVal, color: COLORS.liabilities },
    { name: "Equity (Abs)", value: Math.abs(eqVal), color: COLORS.equity }
  ];

  const cfBarLineData = [{ 
    name: "Cash Flow", 
    Operating: Number(cfData?.operating || 0), 
    Investing: Number(cfData?.investing || 0), 
    Financing: Number(cfData?.financing || 0) 
  }];
  const cfPieData = [
    { name: "Operating", value: Math.abs(Number(cfData?.operating || 0)), color: COLORS.cash },
    { name: "Investing", value: Math.abs(Number(cfData?.investing || 0)), color: COLORS.assets },
    { name: "Financing", value: Math.abs(Number(cfData?.financing || 0)), color: COLORS.equity },
  ];

  let granularData: any[] = [];
  if (pnlData && pnlData.expenses) {
    granularData = Object.entries(pnlData.expenses).map(([key, val], idx) => ({
      name: key.replace(/_/g, ' ').toUpperCase(),
      value: Number(val),
      color: COLORS.generic[idx % COLORS.generic.length]
    })).filter(item => item.value > 0);
  }

  /**
   * Component Renderers
   */
  const renderChart = (type: string, barLineData: any[], pieData: any[], keys: {key: string, color: string}[]) => {
    if (type === "pie") {
      return (
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={5}>
            {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(val: number) => formatCurrency(val)} />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      );
    }
    
    if (type === "line") {
      return (
        <LineChart data={barLineData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `KSH ${val/1000}k`} width={80} />
          <Tooltip formatter={(val: number) => formatCurrency(val)} />
          <Legend />
          {keys.map((k) => <Line key={k.key} type="monotone" dataKey={k.key} stroke={k.color} strokeWidth={3} />)}
        </LineChart>
      );
    }

    return (
      <BarChart data={barLineData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} />
        <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `KSH ${val/1000}k`} width={80} />
        <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} formatter={(val: number) => formatCurrency(val)} />
        <Legend />
        {keys.map((k) => <Bar key={k.key} dataKey={k.key} fill={k.color} radius={[4, 4, 0, 0]} maxBarSize={60} />)}
      </BarChart>
    );
  };

  if (loading) {
    return (
      <div className="loader">
        <div className="loaderIcon"></div>
        <p>Compiling Ledger Visualizations...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="header">
        <div>
          <h1>Financial Analytics</h1>
          <p>Real-time Symbolic Ledger Visualization</p>
        </div>
        <div className="headerActions">
          <button 
            onClick={generateMacroAnalysis} 
            disabled={analyzing} 
            className="actionBtn primaryBtn"
          >
            {analyzing ? "Synthesizing..." : "Generate Executive Analysis"}
          </button>
          <button onClick={fetchFinancials} className="actionBtn outlineBtn">
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="errorBox">{error}</div>}

      {(cfoAnalysis || analyzing) && (
        <div className="aiPanel">
          <div className="aiHeader">
            <h2>Executive Forecast</h2>
          </div>
          <div className="aiContent">
            {analyzing ? <p className="thinking">Analyzing the entire ledger...</p> : 
              cfoAnalysis?.split('\n\n').map((p, i) => <p key={i}>{p}</p>)
            }
          </div>
        </div>
      )}

      <div className="kpiGrid">
        <div className="kpiCard">
          <span>Net Profit (Loss)</span>
          <h2 className={incomeVal - expenseVal >= 0 ? "green" : "red"}>
            {formatCurrency(incomeVal - expenseVal)}
          </h2>
        </div>
        <div className="kpiCard">
          <span>Total Assets</span>
          <h2 className="blue">{formatCurrency(assetsVal)}</h2>
        </div>
        <div className="kpiCard">
          <span>Net Cash Flow</span>
          <h2 className={Number(cfData?.net_change) >= 0 ? "green" : "orange"}>
            {formatCurrency(cfData?.net_change || 0)}
          </h2>
        </div>
      </div>

      <div className="chartsGrid">
        
        <div className="chartCard">
          <div className="chartHeader">
            <h2>Income vs Expenses</h2>
            <select value={pnlType} onChange={(e: any) => setPnlType(e.target.value)} className="chartToggle">
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
            </select>
          </div>
          <div className="chartWrapper">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart(pnlType, pnlBarLineData, pnlPieData, [{key: "Income", color: COLORS.income}, {key: "Expenses", color: COLORS.expense}])}
            </ResponsiveContainer>
          </div>
          <div className="chartInsight">
            <button onClick={() => generateMicroInsight('pnl', `Income: ${incomeVal}, Expenses: ${expenseVal}`)} disabled={loadingInsights['pnl']} className="insightBtn">
              {loadingInsights['pnl'] ? "Thinking..." : "Get Chart Insight"}
            </button>
            {chartInsights['pnl'] && <p className="insightText">{chartInsights['pnl']}</p>}
          </div>
        </div>

        <div className="chartCard">
          <div className="chartHeader">
            <h2>Financial Position</h2>
            <select value={bsType} onChange={(e: any) => setBsType(e.target.value)} className="chartToggle">
              <option value="pie">Pie</option>
              <option value="bar">Bar</option>
              <option value="line">Line</option>
            </select>
          </div>
          <div className="chartWrapper">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart(bsType, bsBarLineData, bsPieData, [{key: "Assets", color: COLORS.assets}, {key: "Liabilities", color: COLORS.liabilities}, {key: "Equity", color: COLORS.equity}])}
            </ResponsiveContainer>
          </div>
          <div className="chartInsight">
            <button onClick={() => generateMicroInsight('bs', `Assets: ${assetsVal}, Liabilities: ${liabVal}`)} disabled={loadingInsights['bs']} className="insightBtn">
              {loadingInsights['bs'] ? "Thinking..." : "Get Chart Insight"}
            </button>
            {chartInsights['bs'] && <p className="insightText">{chartInsights['bs']}</p>}
          </div>
        </div>

        <div className="chartCard">
          <div className="chartHeader">
            <h2>Cash Flow Activities</h2>
            <select value={cfType} onChange={(e: any) => setCfType(e.target.value)} className="chartToggle">
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
            </select>
          </div>
          <div className="chartWrapper">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart(cfType, cfBarLineData, cfPieData, [{key: "Operating", color: COLORS.cash}, {key: "Investing", color: COLORS.assets}, {key: "Financing", color: COLORS.equity}])}
            </ResponsiveContainer>
          </div>
          <div className="chartInsight">
            <button onClick={() => generateMicroInsight('cf', `Op: ${cfData?.operating}, Inv: ${cfData?.investing}, Fin: ${cfData?.financing}`)} disabled={loadingInsights['cf']} className="insightBtn">
              {loadingInsights['cf'] ? "Thinking..." : "Get Chart Insight"}
            </button>
            {chartInsights['cf'] && <p className="insightText">{chartInsights['cf']}</p>}
          </div>
        </div>

        <div className="chartCard">
          <div className="chartHeader">
            <h2>Granular Expense Breakdown</h2>
            <select value={granularType} onChange={(e: any) => setGranularType(e.target.value)} className="chartToggle">
              <option value="pie">Pie</option>
              <option value="bar">Bar</option>
            </select>
          </div>
          <div className="chartWrapper">
            <ResponsiveContainer width="100%" height="100%">
              {granularData.length > 0 ? (
                renderChart(granularType, granularData, granularData, granularData.map(d => ({key: d.name, color: d.color})))
              ) : (
                <div className="emptyState">
                  No granular expense data available yet.
                </div>
              )}
            </ResponsiveContainer>
          </div>
          <div className="chartInsight">
            <button onClick={() => generateMicroInsight('granular', `Top expenses: ${granularData.slice(0,3).map(d => d.name).join(', ')}`)} disabled={loadingInsights['granular']} className="insightBtn">
              {loadingInsights['granular'] ? "Thinking..." : "Get Chart Insight"}
            </button>
            {chartInsights['granular'] && <p className="insightText">{chartInsights['granular']}</p>}
          </div>
        </div>

      </div>

      <style jsx>{`
      .dashboard { padding: 40px; max-width: 1400px; margin: auto; font-family: Inter, system-ui; background: #f8fafc; min-height: 100vh; }
      .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
      h1 { font-size: 32px; font-weight: 800; color: #0f172a; margin: 0; }
      .header p { color: #64748b; margin-top: 4px; }
      .headerActions { display: flex; gap: 12px; }
      
      .chartWrapper { height: 280px; width: 100%; margin-bottom: 16px; }
      .emptyState { display: flex; height: 100%; align-items: center; justify-content: center; color: #94a3b8; font-style: italic; font-size: 0.9rem; }

      .actionBtn { padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
      .primaryBtn { background: #2563eb; color: white; border: none; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }
      .primaryBtn:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-1px); }
      .primaryBtn:disabled { background: #94a3b8; cursor: not-allowed; }
      .outlineBtn { background: white; border: 1px solid #cbd5e1; color: #334155; }
      .outlineBtn:hover { background: #f1f5f9; }
      
      .kpiGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
      .kpiCard { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; }
      .kpiCard span { font-size: 13px; color: #64748b; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
      .kpiCard h2 { font-size: 28px; margin-top: 8px; font-weight: 900; margin-bottom: 0; }
      .green { color: #10b981 } .red { color: #ef4444 } .blue { color: #3b82f6 } .orange { color: #f59e0b }
      
      .chartsGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px; }
      .chartCard { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; display: flex; flex-direction: column; }
      .chartHeader { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
      .chartHeader h2 { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0; }
      .chartToggle { padding: 6px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 0.85rem; font-weight: 500; color: #334155; cursor: pointer; outline: none; }
      
      .chartInsight { margin-top: auto; padding-top: 16px; border-top: 1px dashed #e2e8f0; }
      .insightBtn { background: transparent; border: none; color: #8b5cf6; font-weight: 700; font-size: 0.85rem; cursor: pointer; padding: 0; transition: color 0.2s; }
      .insightBtn:hover:not(:disabled) { color: #7c3aed; }
      .insightBtn:disabled { color: #cbd5e1; cursor: not-allowed; }
      .insightText { margin-top: 10px; font-size: 0.85rem; color: #475569; line-height: 1.6; background: #f8fafc; padding: 12px; border-radius: 8px; border-left: 3px solid #8b5cf6; }
      
      .aiPanel { margin-bottom: 30px; background: #0f172a; border-radius: 16px; color: white; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
      .aiHeader { padding: 16px 24px; border-bottom: 1px solid #1e293b; background: rgba(255,255,255,0.02); }
      .aiHeader h2 { font-size: 16px; font-weight: 700; margin: 0; color: #e2e8f0; }
      .aiContent { padding: 24px; line-height: 1.7; font-size: 0.95rem; color: #cbd5e1; }
      .thinking { color: #60a5fa; font-weight: 500; }
      
      .loader { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 18px; color: #64748b; font-weight: 500; }
      .loaderIcon { font-size: 40px; margin-bottom: 16px; animation: bounce 1s infinite; }
      
      .errorBox { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-weight: 500; }

      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      `}</style>
    </div>
  );
}