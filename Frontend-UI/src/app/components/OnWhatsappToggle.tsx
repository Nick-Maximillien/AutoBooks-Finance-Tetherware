'use client';

import { useState } from 'react';
import DiagnoseOnWhatsapp from './DiagnoseOnWhatsapp';
import Image from 'next/image';

export default function OnWhatsappToggle() {
  const [isOpen, setIsOpen] = useState(false);
  const togglePanel = () => setIsOpen(prev => !prev);

  return (
    <>
      <button className="whatsapp-tool-btn" onClick={togglePanel}>
        <Image src="/images/whatsapp.png" alt="WhatsApp" width={18} height={18} className="wa-icon" />
        <span>AutoBooks AI</span>
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={togglePanel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
             <div className="modal-header">
               <h3 className="flex items-center gap-2">
                 <Image src="/images/whatsapp.png" alt="WA" width={20} height={20}/>
                 Use AutoBooks on WhatsApp
               </h3>
               <button className="close-btn" onClick={togglePanel}>✕</button>
             </div>
             <div className="modal-body">
               <DiagnoseOnWhatsapp />
             </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .whatsapp-tool-btn {
          background: linear-gradient(90deg, #25d366, #128c7e);
          color: white;
          border: none;
          padding: 6px 14px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .whatsapp-tool-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3);
        }
        .wa-icon {
          background: white;
          border-radius: 50%;
          padding: 1px;
        }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(2px);
        }
        .modal-content {
          background: white; width: 90%; max-width: 500px; border-radius: 12px; overflow: hidden;
        }
        .modal-header {
          display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background: #f7fdf9; color: #0d725f;
        }
        .modal-header h3 { margin: 0; font-size: 1rem; display: flex; align-items: center; gap: 8px;}
        .close-btn { background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b; }
        .modal-body { padding: 0; max-height: 80vh; overflow-y: auto; }
      `}</style>
    </>
  );
}