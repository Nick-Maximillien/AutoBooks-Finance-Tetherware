'use client';

import React from 'react';
import Link from 'next/link';

export default function About() {
  return (
    <div className="hw-layout">
      <div className="hw-container">
        
        <div className="hw-header">
          <h1 className="hw-title">SYSTEM_ARCHITECTURE_OVERVIEW</h1>
          <span className="hw-status-badge">CLASSIFIED // LEVEL 1</span>
        </div>

        <div className="hw-content hw-custom-scrollbar">
          
          {/* ASCII Architecture Diagram */}
          <div className="hw-diagram-panel">
            <pre className="ascii-art">
{`    [ AUTOBOOKS CLOUD ]            [ WDK BRIDGE ]            [ TETHERWARE ENCLAVE ]
  +---------------------+      +--------------------+      +----------------------+
  |  AI CFO Copilot     |      |  EVM RPC Nodes     |      |  Air-Gapped Vault    |
  |  IFRS Ledger Engine | ===> |  Paymaster Server  | ===> |  AES-256 Keystore    |
  |  Django Backend     |      |  Intent Relayer    |      |  OpenClaw Signer     |
  +---------------------+      +--------------------+      +----------------------+
          |                              |                           |
    (Data Parsing)               (Gasless Routing)          (Offline ECDSA Signing)`}
            </pre>
          </div>

          <p className="hw-lead-text">
            TetherWare is a dual-state financial operating system. It separates the <strong>intelligence</strong> of your business from the <strong>custody</strong> of your assets to ensure absolute sovereignty.
          </p>

          <div className="hw-grid">
            {/* Module 1 */}
            <div className="hw-module-card">
              <div className="module-header">
                <span className="module-id">MOD_01</span>
                <span className="module-name">THE CLOUD CFO</span>
              </div>
              <div className="module-body">
                <p>An intelligent, highly-available Agentic CFO running in the cloud. It ingests invoices, analyzes market data, categorizes expenses according to strict IFRS rules, and constructs complex Web3 execution intents.</p>
                <span className="module-tag bg-blue">CLOUD_STATE</span>
              </div>
            </div>

            {/* Module 2 */}
            <div className="hw-module-card">
              <div className="module-header">
                <span className="module-id">MOD_02</span>
                <span className="module-name">THE WDK BRIDGE</span>
              </div>
              <div className="module-body">
                <p>The communication conduit. The Cloud CFO cannot touch your money. Instead, it places "Unsigned Intents" (like payroll or bill settlements) onto the bridge, waiting for your local hardware to intercept them.</p>
                <span className="module-tag bg-amber">NETWORK_LAYER</span>
              </div>
            </div>

            {/* Module 3 */}
            <div className="hw-module-card">
              <div className="module-header">
                <span className="module-id">MOD_03</span>
                <span className="module-name">TETHERWARE ENCLAVE</span>
              </div>
              <div className="module-body">
                <p>A completely detached, locally executed desktop environment. Your private keys never leave this sandbox. The Enclave pulls intents from the bridge, allows you to review them, and signs them offline.</p>
                <span className="module-tag bg-green">LOCAL_CUSTODY</span>
              </div>
            </div>
          </div>

          <div className="hw-action-row">
            <Link href="/" className="hw-btn-primary">[ RETURN_TO_SYSTEM ]</Link>
          </div>

        </div>
      </div>

      <style jsx>{`
        .hw-layout {
          min-height: 100vh;
          background-color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          font-family: 'Courier New', Courier, monospace;
        }

        .hw-container {
          width: 100%;
          max-width: 1000px;
          background: #020617;
          border: 2px solid #1e293b;
          border-radius: 12px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.8), inset 0 0 30px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          height: 80vh;
          max-height: 850px;
          position: relative;
          overflow: hidden;
        }

        .hw-container::after {
          content: "";
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.1));
          background-size: 100% 4px;
          pointer-events: none;
          opacity: 0.4;
          z-index: 20;
        }

        .hw-header {
          padding: 20px 30px;
          background: #000000;
          border-bottom: 2px solid #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }

        .hw-title {
          margin: 0;
          color: #ffffff;
          font-size: 1.2rem;
          font-weight: 900;
          letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255,255,255,0.3);
        }

        .hw-status-badge {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          border: 1px solid #f59e0b;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .hw-content {
          padding: 30px;
          overflow-y: auto;
          flex: 1;
          z-index: 5;
        }

        .hw-diagram-panel {
          background: #000000;
          border: 1px solid #334155;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          overflow-x: auto;
        }

        .ascii-art {
          color: #38bdf8;
          font-size: 0.85rem;
          line-height: 1.3;
          margin: 0;
          text-shadow: 0 0 5px rgba(56, 189, 248, 0.4);
        }

        .hw-lead-text {
          color: #e2e8f0;
          font-size: 1rem;
          line-height: 1.6;
          margin-bottom: 40px;
          border-left: 3px solid #34d399;
          padding-left: 15px;
        }

        .hw-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .hw-module-card {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
        }

        .module-header {
          padding: 12px 15px;
          border-bottom: 1px solid #1e293b;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .module-id { color: #64748b; font-size: 0.75rem; font-weight: bold; }
        .module-name { color: #f8fafc; font-size: 0.9rem; font-weight: 900; letter-spacing: 1px; }

        .module-body {
          padding: 15px;
          color: #94a3b8;
          font-size: 0.85rem;
          line-height: 1.5;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .module-tag {
          align-self: flex-start;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 900;
          margin-top: 15px;
        }
        .bg-blue { background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid #38bdf8; }
        .bg-amber { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid #f59e0b; }
        .bg-green { background: rgba(52, 211, 153, 0.1); color: #34d399; border: 1px solid #34d399; }

        .hw-action-row {
          text-align: center;
          margin-top: 20px;
        }

        .hw-btn-primary {
          display: inline-block;
          background: #000000;
          color: #38bdf8;
          border: 1px solid #38bdf8;
          padding: 12px 24px;
          font-weight: 900;
          text-decoration: none;
          letter-spacing: 2px;
          transition: all 0.2s;
          cursor: pointer;
        }
        .hw-btn-primary:hover {
          background: #38bdf8;
          color: #000;
          box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
        }

        .hw-custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .hw-custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>
    </div>
  );
}