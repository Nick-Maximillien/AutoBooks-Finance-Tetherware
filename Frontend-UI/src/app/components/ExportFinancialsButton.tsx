'use client';

import React, { useState } from 'react';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';

interface ExportProps {
  onExportSuccess?: () => void;
}

export default function ExportFinancialsButton({ onExportSuccess }: ExportProps) {
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleExport = async (format: 'excel' | 'pdf' = 'excel') => {
    setIsExporting(format);
    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      if (!accessToken || !refreshToken) throw new Error('Missing tokens.');

      const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';
      
      const response = await fetch(`${baseUrl}/export-financials/?file_type=${format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      const fileName = `Financial_Report_${new Date().toISOString().split('T')[0]}.${extension}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      link.remove();
      window.URL.revokeObjectURL(url);

      // --- CRITICAL: This unlocks the Period Close button in the Dashboard ---
      if (onExportSuccess) {
        onExportSuccess();
      }
      
    } catch (error: any) {
      console.error("Export error:", error);
      alert(error.message || "Failed to export financial data.");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="export-container">
      <button 
        className="export-btn excel" 
        onClick={() => handleExport('excel')} 
        disabled={!!isExporting}
      >
        {isExporting === 'excel' ? '⏳...' : '💾 Backup Excel'}
      </button>
      
      <button 
        className="export-btn pdf" 
        onClick={() => handleExport('pdf')} 
        disabled={!!isExporting}
      >
        {isExporting === 'pdf' ? '⏳...' : '📄 IFRS PDF'}
      </button>

      <style jsx>{`
        .export-container { display: flex; gap: 8px; }
        .export-btn {
          background: #f8fafc;
          color: #475569;
          border: 1px solid #cbd5e1;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .export-btn:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #94a3b8;
          transform: translateY(-1px);
        }
        .export-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .pdf { border-color: #fecaca; color: #b91c1c; }
        .pdf:hover:not(:disabled) { background: #fef2f2; border-color: #f87171; }
      `}</style>
    </div>
  );
}