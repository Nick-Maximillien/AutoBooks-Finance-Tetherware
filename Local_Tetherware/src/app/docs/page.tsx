'use client';

import React from 'react';
import Link from 'next/link';

export default function Docs() {
  return (
    <div className="hw-layout">
      <div className="hw-container">
        
        <div className="hw-header">
          <div className="hw-header-left">
            <span className="hw-terminal-icon">🗄️</span>
            <div className="hw-header-titles">
              <h1 className="hw-title">ENCLAVE_OPERATIONAL_MANUAL</h1>
              <span className="hw-subtitle">V.1.0 // TETHER_WDK_IMPLEMENTATION</span>
            </div>
          </div>
          <span className="hw-status-badge">DOCS_ONLINE</span>
        </div>

        <div className="hw-content hw-custom-scrollbar">
          
          <div className="doc-section">
            <h2>[01] THE AIR-GAPPED BOOT SEQUENCE</h2>
            <p>
              TetherWare operates on a strict zero-trust model. When you initialize the Enclave, a local BIP-39 mnemonic seed phrase is generated using <code>ethers.Wallet.createRandom()</code>. 
            </p>
            <div className="hw-code-block">
              <span className="code-comment">// AES-256 Local Encryption</span><br/>
              <span className="code-keyword">const</span> encryptedSeed = CryptoJS.AES.encrypt(mnemonic, devicePIN);<br/>
              localStorage.setItem(<span className="code-string">"claware_encrypted_seed"</span>, encryptedSeed);
            </div>
            <p className="warning-text">
              ⚠️ WARNING: Your unencrypted keys are NEVER transmitted to the cloud. If you lose your Device PIN, your assets are permanently unrecoverable unless you have exported the raw seed phrase.
            </p>
          </div>

          <div className="doc-section">
            <h2>[02] CLOUD CFO LINKAGE (THE HANDSHAKE)</h2>
            <p>
              To receive autonomous financial instructions, the local Enclave must bind its public address to the AutoBooks Cloud CFO.
            </p>
            <ul>
              <li><strong>Step A:</strong> The user enters their Cloud credentials and local Device PIN.</li>
              <li><strong>Step B:</strong> The Enclave decrypts the local wallet to derive the Public Smart Account Address.</li>
              <li><strong>Step C:</strong> A JWT authentication is established with Django, mapping the <code>wallet_address</code> to the specific <code>BusinessProfile</code>.</li>
            </ul>
            <p>Once linked, the <strong>OpenClaw Sweeper</strong> begins polling the Django <code>/api/documents/</code> endpoint every 20 seconds for pending AI intents.</p>
          </div>

          <div className="doc-section">
            <h2>[03] AUTONOMOUS HANDOFF & SIGNING</h2>
            <p>
              When the Cloud CFO processes a bill, it generates an <code>unsigned_payload</code> (An ERC-4337 UserOperation intent). This payload sits safely in the cloud database.
            </p>
            <p>
              The local Enclave detects this payload. Upon reviewing the transaction on the native desktop application, the user enters their PIN. The Enclave decrypts the key, signs the <code>rawPayload</code> entirely offline, and transmits the <strong>cryptographic signature</strong> to the Node Relayer.
            </p>
          </div>

          <div className="doc-section">
            <h2>[04] THE PAYMASTER & GASLESS ROUTING</h2>
            <p>
              Signed operations are broadcasted to the Node.js Master Treasury. This Node acts as an ERC-4337 Bundler and Paymaster.
            </p>
            <p>
              The Master Treasury wraps the user's transaction and pays the native gas fee (e.g., ETH or CELO) on behalf of the user. The user only needs USDT in their local wallet to execute multi-chain settlements. Following blockchain confirmation, the Node informs Django to update the IFRS double-entry ledger.
            </p>
          </div>

          <div className="hw-action-row">
            <Link href="/claware" className="hw-btn-secondary">[ GO_TO_ENCLAVE ]</Link>
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
          max-width: 900px;
          background: #020617;
          border: 2px solid #334155;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          height: 85vh;
          max-height: 900px;
          position: relative;
          overflow: hidden;
        }

        .hw-container::after {
          content: "";
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.15));
          background-size: 100% 4px;
          pointer-events: none;
          opacity: 0.3;
          z-index: 20;
        }

        .hw-header {
          padding: 16px 24px;
          background: #000000;
          border-bottom: 2px solid #334155;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
        }

        .hw-header-left {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .hw-terminal-icon {
          font-size: 1.8rem;
          filter: drop-shadow(0 0 5px rgba(52, 211, 153, 0.4));
        }

        .hw-header-titles {
          display: flex;
          flex-direction: column;
        }

        .hw-title {
          margin: 0;
          color: #ffffff;
          font-size: 1.1rem;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .hw-subtitle {
          color: #34d399;
          font-size: 0.7rem;
          font-weight: bold;
          letter-spacing: 3px;
          margin-top: 4px;
        }

        .hw-status-badge {
          background: #0f172a;
          color: #38bdf8;
          border: 1px solid #38bdf8;
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .hw-content {
          padding: 30px 40px;
          overflow-y: auto;
          flex: 1;
          z-index: 5;
        }

        .doc-section {
          margin-bottom: 40px;
        }

        .doc-section h2 {
          color: #38bdf8;
          font-size: 1rem;
          font-weight: 900;
          border-bottom: 1px dashed #334155;
          padding-bottom: 8px;
          margin-bottom: 15px;
          letter-spacing: 1px;
        }

        .doc-section p, .doc-section ul {
          color: #cbd5e1;
          font-size: 0.9rem;
          line-height: 1.6;
          margin-bottom: 15px;
        }

        .doc-section ul {
          padding-left: 20px;
          list-style-type: square;
        }

        .doc-section li {
          margin-bottom: 8px;
        }

        .hw-code-block {
          background: #000000;
          border: 1px solid #1e293b;
          border-left: 3px solid #38bdf8;
          padding: 15px;
          border-radius: 4px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.8rem;
          color: #f8fafc;
          margin: 20px 0;
          line-height: 1.5;
          overflow-x: auto;
        }

        .code-comment { color: #64748b; }
        .code-keyword { color: #34d399; font-weight: bold; }
        .code-string { color: #f59e0b; }

        .warning-text {
          color: #ef4444 !important;
          background: rgba(239, 68, 68, 0.1);
          padding: 12px;
          border: 1px solid #ef4444;
          border-radius: 4px;
          font-weight: bold;
        }

        .hw-action-row {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #1e293b;
        }

        .hw-btn-secondary {
          display: inline-block;
          background: #0f172a;
          color: #34d399;
          border: 1px solid #34d399;
          padding: 12px 24px;
          font-weight: 900;
          text-decoration: none;
          letter-spacing: 2px;
          transition: all 0.2s;
          cursor: pointer;
          border-radius: 4px;
        }
        .hw-btn-secondary:hover {
          background: #34d399;
          color: #000;
          box-shadow: 0 0 15px rgba(52, 211, 153, 0.4);
        }

        .hw-custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .hw-custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>
    </div>
  );
}