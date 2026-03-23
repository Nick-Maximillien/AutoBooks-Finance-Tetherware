'use client';

import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        
        {/* Top Section: Brand & Links */}
        <div className="footer-top">
          
          {/* Brand Column */}
          <div className="footer-brand">
            <Link href="/" className="logo-link">
              <span className="hw-icon">🛡️</span>
              <div className="brand-text">
                <span className="brand-title">TETHERWARE</span>
                <span className="brand-sub">ENCLAVE</span>
              </div>
            </Link>
            <p className="footer-desc">
              Sovereign Local Execution Environment. Powered by Tether WDK. 
              Air-gapped transaction signing and autonomous multi-chain settlement.
            </p>
          </div>

          {/* Navigation Columns */}
          <div className="footer-links-grid">
            <div className="footer-column">
              <h4>[ CORE ]</h4>
              <Link href="/claware" className="footer-link">Dashboard</Link>
              <Link href="/claware" className="footer-link">Enclave Access</Link>
              <Link href="/settings" className="footer-link">System Settings</Link>
            </div>

            <div className="footer-column">
              <h4>[ WDK_PROTOCOL ]</h4>
              <a href="https://github.com/tether" target="_blank" rel="noopener noreferrer" className="footer-link">Tether GitHub</a>
              <a href="https://tether.to/en/tether-evm-wdk" target="_blank" rel="noopener noreferrer" className="footer-link">WDK Documentation</a>
              <Link href="/audit" className="footer-link agent-highlight">View Audit Logs</Link>
            </div>
          </div>
        </div>

        {/* Bottom Section: Copyright & Legal */}
        <div className="footer-bottom">
          <p className="copyright">
            &copy; {currentYear} AUTOBOOKS FINANCE | SECURE LOCAL INSTANCE
          </p>
          <div className="legal-links">
            <span className="sys-status">
              <span className="status-dot"></span>
              WDK_BRIDGE_ACTIVE
            </span>
          </div>
        </div>

      </div>

      <style jsx>{`
        .site-footer {
          background-color: #000000; /* Pitch black */
          border-top: 2px solid #1e293b; /* Heavy border */
          color: #94a3b8;
          font-family: 'Courier New', Courier, monospace; /* Terminal font */
          padding: 3rem 0 1.5rem 0;
          margin-top: auto; 
          box-shadow: inset 0 20px 40px -20px rgba(0,0,0,0.8);
        }

        .footer-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        /* --- Top Section --- */
        .footer-top {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 3rem;
          margin-bottom: 3rem;
        }

        .footer-brand {
          max-width: 380px;
        }

        .logo-link {
          display: flex;
          align-items: center;
          text-decoration: none;
          gap: 12px;
          margin-bottom: 20px;
        }

        .hw-icon {
          font-size: 2rem;
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.4));
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .brand-title {
          color: #ffffff;
          font-size: 1.4rem;
          font-weight: 900;
          letter-spacing: 3px;
          line-height: 1;
        }

        .brand-sub {
          color: #38bdf8;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 4px;
          margin-top: 4px;
        }

        .footer-desc {
          font-size: 0.85rem;
          line-height: 1.6;
          color: #64748b;
          margin: 0;
          letter-spacing: 1px;
        }

        /* --- Links Grid --- */
        .footer-links-grid {
          display: flex;
          gap: 5rem;
          flex-wrap: wrap;
        }

        .footer-column {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .footer-column h4 {
          color: #f8fafc;
          font-size: 0.9rem;
          font-weight: 700;
          margin: 0 0 0.5rem 0;
          letter-spacing: 2px;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 8px;
        }

        .footer-link {
          text-decoration: none;
          color: #64748b;
          font-size: 0.85rem;
          font-weight: 700;
          transition: all 0.2s ease;
          letter-spacing: 1px;
        }

        .footer-link:hover {
          color: #e2e8f0;
          transform: translateX(4px);
        }

        .agent-highlight {
          color: #34d399; /* Success green */
        }
        .agent-highlight:hover {
          color: #10b981;
          text-shadow: 0 0 8px rgba(52, 211, 153, 0.4);
        }

        /* --- Bottom Section --- */
        .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid #1e293b;
          font-size: 0.75rem;
          font-weight: bold;
          letter-spacing: 1px;
        }

        .copyright {
          margin: 0;
          color: #475569;
        }

        .sys-status {
          display: flex;
          align-items: center;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.05);
          border: 1px solid rgba(56, 189, 248, 0.2);
          padding: 6px 12px;
          border-radius: 4px;
          gap: 8px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          background-color: #38bdf8;
          border-radius: 50%;
          box-shadow: 0 0 8px #38bdf8;
          animation: pulse 2s infinite alternate;
        }

        @keyframes pulse {
          0% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .footer-top {
            flex-direction: column;
            gap: 2.5rem;
          }
          
          .footer-links-grid {
            gap: 3rem;
          }

          .footer-bottom {
            flex-direction: column;
            text-align: center;
            justify-content: center;
          }
        }
      `}</style>
    </footer>
  );
}