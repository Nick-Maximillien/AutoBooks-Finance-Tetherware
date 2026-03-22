'use client';

import React from 'react';
import Link from 'next/link';

export default function ServicesPage() {
  const services = [
    {
      title: "Autonomous Bookkeeping",
      icon: "⚡",
      description: "Upload PDFs, images, or forward receipts via WhatsApp. Our neural engine automatically extracts line items and enforces strict IFRS double-entry accounting rules instantly."
    },
    {
      title: "Sovereign CFO Copilot",
      icon: "🤖",
      description: "Converse with your financial data via voice or text. Ask complex strategic questions, project cash flow, and get empathetic, data-backed advice in real-time."
    },
    {
      title: "Real-Time Analytics",
      icon: "📊",
      description: "Watch your P&L, Balance Sheet, and Cash Flow statements update the second a transaction is posted. Visualize your growth with dynamic, interactive charts."
    },
    {
      title: "Ledger Overwatch",
      icon: "🛡️",
      description: "Total transparency. Every AI action generates a strict audit trace. Review confidence scores, override AI classifications, and execute compliant journal reversals."
    },
    {
      title: "Omnichannel Ingestion",
      icon: "📱",
      description: "Send a voice note or a photo of an invoice to the WhatsApp AI, or drag-and-drop into the Web Dashboard. The engine processes it seamlessly across all platforms."
    },
    {
      title: "Neurosymbolic Architecture",
      icon: "🧠",
      description: "The AI handles the prose; the hard-coded ledger handles the math. This strict separation guarantees zero hallucinations when it comes to your actual money."
    }
  ];

  return (
    <div className="page-container">
      
      {/* HERO */}
      <div className="hero-section">
        <div className="badge">Platform Capabilities</div>
        <h1 className="hero-title">Intelligent Financial <span>Solutions</span></h1>
        <p className="hero-subtitle">
          We don't just record your past; we compute your future. Discover the full suite of autonomous financial tools powered by AutoBooks AI.
        </p>
      </div>

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

      {/* SERVICES GRID */}
      <div className="services-grid">
        {services.map((service, idx) => (
          <div key={idx} className="service-card">
            <div className="service-icon">{service.icon}</div>
            <h3 className="service-title">{service.title}</h3>
            <p className="service-desc">{service.description}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="cta-section">
        <h2>Ready to automate your ledger?</h2>
        <p>Join the future of financial intelligence today.</p>
        <Link href="/shopper_dashboard" className="primary-btn">
          Go to Dashboard
        </Link>
      </div>

      <style jsx>{`
        .page-container {
          min-height: calc(100vh - 72px);
          background-color: #020617;
          color: #f8fafc;
          font-family: 'Inter', system-ui, sans-serif;
          padding: 4rem 2rem;
        }

        /* --- HERO --- */
        .hero-section {
          text-align: center;
          max-width: 800px;
          margin: 0 auto 5rem;
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
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .hero-title span {
          background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
          font-size: 1.15rem;
          color: #94a3b8;
          line-height: 1.7;
          max-width: 600px;
          margin: 0 auto;
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

        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }

        /* --- SERVICES GRID --- */
        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .service-card {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 16px;
          padding: 2.5rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .service-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 4px;
          background: linear-gradient(90deg, transparent, #38bdf8, transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .service-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 20px rgba(37, 99, 235, 0.1);
          border-color: #334155;
        }

        .service-card:hover::before {
          opacity: 1;
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
          line-height: 1.6;
          font-size: 0.95rem;
        }

        /* --- CTA SECTION --- */
        .cta-section {
          text-align: center;
          margin-top: 6rem;
          padding: 4rem 2rem;
          background: linear-gradient(180deg, transparent 0%, rgba(37, 99, 235, 0.05) 100%);
          border-radius: 24px;
          border: 1px solid rgba(37, 99, 235, 0.1);
          max-width: 1000px;
          margin-left: auto;
          margin-right: auto;
        }

        .cta-section h2 {
          font-size: 2rem;
          font-weight: 800;
          margin-bottom: 1rem;
          margin-top: 0;
        }

        .cta-section p {
          color: #94a3b8;
          margin-bottom: 2rem;
          font-size: 1.1rem;
        }

        .primary-btn {
          display: inline-block;
          background: #2563eb;
          color: white;
          padding: 14px 32px;
          border-radius: 99px;
          font-weight: 700;
          font-size: 1rem;
          text-decoration: none;
          transition: all 0.2s;
          box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
        }

        .primary-btn:hover {
          background: #1d4ed8;
          transform: translateY(-2px);
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

        @media (max-width: 768px) {
          .hero-title { font-size: 2.5rem; }
          .services-grid { grid-template-columns: 1fr; }
          .page-container { padding: 3rem 1.5rem; }
        }
      `}</style>
    </div>
  );
}