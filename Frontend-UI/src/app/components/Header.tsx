'use client';

import Link from 'next/link';
import Image from 'next/image'; 
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path ? "active" : "";

  return (
    <header className="site-header">
      <div className="header-inner">
        
        {/* Logo - Brand text removed to prevent duplication */}
        <Link href="/" className="logo-link">
          <Image 
            src="/images/logo.png" 
            alt="AutoBooks" 
            width={110} 
            height={36} 
            className="logo-img" 
            priority 
          />
        </Link>

        {/* Desktop Inline Nav */}
        <nav className="desktop-nav">
          <Link href="/" className={`nav-link ${isActive('/')}`}>Home</Link>
          <Link href="/shopper_dashboard" className={`nav-link ${isActive('/shopper_dashboard')}`}>Books</Link>
          <Link href="/analytics" className={`nav-link ${isActive('/analytics')}`}>Analytics</Link>
          <Link href="/reconciliation" className={`nav-link ${isActive('/reconciliation')}`}>Ledger Overwatch</Link>
          <Link href="/journal" className={`nav-link ${isActive('/journal')}`}>Journal</Link>
          <Link href="/admin" className={`nav-link ${isActive('/admin')}`}>Web3 Treasury</Link>
          <Link href="/ui_navigator" className={`nav-link agent-link ${isActive('/ui_navigator')}`}>✦ Autonomous Agent</Link>
          <div className="divider"></div>
          <Link href="/about" className={`nav-link ${isActive('/about')}`}>About</Link>
          <Link href="/" className={`nav-link ${isActive('/docs')}`}>Docs</Link>
        </nav>

        {/* Mobile Hamburger Toggle */}
        <button 
          className="mobile-toggle" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        {/* Mobile Nav Dropdown */}
        {isMobileMenuOpen && (
          <div className="mobile-dropdown">
            <Link href="/" className={`mob-link ${isActive('/')}`} onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
            <Link href="/shopper_dashboard" className={`mob-link ${isActive('/shopper_dashboard')}`} onClick={() => setIsMobileMenuOpen(false)}>Books</Link>
            <Link href="/analytics" className={`mob-link ${isActive('/analytics')}`} onClick={() => setIsMobileMenuOpen(false)}>Analytics</Link>
            <Link href="/reconciliation" className={`mob-link ${isActive('/reconciliation')}`} onClick={() => setIsMobileMenuOpen(false)}>Ledger Overwatch</Link>
            <Link href="/journal" className={`mob-link ${isActive('/journal')}`} onClick={() => setIsMobileMenuOpen(false)}>Journal</Link>
            <Link href="/admin" className={`mob-link ${isActive('/admin')}`} onClick={() => setIsMobileMenuOpen(false)}>Web3 Treasury</Link>
            <Link href="/ui_navigator" className={`mob-link agent-link-mob ${isActive('/ui_navigator')}`} onClick={() => setIsMobileMenuOpen(false)}>✦ Autonomous Agent</Link>
            <div className="mob-divider"></div>
            <Link href="/about" className={`mob-link ${isActive('/about')}`} onClick={() => setIsMobileMenuOpen(false)}>About</Link>
            <Link href="/" className={`mob-link ${isActive('/docs')}`} onClick={() => setIsMobileMenuOpen(false)}>Docs</Link>
          </div>
        )}
      </div>

      <style jsx>{`
        .site-header {
          background-color: white;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          position: sticky;
          top: 0;
          z-index: 9999;
          font-family: 'Inter', system-ui, sans-serif;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .header-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          height: 72px; /* Slightly taller for breathing room */
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .logo-link {
          display: flex;
          align-items: center;
          transition: opacity 0.2s;
        }
        .logo-link:hover {
          opacity: 0.8;
        }

        .logo-img {
          object-fit: contain;
        }

        /* Desktop Nav */
        .desktop-nav {
          display: none;
          align-items: center;
          gap: 1.5rem; /* Significantly widened gaps between items */
        }

        .divider {
          width: 1px;
          height: 24px;
          background-color: rgba(255, 255, 255, 0.25);
          margin: 0 0.5rem;
        }

        .nav-link {
          text-decoration: none;
          color: #ffffff; /* Pure white for high contrast */
          font-size: 0.95rem; /* Slightly larger */
          font-weight: 600; /* Bolder text */
          padding: 8px 18px;
          border-radius: 99px; /* Pill shape */
          transition: all 0.2s ease;
          letter-spacing: 0.02em;
        }

        .nav-link:hover {
          background-color: rgba(255, 255, 255, 0.15);
        }

        /* The Active State (The FinTech Pill) */
        .nav-link.active {
          background-color: #2563eb; /* Vibrant Blue */
          font-weight: 700; /* Extra bold when active */
          box-shadow: 0 2px 10px rgba(37, 99, 235, 0.4);
        }

        /* Special Styling for the Agent Link to make it pop */
        .agent-link {
          color: #e0f2fe; /* Light blue tint to stand out */
          background-color: rgba(56, 189, 248, 0.15);
          border: 1px solid rgba(56, 189, 248, 0.3);
        }
        .agent-link:hover {
          background-color: rgba(56, 189, 248, 0.25);
          color: rgba(56, 189, 248, 0.5);
        }
        .agent-link.active {
          background-color: #38bdf8;
          color: #0f172a;
          box-shadow: 0 2px 12px rgba(56, 189, 248, 0.5);
        }

        /* Mobile Nav */
        .mobile-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          color: #ffffff; /* Crisp white icon */
          transition: all 0.2s;
        }

        .mobile-toggle:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .mobile-dropdown {
          position: absolute;
          top: 80px;
          right: 1.5rem;
          background: #0f172a;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          padding: 0.75rem;
          display: flex;
          flex-direction: column;
          min-width: 240px;
          gap: 8px; /* More spacing between mobile items */
        }

        .mob-divider {
          height: 1px;
          background-color: rgba(255, 255, 255, 0.15);
          margin: 6px 0;
        }

        .mob-link {
          text-decoration: none;
          color: #ffffff; /* Pure white */
          font-size: 1rem; /* Larger touch targets */
          font-weight: 600; /* Bolder text */
          padding: 12px 16px;
          border-radius: 8px;
          transition: all 0.2s;
        }

        .mob-link:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .mob-link.active {
          background-color: #2563eb;
          font-weight: 700;
        }

        .agent-link-mob {
          color: #e0f2fe;
          background-color: rgba(56, 189, 248, 0.1);
        }
        .agent-link-mob:hover {
          background-color: rgba(56, 189, 248, 0.2);
        }
        .agent-link-mob.active {
          background-color: #38bdf8;
          color: #0f172a;
        }

        /* Show desktop nav on wider screens */
        @media (min-width: 1100px) {
          .desktop-nav {
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