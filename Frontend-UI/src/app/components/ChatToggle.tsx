'use client';

import { useState } from 'react';
import Chat from './Chat';

export default function ChatToggle() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => setIsOpen((prev) => !prev);

  return (
    <>
      {/* Floating Button (Pill Shape) */}
      {!isOpen && (
        <button className="chat-fab" onClick={toggleChat}>
          <div className="cfo-icon-placeholder">
            <span>CFO</span>
          </div>
          <span className="chatz">Chat</span>
        </button>
      )}

      {/* Chat Box */}
      {isOpen && (
        <div className="chat-wrapper">
          <div className="chat-header">
            <div className="chat-header-info">
              <div className="chat-avatar-placeholder">
                <span>Analyst</span>
              </div>
              <span>Chat with your Analyst</span>
            </div>
            <button className="chat-close" onClick={toggleChat}>
              ✕
            </button>
          </div>
          <div className="chat-body">
            <Chat />
          </div>
        </div>
      )}

      <style jsx>{`
        /* CFO Icon Styling (Replaces Image) */
        .cfo-icon-placeholder, .chat-avatar-placeholder {
          width: 28px;
          height: 28px;
          background: #ffffff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          font-weight: 800;
          color: #2563eb;
          flex-shrink: 0;
        }

        .chat-avatar-placeholder {
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        /* Floating Button */
        .chat-fab {
          position: fixed;
          top: 90px;
          right: 32px;
          height: 48px;
          padding: 0 20px 0 10px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 99px;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 9990;
        }

        .chat-fab:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
          background: #1d4ed8;
        }
        
        .chatz {
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.02em;
        }

        /* Chat Wrapper */
        .chat-wrapper {
          position: fixed;
          top: 90px;
          right: 32px;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 120px);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: scaleFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 9990;
          border: 1px solid #e2e8f0;
        }

        .chat-header {
          background: #0f172a;
          color: #f8fafc;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #1e293b;
        }

        .chat-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
          font-weight: 700;
          font-size: 1rem;
          letter-spacing: 0.02em;
        }

        .chat-close {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.2rem;
          cursor: pointer;
          transition: color 0.2s ease;
          padding: 4px;
        }

        .chat-close:hover { color: #ef4444; }

        .chat-body {
          flex: 1;
          overflow-y: auto;
          background: #f8fafc;
        }

        @keyframes scaleFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
            transform-origin: top right;
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
            transform-origin: top right;
          }
        }

        @media (max-width: 600px) {
          .chat-fab { top: 85px; right: 16px; }
          .chat-wrapper {
            top: 85px;
            right: 16px;
            width: calc(100vw - 32px);
            max-height: calc(100vh - 100px);
          }
        }
      `}</style>
    </>
  );
}