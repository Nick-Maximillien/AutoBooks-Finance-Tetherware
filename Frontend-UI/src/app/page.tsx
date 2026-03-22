"use client"
import { Suspense } from 'react';
import ShopperLoginToggle from './components/ShopperLoginToggle';
import HomeImage from './components/HomeImage';
import ShopperSignupToggle from './components/ShopperSignupToggle';
import OnWhatsappToggle from './components/OnWhatsappToggle';

const Home = () => {
  return (
    <>
      <section className="heroSection">
        <div className="heroContent">
          <div className="heroLeft">
            <h1 className="dashboardHeadin"><b>AutoBooks Finance</b></h1>
            <h3 className="homeHeader1">AI-Powered Accounting & Business Copilot</h3>
            <Suspense fallback={<p>Loading...</p>}>
              <ShopperLoginToggle />
            </Suspense>
            <Suspense fallback={<p>Loading...</p>}>
              <ShopperSignupToggle />
            </Suspense>
            <Suspense fallback={<p>Loading...</p>}>
              <OnWhatsappToggle />
            </Suspense>

            <h3 className="homeHeader2" style={{"fontWeight": "bold"}}>
              IFRS for SMEs Precision • Automated Document Engine • Personalized Guidance
            </h3>
          </div>

          <div className="heroRight">
            <div className="homeComponents">
              
            </div>
            <div className="homeComponents">
              <Suspense fallback={<p>Loading...</p>}>
                <HomeImage />
              </Suspense>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: "Inter", "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(135deg, #0d1117, #1e2229);
          color: #eaeaea;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .heroSection {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .heroContent {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          max-width: 1200px;
          width: 100%;
          padding: 2px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          text-align: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          animation: fadeIn 0.7s ease-out;
        }

        .dashboardHeadin {
          font-size: 2.5rem;
          background: linear-gradient(90deg, #00d4ff, #8a2be2);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: 1px;
          margin-bottom: 0.5rem;
          padding: 10px;
        }

        .homeHeader1 {
          font-size: 1.1rem;
          font-weight: 300;
          opacity: 0.9;
          padding: 10px;
        }

        .homeHeader2 {
          font-size: 0.95rem;
          font-weight: 300;
          opacity: 0.8;
          margin-top: 1rem;
        }

        .homeComponents {
          display: flex;
          justify-content: center;
          padding: 2px;
        }

        button,
        .toggle,
        .cta {
          background: linear-gradient(90deg, #8a2be2, #00d4ff);
          color: #fff;
          padding: 0.75rem 1.5rem;
          margin: 0.4rem 0;
          border: none;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.2s ease, background 0.3s ease;
        }

        button:hover,
        .toggle:hover,
        .cta:hover {
          transform: translateY(-2px);
          background: linear-gradient(90deg, #00d4ff, #8a2be2);
        }

        @media (min-width: 768px) {
          .heroContent {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            text-align: left;
          }

          .heroLeft, .heroRight {
            flex: 1;
            padding: 5px;
          }

          .dashboardHeading {
            font-size: 3rem;
          }

          .homeComponents {
            justify-content: flex-start;
          }
        }

        @media (max-width: 480px) {
          .dashboardHeading {
            font-size: 2rem;
          }

          button,
          .toggle,
          .cta {
            width: 100%;
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(25px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
};

export default Home;
