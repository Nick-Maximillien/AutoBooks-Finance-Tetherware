'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function TetherWareHome() {
  const [bootSequence, setBootSequence] = useState(0);

  // Simulates a quick hardware initialization sequence for the "native app" feel
  useEffect(() => {
    const sequence = [
      setTimeout(() => setBootSequence(1), 400),
      setTimeout(() => setBootSequence(2), 900),
      setTimeout(() => setBootSequence(3), 1400)
    ];
    return () => sequence.forEach(clearTimeout);
  }, []);

  return (
    <div className="native-window">
      <main className="enclave-container">
        
        {/* Hardware Status Indicators */}
        <div className="hardware-status">
          <div className="status-row">
            <span className="status-label">SYS_MEM:</span>
            <span className={`status-value ${bootSequence >= 1 ? 'ready' : ''}`}>
              {bootSequence >= 1 ? '[ OK ]' : '[ CHECKING... ]'}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">CRYPTO_CORE:</span>
            <span className={`status-value ${bootSequence >= 2 ? 'ready' : ''}`}>
              {bootSequence >= 2 ? '[ INITIALIZED ]' : '[ WAITING ]'}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">WDK_BRIDGE:</span>
            <span className={`status-value ${bootSequence >= 3 ? 'ready' : ''}`}>
              {bootSequence >= 3 ? '[ SECURED ]' : '[ OFFLINE ]'}
            </span>
          </div>
        </div>

        {/* Main Branding */}
        <div className="branding">
          <div className="shield-icon"></div>
          <h1 className="app-title">TETHERWARE</h1>
          <p className="app-subtitle">SOFTWARE-DEFINED HARDWARE WALLET</p>
        </div>

        {/* Action Area */}
        <div className="action-area">
          <Link 
            href="/claware" 
            className={`access-btn ${bootSequence >= 3 ? 'active' : 'disabled'}`}
            onClick={(e) => bootSequence < 3 && e.preventDefault()}
          >
            {bootSequence >= 3 ? 'INITIALIZE ENCLAVE' : 'BOOTING...'}
          </Link>
          <p className="security-note">
            AES-256 AIR-GAPPED LOCAL EXECUTION ENVIRONMENT
          </p>
        </div>

      </main>

      <style jsx>{`
        .native-window {
          height: 100vh; /* Fixed height instead of min-height to strictly prevent scrolling */
          width: 100vw;
          overflow: hidden; /* Hide any accidental overflow */
          background-color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Courier New', Courier, monospace;
          color: #e2e8f0;
          box-shadow: inset 0 0 150px rgba(0, 0, 0, 1);
        }

        .enclave-container {
          width: 100%;
          max-width: 520px; 
          background: #020617;
          border: 2px solid #334155; 
          border-radius: 16px;
          padding: 35px 35px; /* Reduced vertical padding */
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.15);
          position: relative;
          overflow: hidden;
        }

        /* Stronger scanline effect */
        .enclave-container::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0),
            rgba(255, 255, 255, 0) 50%,
            rgba(0, 0, 0, 0.15) 50%,
            rgba(0, 0, 0, 0.15)
          );
          background-size: 100% 4px;
          pointer-events: none;
          opacity: 0.5;
        }

        .hardware-status {
          background: #000;
          border: 2px solid #1e293b;
          padding: 15px; /* Reduced padding */
          border-radius: 8px;
          margin-bottom: 30px; /* Reduced margin */
          font-size: 1rem; /* Slightly smaller */
          font-weight: 800; 
          letter-spacing: 2px;
          box-shadow: inset 0 0 20px rgba(0,0,0,1);
        }

        .status-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px; /* Tighter rows */
        }
        .status-row:last-child {
          margin-bottom: 0;
        }

        .status-label {
          color: #94a3b8; 
        }

        .status-value {
          color: #fbbf24; 
          transition: color 0.3s;
        }
        .status-value.ready {
          color: #34d399; 
          text-shadow: 0 0 12px rgba(52, 211, 153, 0.6);
        }

        .branding {
          text-align: center;
          margin-bottom: 40px; /* Reduced margin */
        }

        .shield-icon {
          font-size: 3.5rem; /* Scaled down slightly */
          margin-bottom: 15px;
          filter: drop-shadow(0 0 25px rgba(56, 189, 248, 0.4));
        }

        .app-title {
          font-size: 2.4rem; /* Scaled down slightly */
          color: #ffffff; 
          margin: 0 0 5px 0;
          letter-spacing: 5px;
          font-weight: 900;
          text-shadow: 0 0 20px rgba(56, 189, 248, 0.5);
        }

        .app-subtitle {
          font-size: 0.95rem; /* Scaled down slightly */
          color: #7dd3fc; 
          margin: 0;
          letter-spacing: 3px;
          font-weight: 700;
        }

        .action-area {
          text-align: center;
        }

        .access-btn {
          display: block;
          width: 100%;
          padding: 18px; /* Slightly thinner button */
          background: #1e293b;
          color: #94a3b8;
          text-decoration: none;
          font-size: 1.1rem; /* Scaled down slightly */
          font-weight: 900; 
          letter-spacing: 3px;
          border: 2px solid #334155;
          border-radius: 12px;
          transition: all 0.3s ease;
          position: relative;
          z-index: 10;
        }

        .access-btn.active {
          background: #0f172a;
          color: #38bdf8;
          border-color: #38bdf8;
          box-shadow: 0 0 30px rgba(56, 189, 248, 0.2), inset 0 0 15px rgba(56, 189, 248, 0.15);
        }

        .access-btn.active:hover {
          background: #38bdf8;
          color: #000000; 
          border-color: #38bdf8;
          box-shadow: 0 0 40px rgba(56, 189, 248, 0.6);
          transform: translateY(-3px);
        }

        .access-btn.disabled {
          cursor: not-allowed;
          animation: pulse 1s infinite alternate;
        }

        .security-note {
          margin-top: 20px; /* Reduced margin */
          font-size: 0.75rem; /* Scaled down slightly */
          color: #64748b;
          font-weight: 700;
          letter-spacing: 2px;
        }

        @keyframes pulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}