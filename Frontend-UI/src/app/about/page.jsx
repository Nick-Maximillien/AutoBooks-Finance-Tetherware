'use client';

import React from 'react';
import Link from 'next/link';

export default function AboutServicesPage() {
  const services = [
    {
      title: "Autonomous Bookkeeping",
      icon: "⚡",
      description:
        "Upload PDFs, images, or forward receipts via WhatsApp. Our neural engine extracts line items and enforces strict IFRS double-entry accounting rules instantly."
    },
    {
      title: "Sovereign CFO Copilot",
      icon: "🤖",
      description:
        "Converse with your financial data via voice or text. Ask complex strategic questions, project cash flow, and receive real-time financial guidance."
    },
    {
      title: "Real-Time Analytics",
      icon: "📊",
      description:
        "Watch your P&L, Balance Sheet, and Cash Flow update instantly when transactions are posted. Interactive charts visualize your growth."
    },
    {
      title: "Ledger Overwatch",
      icon: "🛡️",
      description:
        "Every AI action produces a strict audit trace. Review confidence scores, override classifications, and execute compliant journal reversals."
    },
    {
      title: "Omnichannel Ingestion",
      icon: "📱",
      description:
        "Send a photo of an invoice, a voice note, or drag-and-drop documents. AutoBooks processes them seamlessly across all platforms."
    },
    {
      title: "Neurosymbolic Architecture",
      icon: "🧠",
      description:
        "AI handles interpretation while the symbolic ledger enforces financial truth. This guarantees zero hallucinations about your money."
    }
  ];

  return (
    <div className="page-container">

      {/* HERO */}
      <section className="hero-section">
        <div className="badge">About AutoBooks AI</div>
        <h1 className="hero-title">
          Forging the Future of <br/><span>Financial Intelligence</span>
        </h1>
        <p className="hero-subtitle">
          AutoBooks AI eliminates the manual mechanics of accounting by
          combining autonomous bookkeeping with a sovereign AI financial
          copilot.
        </p>
      </section>

      {/* PROBLEM */}
      <section className="text-section">
        <h2>The Problem with AI in Finance</h2>
        <p>
          Traditional Large Language Models are probability engines. They
          predict words — they do not guarantee mathematical truth. When used
          directly in financial systems they can hallucinate numbers, leading
          to inaccurate balance sheets and dangerous business decisions.
        </p>
      </section>

      {/* SOLUTION */}
      <section className="highlight-box">
        <h2>Our Solution: Neurosymbolic AI</h2>
        <p className="box-intro">We engineered a radical new architecture. AutoBooks operates on a strict framework that separates language generation from computable law:</p>

        <ul className="feature-list">
          <li>
            <strong>The Symbolic Layer</strong> – A hard-coded, immutable PostgreSQL ledger
            enforcing IFRS accounting rules. It calculates exact values,
            prevents duplicates, and securely stores the financial truth.
          </li>
          <li>
            <strong>The Neural Layer</strong> – An AI copilot (Gemini) that reads the
            ledger's verified numbers and translates them into strategic,
            human-readable advice. It is entirely stripped of calculation rights.
          </li>
        </ul>

        <p className="conclusion">
          The result is an enterprise-safe financial AI that can read your
          documents, execute double-entry bookkeeping, and guide your business
          without ever hallucinating numbers.
        </p>
      </section>

      {/* UI NAVIGATOR CALLOUT - THE PROFOUND INNOVATION */}
      <section className="navigator-showcase">
        <div className="navigator-content">
          <div className="nav-badge">✦ Breakthrough Feature</div>
          <h2>The Sovereign UI Navigator</h2>
          <p>
            Experience financial ingestion like never before. Launch the UI Navigator to share your screen with the AI. Simply display an invoice, bill, or receipt on your monitor, and press the microphone to give the agent a voice command.
          </p>
          <p>
            The agent will visually scan your screen, extract the financial data, read it back to you, and autonomously execute the double-entry journal posting while providing a full visual audit trace in real-time.
          </p>
          <Link href="/ui-navigator" className="nav-launch-btn">
            Launch UI Navigator →
          </Link>
        </div>
        <div className="navigator-visual">
          <div className="mock-scanner">
             <div className="scan-line"></div>
             <span>AWAITING VISUAL INPUT</span>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="services-section">
        <h2 className="services-title">Platform Capabilities</h2>
        <div className="services-grid">
          {services.map((service, idx) => (
            <div key={idx} className="service-card">
              <div className="service-icon">{service.icon}</div>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-desc">{service.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* VALUES */}
      <section className="values-section">
        <h2>Our Core Tenets</h2>
        <div className="values-grid">
          <div className="value-card">
            <h3>01. Absolute Precision</h3>
            <p>
              Finance cannot tolerate approximation. Our symbolic ledger
              guarantees mathematical accuracy down to the final cent.
            </p>
          </div>
          <div className="value-card">
            <h3>02. Total Autonomy</h3>
            <p>
              Snap a picture or share your screen and the system executes the
              accounting automatically in the background.
            </p>
          </div>
          <div className="value-card">
            <h3>03. Human Oversight</h3>
            <p>
              AI executes bookkeeping, but humans remain in control through
              Ledger Overwatch and transparent visual audit trails.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Experience Autonomous Accounting</h2>
        <p>Join the next generation of financial infrastructure.</p>
        <Link href="/shopper_dashboard" className="primary-btn">
          Launch Dashboard
        </Link>
      </section>

      <style jsx>{`
        .page-container {
          min-height: 100vh;
          background: #020617; /* Deep Slate */
          color: #f8fafc;
          font-family: 'Inter', system-ui, sans-serif;
          padding: 5rem 2rem;
        }

        /* --- HERO --- */
        .hero-section {
          text-align: center;
          max-width: 800px;
          margin: 0 auto 6rem;
          animation: fadeUp 0.8s ease-out;
        }

        .badge {
          display: inline-block;
          padding: 6px 16px;
          background: rgba(56, 189, 248, 0.1);
          color: #38bdf8;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(56, 189, 248, 0.2);
        }

        .hero-title {
          font-size: 3.5rem;
          font-weight: 900;
          margin-bottom: 1.5rem;
          line-height: 1.1;
          letter-spacing: -0.02em;
        }

        .hero-title span {
          background: linear-gradient(135deg, #38bdf8, #2563eb);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
          color: #94a3b8;
          line-height: 1.7;
          font-size: 1.15rem;
          max-width: 600px;
          margin: 0 auto;
        }

        /* --- SECTIONS --- */
        .text-section {
          max-width: 850px;
          margin: 0 auto 5rem;
        }

        .text-section h2 {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 1.5rem;
          color: #e2e8f0;
        }

        .text-section p, .box-intro {
          font-size: 1.1rem;
          color: #cbd5e1;
          line-height: 1.8;
        }

        /* --- HIGHLIGHT BOX (Solution) --- */
        .highlight-box {
          max-width: 900px;
          margin: 0 auto 6rem;
          padding: 3.5rem;
          background: #0f172a;
          border-radius: 20px;
          border: 1px solid #1e293b;
          border-left: 4px solid #2563eb;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }

        .highlight-box h2 {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 1rem;
          margin-top: 0;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 2.5rem 0;
        }

        .feature-list li {
          margin-bottom: 1.5rem;
          padding-left: 1.8rem;
          position: relative;
          color: #cbd5e1;
          line-height: 1.6;
          font-size: 1.05rem;
        }

        .feature-list li::before {
          content: '✦';
          position: absolute;
          left: 0;
          color: #38bdf8;
          font-size: 1.2rem;
        }

        .feature-list strong {
          color: #f8fafc;
          font-size: 1.1rem;
        }

        .conclusion {
          color: #38bdf8 !important;
          font-weight: 600;
          margin-bottom: 0;
          font-size: 1.1rem;
        }

        /* --- NAVIGATOR SHOWCASE --- */
        .navigator-showcase {
          max-width: 1000px;
          margin: 0 auto 6rem;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4rem;
          align-items: center;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.5) 0%, rgba(2, 6, 23, 0) 100%);
          border: 1px solid rgba(56, 189, 248, 0.15);
          border-radius: 24px;
          padding: 4rem;
          box-shadow: inset 0 0 40px rgba(56, 189, 248, 0.05);
        }

        .nav-badge {
          display: inline-block;
          color: #fcd34d;
          font-weight: 700;
          font-size: 0.85rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }

        .navigator-content h2 {
          font-size: 2.2rem;
          font-weight: 800;
          margin-bottom: 1.5rem;
          margin-top: 0;
        }

        .navigator-content p {
          color: #cbd5e1;
          line-height: 1.7;
          margin-bottom: 1.5rem;
          font-size: 1.05rem;
        }

        .nav-launch-btn {
          display: inline-block;
          background: #38bdf8;
          color: #020617;
          font-weight: 800;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          margin-top: 1rem;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(56, 189, 248, 0.4);
        }

        .nav-launch-btn:hover {
          transform: translateY(-2px);
          background: #7dd3fc;
        }

        .navigator-visual {
          width: 100%;
          height: 300px;
          background: #020617;
          border: 1px solid #1e293b;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }

        .mock-scanner {
          color: #64748b;
          font-family: 'ui-monospace', monospace;
          font-weight: 700;
          letter-spacing: 0.1em;
          z-index: 2;
        }

        .scan-line {
          position: absolute;
          top: 0; left: 0; width: 100%; height: 2px;
          background: rgba(56, 189, 248, 0.6);
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.8);
          animation: scan 3s linear infinite;
        }

        /* --- SERVICES --- */
        .services-section {
          margin-bottom: 6rem;
        }

        .services-title {
          text-align: center;
          font-size: 2.2rem;
          font-weight: 800;
          margin-bottom: 3.5rem;
        }

        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          max-width: 1200px;
          margin: auto;
        }

        .service-card {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 16px;
          padding: 2.5rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .service-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          border-color: #334155;
        }

        .service-icon {
          font-size: 2.5rem;
          margin-bottom: 1.5rem;
          background: rgba(37, 99, 235, 0.1);
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 1px solid rgba(37, 99, 235, 0.2);
        }

        .service-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: #e2e8f0;
        }

        .service-desc {
          color: #94a3b8;
          font-size: 0.95rem;
          line-height: 1.6;
        }

        /* --- VALUES --- */
        .values-section {
          margin-bottom: 6rem;
        }

        .values-section h2 {
          text-align: center;
          margin-bottom: 3.5rem;
          font-size: 2.2rem;
          font-weight: 800;
        }

        .values-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 2rem;
          max-width: 1000px;
          margin: auto;
        }

        .value-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          padding: 2.5rem;
          border-radius: 16px;
        }

        .value-card h3 {
          color: #38bdf8;
          margin-bottom: 1rem;
          margin-top: 0;
          font-size: 1.2rem;
          font-weight: 700;
        }

        .value-card p {
          color: #94a3b8;
          line-height: 1.6;
          margin: 0;
        }

        /* --- CTA --- */
        .cta-section {
          text-align: center;
          padding: 4rem 2rem;
          background: linear-gradient(180deg, transparent 0%, rgba(37, 99, 235, 0.05) 100%);
          border-radius: 24px;
          border: 1px solid rgba(37, 99, 235, 0.1);
          max-width: 1000px;
          margin: auto;
        }

        .cta-section h2 {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 1rem;
          margin-top: 0;
        }

        .cta-section p {
          color: #94a3b8;
          margin-bottom: 2.5rem;
          font-size: 1.1rem;
        }

        .primary-btn {
          display: inline-block;
          background: #2563eb;
          padding: 14px 36px;
          border-radius: 999px;
          font-weight: 700;
          color: white;
          text-decoration: none;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }

        .primary-btn:hover {
          background: #1d4ed8;
          transform: translateY(-2px);
        }

        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .navigator-showcase {
            grid-template-columns: 1fr;
            padding: 3rem 2rem;
          }
          .navigator-visual {
            height: 250px;
          }
        }

        @media (max-width: 600px) {
          .hero-title { font-size: 2.5rem; }
          .highlight-box { padding: 2rem; }
          .page-container { padding: 3rem 1.25rem; }
        }

      `}</style>
    </div>
  );
}