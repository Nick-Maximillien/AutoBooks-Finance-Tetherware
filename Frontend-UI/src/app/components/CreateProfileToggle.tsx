"use client";

import { useState } from "react";
import CreateProfile from "./CreateProfile";

export default function CreateProfileToggle() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className="tool-btn" onClick={() => setIsOpen(true)} title="Create Profile">
         New Profile
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Business Profile</h3>
              <button className="close-btn" onClick={() => setIsOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <CreateProfile />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .tool-btn {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #0f172a;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .tool-btn:hover {
          background: #f1f5f9;
        }
        
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          backdrop-filter: blur(2px);
        }
        .modal-content {
          background: white;
          width: 90%;
          max-width: 500px;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #f8fafc;
        }
        .modal-header h3 {
          margin: 0;
          font-size: 1rem;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          color: #ef4444;
        }
        .modal-body {
          padding: 20px;
          max-height: 80vh;
          overflow-y: auto;
        }
      `}</style>
    </>
  );
}