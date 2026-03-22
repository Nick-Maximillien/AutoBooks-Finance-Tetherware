'use client';

import { useState } from 'react';
import ShopperSignup from './ShopperSignup';

export default function ShopperSignupToggle() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSignup = () => setIsOpen((prev) => !prev);

  return (
    <div className="signup-portal">
      <button className="signup-toggle" onClick={toggleSignup}>
        {isOpen ? '✕ Close Signup' : '🛍️ Signup as a Business'}
      </button>

      {isOpen && (
        <div className="signup-card">
          <ShopperSignup />
        </div>
      )}

      <style jsx>{`
        /* Main Container */
        .signup-portal {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          margin: 1.5rem 0;
          font-family: 'Inter', sans-serif;
        }

        /* Toggle Button */
        .signup-toggle {
          background: linear-gradient(90deg, #00b09b, #96c93d);
          color: #fff;
          border: none;
          border-radius: 12px;
          padding: 0.9rem 1.8rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
          transition: all 0.3s ease;
          letter-spacing: 0.3px;
        }

        .signup-toggle:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
          background: linear-gradient(90deg, #96c93d, #00b09b);
        }

        /* Signup Card */
        .signup-card {
          margin-top: 1.5rem;
          width: 100%;
          max-width: 500px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
          padding: 2rem;
          animation: fadeIn 0.4s ease;
        }

        /* Fade-in animation */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Responsive Design */
        @media (max-width: 480px) {
          .signup-card {
            width: 90%;
            padding: 1.2rem;
          }

          .signup-toggle {
            width: 90%;
            padding: 0.8rem 1rem;
            font-size: 0.95rem;
          }
        }
      `}</style>
    </div>
  );
}
