'use client';

import { useState } from 'react';
import Chat from './Chat';

export default function ChatToggle() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => setIsOpen((prev) => !prev);

  return (
    <>
      {/* Hardware Conduit Toggle */}
      {!isOpen && (
        <button className="hw-conduit-toggle" onClick={toggleChat}>
          <div className="status-blinker"></div>
          <span className="conduit-label">[ CFO_UPLINK ]</span>
        </button>
      )}

      {/* Terminal Window */}
      {isOpen && (
        <div className="hw-terminal-wrapper">
          <div className="hw-terminal-header">
            <div className="hw-header-left">
              <span className="hw-terminal-icon">🛡️</span>
              <div className="hw-terminal-title">
                <span className="main-id">CLOUD_CFO_CONDUIT</span>
                <span className="sub-id">STATUS: ENCRYPTED</span>
              </div>
            </div>
            {/* THIS IS THE EXIT BUTTON */}
            <button className="hw-terminal-close" onClick={toggleChat}>[X]</button>
          </div>
          <div className="hw-terminal-body">
            <Chat />
          </div>
        </div>
      )}

      <style jsx>{`
        /* Hardware Toggle Button */
        .hw-conduit-toggle {
          position: fixed;
          bottom: 32px;
          right: 32px;
          height: 40px; /* Slimmer */
          padding: 0 14px;
          background: #000000;
          color: #38bdf8;
          border: 2px solid #1e293b;
          border-radius: 4px;
          box-shadow: 0 0 15px rgba(56, 189, 248, 0.2);
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s;
          z-index: 9990;
          font-family: 'Courier New', Courier, monospace;
        }

        .hw-conduit-toggle:hover {
          background: #0f172a;
          border-color: #38bdf8;
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
        }

        .status-blinker {
          width: 6px; /* Smaller */
          height: 6px;
          background-color: #34d399;
          border-radius: 50%;
          box-shadow: 0 0 8px #34d399;
          animation: terminal-blink 1.5s infinite;
        }

        .conduit-label {
          font-weight: 900;
          font-size: 0.8rem; /* Smaller */
          letter-spacing: 2px;
        }

        /* Terminal Wrapper (Compressed Conduit) */
        .hw-terminal-wrapper {
          position: fixed;
          bottom: 32px;
          right: 32px;
          width: 360px; /* Slimmer width */
          height: 500px; /* Shorter height */
          max-height: calc(100vh - 64px);
          background: #020617;
          border: 2px solid #334155;
          border-radius: 6px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9), 0 0 20px rgba(56, 189, 248, 0.1);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 9990;
          font-family: 'Courier New', Courier, monospace;
        }

        .hw-terminal-header {
          background: #000000;
          padding: 8px 12px; /* Tighter padding */
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1e293b;
        }

        .hw-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .hw-terminal-icon {
          font-size: 1rem;
          filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.5));
        }

        .hw-terminal-title {
          display: flex;
          flex-direction: column;
        }

        .main-id {
          color: #f8fafc;
          font-size: 0.8rem;
          font-weight: 900;
          letter-spacing: 1px;
        }

        .sub-id {
          color: #34d399;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 1px;
          margin-top: 1px;
        }

        .hw-terminal-close {
          background: transparent;
          border: none;
          color: #64748b;
          font-family: inherit;
          font-weight: 900;
          font-size: 0.9rem;
          cursor: pointer;
          transition: color 0.2s;
          padding: 4px; /* Ensure click area is reasonable */
        }

        .hw-terminal-close:hover {
          color: #ef4444;
        }

        .hw-terminal-body {
          flex: 1;
          overflow: hidden;
          background: #020617;
          position: relative;
        }

        /* Subtle scanline overlay for the terminal body */
        .hw-terminal-body::after {
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
            rgba(0, 0, 0, 0.1) 50%,
            rgba(0, 0, 0, 0.1)
          );
          background-size: 100% 4px;
          pointer-events: none;
          opacity: 0.3;
        }

        @keyframes terminal-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        @media (max-width: 600px) {
          .hw-conduit-toggle { bottom: 16px; right: 16px; }
          .hw-terminal-wrapper {
            bottom: 16px;
            right: 16px;
            width: calc(100vw - 32px);
            max-height: calc(100vh - 32px);
          }
        }
      `}</style>
    </>
  );
}