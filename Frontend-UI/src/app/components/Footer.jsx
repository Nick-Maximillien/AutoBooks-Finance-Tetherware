'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        
        {/* Top Section: Brand & Links */}
        <div className="footer-top">
          
          {/* Brand Column */}
          <div className="footer-brand">
            <Link href="/">
              <Image 
                src="/images/logo.png" 
                alt="AutoBooks" 
                width={110} 
                height={36} 
                className="footer-logo" 
              />
            </Link>
            <p className="footer-desc">
              The Sovereign CFO Copilot. Autonomous double-entry ledger management, real-time analytics, and financial intelligence for modern businesses.
            </p>
          </div>

          {/* Navigation Columns */}
          <div className="footer-links-grid">
            <div className="footer-column">
              <h4>Platform</h4>
              <Link href="/shopper_dashboard" className="footer-link">Books</Link>
              <Link href="/analytics" className="footer-link">Analytics</Link>
              <Link href="/reconciliation" className="footer-link">Ledger Overwatch</Link>
              <Link href="/journal" className="footer-link">Journal</Link>
              <Link href="/ui-navigator" className="footer-link agent-highlight">✦ Autonomous Agent</Link>
            </div>

            <div className="footer-column">
              <h4>Company</h4>
              <Link href="/about" className="footer-link">About Us</Link>
              <Link href="/services" className="footer-link">Solutions</Link>
              <Link href="/docs" className="footer-link">Documentation</Link>
              <Link href="/contact" className="footer-link">Contact Support</Link>
            </div>
          </div>
        </div>

        {/* Bottom Section: Copyright & Legal */}
        <div className="footer-bottom">
          <p className="copyright">
            &copy; {currentYear} Autobooks AI ke | All rights reserved.
          </p>
          <div className="legal-links">
            <Link href="/privacy" className="footer-link">Privacy Policy</Link>
            <Link href="/terms" className="footer-link">Terms of Service</Link>
          </div>
        </div>

      </div>

      <style jsx>{`
        .site-footer {
          background-color: #020617; /* Deepest Slate */
          border-top: 1px solid #1e293b;
          color: #94a3b8;
          font-family: 'Inter', system-ui, sans-serif;
          padding: 4rem 0 1.5rem 0;
          margin-top: auto; /* Pushes footer to bottom if content is short */
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
          margin-bottom: 4rem;
        }

        .footer-brand {
          max-width: 340px;
        }

        .footer-logo {
          object-fit: contain;
          filter: brightness(0) invert(1); /* Ensures white logo */
          margin-bottom: 1.25rem;
          opacity: 0.9;
          transition: opacity 0.2s;
        }
        
        .footer-logo:hover {
          opacity: 1;
        }

        .footer-desc {
          font-size: 0.9rem;
          line-height: 1.6;
          color: #64748b;
          margin: 0;
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
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .footer-link {
          text-decoration: none;
          color: #94a3b8;
          font-size: 0.9rem;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .footer-link:hover {
          color: #f8fafc;
          transform: translateX(2px);
        }

        .agent-highlight {
          color: #38bdf8;
        }
        .agent-highlight:hover {
          color: #7dd3fc;
        }

        /* --- Bottom Section --- */
        .footer-bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 0.85rem;
        }

        .copyright {
          margin: 0;
        }

        .legal-links {
          display: flex;
          gap: 1.5rem;
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