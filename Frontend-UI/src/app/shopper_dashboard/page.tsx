'use client';

import { useState } from 'react';
import { useAuth } from 'context/AuthContext';
import FarmerProfile from 'app/components/FarmerProfile';
import CreateProfileToggle from 'app/components/CreateProfileToggle';
import Link from 'next/link';
import OnWhatsappToggle from 'app/components/OnWhatsappToggle';
import Uploader from 'app/components/AutoBooks';
import BalanceSheetComponent from 'app/components/FinancialPosition';
import PNLComponent from 'app/components/PNL';
import Analytics from 'app/components/Analytics';
import JournalComponent from 'app/components/Journal';
import PeriodControl from 'app/components/PeriodControl';
import ExportFinancialsButton from 'app/components/ExportFinancialsButton';
import WalletBadge from 'app/components/WalletBadge';

export default function ShopperDashboard() {
  const { accessToken } = useAuth();
  
  // State to track if the ledger has been backed up
  const [hasExported, setHasExported] = useState(false);

  if (!accessToken) {
    return (
      <div className="dashboardGuest">
        <p className="signupRedirect">
          <Link className="links" href="/shopper_login">
            Signup or login for AI shopping assistance
          </Link>
        </p>

        <style jsx>{`
          .dashboardGuest {
            min-height: 80vh;
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Inter', sans-serif;
            background: #f5f6fa;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="dashboardContainer">

      <h2 className="dashboardHeading">📊 Business Dashboard</h2>

      {/* === App Navigation Strip === */}
      <div className="app-nav">
        <Link href="/reconciliation" className="nav-pill">
          Ledger Overwatch (Audit)
        </Link>
      </div>

      {/* === Toolbox Strip === */}
      <section className="toolbox-strip">
        <div className="toolbox-left">
          <FarmerProfile />
          <div className="divider"></div>
          <CreateProfileToggle />
          <Uploader />
          <div className="divider"></div>
          {/* ---> 2. Inject WalletBadge Here <--- */}
          <WalletBadge /> 
        </div>

        <div className="toolbox-right">
          <OnWhatsappToggle />
        </div>
      </section>

      {/* === Financial Core === */}
      <section className="financialGrid">
        <div className="financialCard">
          <BalanceSheetComponent />
        </div>

        <div className="financialCard">
          <PNLComponent />
        </div>
      </section>

      {/* --- MANAGEMENT CONTROLS --- */}
      <section className="managementSection">
        <div className="managementWrapper">
          <PeriodControl isExportDone={hasExported} />
          <ExportFinancialsButton onExportSuccess={() => setHasExported(true)} />
        </div>
        
        {/* Security Warning Message */}
        {!hasExported && (
          <p className="exportWarning">
            ⚠️ <strong>Security Lock:</strong> You must download a backup of your ledger before closing the financial period.
          </p>
        )}
      </section>

      {/* --- General Journal --- */}
      <section className="journalSection">
        <JournalComponent />
      </section>

      {/* === Full Analytics Dashboard === */}
      <section className="analyticsSection">
        <Analytics />
      </section>

      <p className="signupRedirect">
        <Link className="homeButton" href="/">
          ← Back Home
        </Link>
      </p>

      <style jsx>{`

        .dashboardContainer {
          padding: 1rem 2rem;
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100vh;
          background: #f8fafc;
          overflow-x: hidden;
        }

        .dashboardHeading {
          text-align: center;
          font-size: 1.75rem;
          margin-bottom: 0.5rem;
          color: #0f172a;
          font-weight: 700;
        }

        /* === Navigation === */
        .app-nav {
          display: flex;
          justify-content: center;
          gap: 12px;
          font-weight: bold;
          margin-bottom: 1.5rem;
        }

        .nav-pill {
          background: #eef2ff;
          color: #4f46e5;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: bold;
          text-decoration: none;
          transition: all 0.2s;
          border: 1px solid #c7d2fe;
        }

        .nav-pill:hover {
          background: #e0e7ff;
          transform: translateY(-1px);
        }

        /* === Toolbox === */
        .toolbox-strip {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
          padding: 0.5rem 1rem;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .toolbox-left,
        .toolbox-right {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .divider {
          width: 1px;
          height: 24px;
          background-color: #cbd5e1;
          margin: 0 0.25rem;
        }

        /* === Financial Grid === */
        .financialGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          width: 100%;
        }

        .financialCard {
          width: 100%;
          min-width: 0;
        }

        /* === Management Controls === */
        .managementSection {
          margin-top: 2rem;
          width: 100%;
        }
        
        .managementWrapper {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .exportWarning {
          text-align: right;
          color: #b45309;
          font-size: 0.85rem;
          margin-top: 0.5rem;
          margin-right: 0.5rem;
        }

        /* === Journal Section === */
        .journalSection {
          margin-top: 2rem;
          width: 100%;
        }

        /* === Analytics Section === */
        .analyticsSection {
          margin-top: 2rem;
          width: 100%;
        }

        .signupRedirect {
          text-align: center;
          margin-top: 3rem;
          margin-bottom: 2rem;
        }

        .homeButton {
          display: inline-block;
          padding: 10px 18px;
          background: #4f46e5;
          color: white;
          font-weight: 600;
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.25s ease;
        }

        .homeButton:hover {
          background: #4338ca;
          transform: translateY(-1px);
          box-shadow: 0 6px 14px rgba(79,70,229,0.25);
        }

        .links {
          color: #4f46e5;
          text-decoration: none;
          font-weight: 600;
        }

        .links:hover {
          text-decoration: underline;
        }

        /* === Responsive === */
        @media (max-width: 1024px) {
          .financialGrid {
            grid-template-columns: 1fr;
          }
          .toolbox-strip {
            justify-content: center;
          }
          .toolbox-left {
            justify-content: center;
          }
          .divider {
            display: none;
          }
          .managementWrapper {
            flex-direction: column;
            align-items: stretch;
          }
        }

      `}</style>
    </div>
  );
}