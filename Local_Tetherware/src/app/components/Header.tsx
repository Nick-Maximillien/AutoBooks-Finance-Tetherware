'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path ? "active" : "";

  return (
    <header className="site-header">
      <div className="header-inner">
        
        {/* Logo Area */}
        <div className="brand-zone">
          <Link href="/" className="logo-link">
            <span className="hw-icon">🛡️</span>
            <div className="brand-text">
              <span className="brand-title">TETHERWARE</span>
              <span className="brand-sub">ENCLAVE</span>
            </div>
          </Link>
        </div>

        {/* Desktop Inline Nav */}
        <nav className="desktop-nav">
          <Link href="/" className={`nav-link ${isActive('/')}`}>[ SYSTEM ]</Link>
          <Link href="/journal" className={`nav-link ${isActive('/journal')}`}>[ LEDGER ]</Link>
          <div className="divider"></div>
          <Link href="/about" className={`nav-link ${isActive('/about')}`}>[ ABOUT ]</Link>
          <Link href="/docs" className={`nav-link ${isActive('/docs')}`}>[ HELP_?]</Link>
        </nav>

        {/* Status Indicator */}
        <div className="sys-status">
          <span className="status-dot"></span>
          <span className="status-text">SECURE</span>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button 
          className="mobile-toggle" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="square">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* Mobile Nav Dropdown */}
        {isMobileMenuOpen && (
          <div className="mobile-dropdown">
            <Link href="/" className={`mob-link ${isActive('/')}`} onClick={() => setIsMobileMenuOpen(false)}>SYSTEM</Link>
            <Link href="/journal" className={`mob-link ${isActive('/journal')}`} onClick={() => setIsMobileMenuOpen(false)}>LEDGER</Link>
            <div className="mob-divider"></div>
            <Link href="/about" className={`mob-link ${isActive('/about')}`} onClick={() => setIsMobileMenuOpen(false)}>ABOUT</Link>
            <Link href="/docs" className={`mob-link ${isActive('/docs')}`} onClick={() => setIsMobileMenuOpen(false)}>HELP</Link>
          </div>
        )}
      </div>

      <style jsx>{`
        .site-header {
          background-color: #000000; /* Pitch black for hardware feel */
          border-bottom: 2px solid #1e293b; /* Heavy dark border */
          position: sticky;
          top: 0;
          z-index: 9999;
          font-family: 'Courier New', Courier, monospace; /* Monospace for technical feel */
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
        }

        .header-inner {
          max-width: 1400px; /* Full desktop width */
          margin: 0 auto;
          padding: 0 1.5rem;
          height: 64px; /* Slightly tighter hardware feel */
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Branding */
        .brand-zone {
          display: flex;
          align-items: center;
        }

        .logo-link {
          display: flex;
          align-items: center;
          text-decoration: none;
          gap: 12px;
          transition: opacity 0.2s;
        }
        .logo-link:hover { opacity: 0.8; }

        .hw-icon {
          font-size: 1.5rem;
          filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.4));
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .brand-title {
          color: #ffffff;
          font-size: 1.1rem;
          font-weight: 900;
          letter-spacing: 3px;
          line-height: 1;
        }

        .brand-sub {
          color: #38bdf8;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 4px;
          margin-top: 2px;
        }

        /* Desktop Nav */
        .desktop-nav {
          display: none;
          align-items: center;
          gap: 1rem;
        }

        .divider {
          width: 2px;
          height: 16px;
          background-color: #334155;
          margin: 0 0.5rem;
        }

        .nav-link {
          text-decoration: none;
          color: #64748b; 
          font-size: 0.85rem; 
          font-weight: 700; 
          padding: 6px 12px;
          transition: all 0.2s ease;
          letter-spacing: 1px;
        }

        .nav-link:hover {
          color: #e2e8f0;
          text-shadow: 0 0 8px rgba(255,255,255,0.3);
        }

        /* Hardware Active State */
        .nav-link.active {
          color: #34d399; /* Terminal green */
          text-shadow: 0 0 10px rgba(52, 211, 153, 0.5);
        }

        /* System Status Indicator */
        .sys-status {
          display: none;
          align-items: center;
          background: #0f172a;
          border: 1px solid #1e293b;
          padding: 6px 12px;
          border-radius: 4px;
          gap: 8px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background-color: #34d399;
          border-radius: 50%;
          box-shadow: 0 0 8px #34d399;
        }

        .status-text {
          color: #94a3b8;
          font-size: 0.7rem;
          font-weight: bold;
          letter-spacing: 1px;
        }

        /* Mobile Nav */
        .mobile-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0f172a;
          border: 1px solid #334155;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          transition: all 0.2s;
        }

        .mobile-toggle:hover {
          background: #1e293b;
          border-color: #38bdf8;
        }

        .mobile-dropdown {
          position: absolute;
          top: 72px;
          right: 1.5rem;
          background: #000000;
          border: 2px solid #1e293b;
          border-radius: 8px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.9);
          padding: 1rem;
          display: flex;
          flex-direction: column;
          min-width: 220px;
          gap: 6px; 
        }

        .mob-divider {
          height: 2px;
          background-color: #1e293b;
          margin: 8px 0;
        }

        .mob-link {
          text-decoration: none;
          color: #94a3b8; 
          font-size: 0.9rem; 
          font-weight: 700; 
          padding: 10px 14px;
          border-radius: 6px;
          transition: all 0.2s;
          letter-spacing: 1px;
        }

        .mob-link:hover {
          background: #0f172a;
          color: #e2e8f0;
        }

        .mob-link.active {
          color: #34d399;
          background: rgba(52, 211, 153, 0.1);
          border: 1px solid rgba(52, 211, 153, 0.3);
        }

        /* Responsive Breakpoints */
        @media (min-width: 900px) {
          .desktop-nav {
            display: flex;
          }
          .sys-status {
            display: flex;
          }
          .mobile-toggle {
            display: none;
          }
          .mobile-dropdown {
            display: none;
          }
        }
      `}</style>
    </header>
  );
}