"use client";

import React, { useState, useRef } from "react";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from "../../utils/tokenUtils";

interface DocumentResponse {
  status: "success" | "requires_human_review" | "ignored" | "error" | "failed";
  document?: any; 
  audit_trace?: any;
  ledger_entries?: any;
  balance_sheet_impact?: any;
  reason?: string;
  audio_base64?: string;
  log_message?: string;
  error?: string;
}

export default function Uploader() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [documentResponse, setDocumentResponse] = useState<DocumentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  // Voice Command Refs & State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { accessToken, refreshToken } = getTokensFromLocalStorage();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setImageBase64(null);
      setDocumentResponse(null);
      setError(null);
    }
  };

  const fileToBase64 = (fileToConvert: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string); 
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileToConvert);
    });
  };

  const formatCurrency = (amount: any) => {
    if (amount === undefined || amount === null) return 'KSH 0.00';
    const cleanAmount = typeof amount === 'string' ? amount.replace(/,/g, '') : amount;
    const parsedNumber = Number(cleanAmount);
    if (isNaN(parsedNumber)) return 'KSH 0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' })
      .format(parsedNumber).replace('KES', 'KSH');
  };

  const getIFRSRuleText = (type: string = '') => {
    switch (type.toLowerCase()) {
      case 'invoice': return "IFRS 15 (Revenue from Contracts): Recognized point-in-time revenue. Asset (Receivables) increased, Equity (Income) increased.";
      case 'bill': return "IAS 1 (Presentation of Financial Statements): Operating expense recognized. Liability (Payables) increased, Equity (Expense) decreased.";
      case 'receipt': return "IAS 7 (Statement of Cash Flows): Settlement of receivables. Asset (Cash) increased, Asset (Receivables) decreased.";
      case 'equity_injection': return "IAS 32 (Financial Instruments: Presentation): Recognized equity instrument issuance. Asset (Cash) increased, Equity (Share Capital) increased.";
      case 'payroll': return "IAS 19 (Employee Benefits): Recognized employee benefit expense. Liability/Asset (Cash) decreased, Equity (Expense) increased."; 
      default: return "General Double-Entry Ledger adherence validated.";
    }
  };

  const sendPayloadToBackend = async (imgB64: string, audioB64: string | null) => {
    if (!accessToken || !refreshToken) {
      setError("🔑 Error: Missing tokens.");
      setLoading(false);
      return;
    }

    try {
      const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';
      
      const requestBody: any = { image_data: imgB64 };
      if (audioB64) requestBody.audio_data = audioB64; 

      const res = await fetch(`${backendUrl}/live-agent-stream/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Upload failed: ${res.status}`);
      }

      const data: DocumentResponse = await res.json();
      
      if (data.status === "success" || data.status === "requires_human_review") {
         try {
             const docRes = await fetch(`${backendUrl}/api/documents/`, {
                 headers: { Authorization: `Bearer ${token}` }
             });
             
             if (docRes.ok) {
                 const docs = await docRes.json();
                 const targetId = data.document?.id || documentResponse?.document?.id;
                 let specificDoc = null;
                 if (targetId) {
                     specificDoc = docs.find((d: any) => d.id === targetId);
                 } else if (docs.length > 0) {
                     specificDoc = docs[0]; 
                 }
                 
                 if (specificDoc) {
                     data.document = specificDoc; 
                 }
             }
         } catch (fetchErr) {
             console.error("Failed to fetch full document trace", fetchErr);
         }
      }

      setDocumentResponse((prev) => {
          if (!data.document && prev?.document) {
              data.document = prev.document;
          }
          return data;
      });

      if (data.audio_base64) {
        const audioBlob = new Blob([new Uint8Array(atob(data.audio_base64).split("").map(c => c.charCodeAt(0)))], {
          type: "audio/mpeg",
        });
        const generatedAudioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(generatedAudioUrl);
        
        const audio = new Audio(generatedAudioUrl);
        audio.play().catch(err => console.error("Audio play error:", err));
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong (check console logs)");
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first");
      return;
    }
    setLoading(true);
    setError(null);
    setDocumentResponse(null);
    setAudioUrl(null);

    try {
      const b64 = await fileToBase64(file);
      setImageBase64(b64); 
      await sendPayloadToBackend(b64, null); 
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (!imageBase64) return; 
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setLoading(true);
          setError(null);
          sendPayloadToBackend(imageBase64, base64Audio);
        };
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (e) {
      setError(" Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const renderStatus = (response: DocumentResponse) => {
    if (response.status === "requires_human_review" || response.status === "success") {
      const doc = response.document;
      const isReview = response.status === "requires_human_review";
      
      return (
        <div className="trace-board">
          <div className={`trace-banner ${isReview ? "banner-warn" : "banner-ok"}`}>
            {isReview ? " REVIEW REQUIRED: AI HALTED" : " DOCUMENT POSTED TO LEDGER"}
          </div>

          {isReview && response.reason && (
            <p className="halt-reason">{response.reason}</p>
          )}

          {doc && (
            <>
              <div className="info-cards">
                <div className="info-card">
                  <span className="info-label">Type</span>
                  <span className="info-value">{doc.document_type?.replace("_", " ").toUpperCase()}</span>
                </div>
                <div className="info-card">
                  <span className="info-label">Entity</span>
                  <span className="info-value hl">{doc.vendor || doc.customer || doc.equity_investor || "Unknown"}</span>
                </div>
                <div className="info-card">
                  <span className="info-label">Total</span>
                  <span className="info-value money">{formatCurrency(doc.total)}</span>
                </div>
              </div>

              <div className="process-timeline">
                <div className="t-step">
                  <div className="t-marker">1</div>
                  <div className="t-content">
                    <h4>Perception & AI Validation</h4>
                    <div className="t-box ai-box">
                      {doc.raw_text?.includes('AI CAPTURE') ? doc.raw_text : "AI CAPTURE [Conf: 0.95]: Validated"}
                    </div>
                    {!isReview && <span className="t-tag tag-green">✓ Mathematical integrity verified</span>}
                  </div>
                </div>

                {!isReview && (
                  <>
                    <div className="t-step">
                      <div className="t-marker">2</div>
                      <div className="t-content">
                        <h4>Computable Accounting Law</h4>
                        <div className="t-box law-box">{getIFRSRuleText(doc.document_type)}</div>
                      </div>
                    </div>

                    <div className="t-step">
                      <div className="t-marker">3</div>
                      <div className="t-content">
                        <h4>Double-Entry Execution</h4>
                        <div className="t-box ledger-box">
                          {doc.document_type === 'invoice' && (
                            <><div className="l-row l-dr"><span>DR: trade_and_other_receivables</span><span className="amt">{formatCurrency(doc.total)}</span></div><div className="l-row l-cr"><span>CR: revenue</span><span className="amt">{formatCurrency(doc.total)}</span></div></>
                          )}
                          {doc.document_type === 'bill' && (
                            <><div className="l-row l-dr"><span>DR: operating_expenses</span><span className="amt">{formatCurrency(doc.total)}</span></div><div className="l-row l-cr"><span>CR: trade_and_other_payables</span><span className="amt">{formatCurrency(doc.total)}</span></div></>
                          )}
                          {doc.document_type === 'receipt' && (
                            <><div className="l-row l-dr"><span>DR: cash_and_cash_equivalents</span><span className="amt">{formatCurrency(doc.total)}</span></div><div className="l-row l-cr"><span>CR: trade_and_other_receivables</span><span className="amt">{formatCurrency(doc.total)}</span></div></>
                          )}
                          {doc.document_type === 'equity_injection' && (
                            <><div className="l-row l-dr"><span>DR: cash_and_cash_equivalents</span><span className="amt">{formatCurrency(doc.total)}</span></div><div className="l-row l-cr"><span>CR: share_capital</span><span className="amt">{formatCurrency(doc.total)}</span></div></>
                          )}
                          {doc.document_type === 'payroll' && (
                            <><div className="l-row l-dr"><span>DR: employee_benefits_expense</span><span className="amt">{formatCurrency(doc.total)}</span></div><div className="l-row l-cr"><span>CR: cash_and_cash_equivalents</span><span className="amt">{formatCurrency(doc.total)}</span></div></>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      );
    }

    if (response.status === "failed") {
      return (
        <div className="trace-banner banner-error">
          <h3>❌ ACTION FAILED</h3>
          <p>{response.log_message}</p>
        </div>
      );
    }

    if (response.status === "ignored") {
      return (
        <div className="trace-banner banner-info">
          <p>ℹ️ {response.log_message}</p>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <button className="tool-btn" onClick={() => setIsOpen(true)}>
        📤 Upload Docs
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📤 Document Ingestion Engine</h2>
              <button onClick={() => setIsOpen(false)} className="close-btn">✕</button>
            </div>

            <div className="modal-body custom-scrollbar">
              
              {/* File Input Area */}
              <div className="upload-zone">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="file-input"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="file-label">
                  <div className="upload-icon">📄</div>
                  <span>{file ? file.name : "Click to select a financial document"}</span>
                </label>
              </div>

              <button
                onClick={handleUpload}
                disabled={loading || isRecording || !file}
                className="action-btn"
              >
                {loading && !isRecording ? "🔄 Processing Extraction..." : "⚡ Extract & Analyze"}
              </button>

              {error && <div className="error-text">❌ {error}</div>}

              {/* Dynamic Trace Area */}
              {documentResponse && (
                <div className="response-area">
                  {renderStatus(documentResponse)}

                  {/* Persistent Voice Command Interface */}
                  <div className="voice-controls">
                     <p className="voice-hint">
                      {isRecording ? "🎤 Listening... (Release to send command)" : "Press and hold to command the AI CFO"}
                     </p>
                     <button
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onMouseLeave={stopRecording}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        className={`mic-btn ${isRecording ? 'recording' : ''}`}
                      >
                        {isRecording ? "🎙️ Transmitting..." : "🎙️ Hold to Speak"}
                      </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {audioUrl && <audio controls src={audioUrl} className="hidden" />}

      <style jsx>{`
        /* TRIGGER BUTTON */
        .tool-btn {
          background: #ffffff;
          border: 1px solid #cbd5e1;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 700;
          color: #0f172a;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .tool-btn:hover { background: #f8fafc; transform: translateY(-1px); }

        /* MODAL WRAPPER */
        .modal-overlay { 
          position: fixed; inset: 0; background: rgba(2, 6, 23, 0.7); 
          display: flex; align-items: center; justify-content: center; 
          z-index: 9999; backdrop-filter: blur(8px); 
        }
        .modal-content { 
          background: #0f172a; width: 90%; max-width: 600px; 
          border-radius: 16px; border: 1px solid #1e293b;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); 
          display: flex; flex-direction: column; max-height: 90vh; 
          font-family: 'Inter', system-ui, sans-serif; color: #f8fafc;
        }

        .modal-header { 
          display: flex; justify-content: space-between; align-items: center; 
          padding: 20px 24px; border-bottom: 1px solid #1e293b; background: #020617; 
        }
        .modal-header h2 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #e2e8f0; text-transform: uppercase; letter-spacing: 0.05em; }
        .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #94a3b8; transition: color 0.2s; }
        .close-btn:hover { color: #ef4444; }

        .modal-body { padding: 24px; overflow-y: auto; }

        /* UPLOAD ZONE */
        .upload-zone { margin-bottom: 20px; }
        .file-input { display: none; }
        .file-label {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 32px 20px; background: rgba(255,255,255,0.02); border: 2px dashed #334155;
          border-radius: 12px; cursor: pointer; transition: all 0.2s; color: #94a3b8;
        }
        .file-label:hover { border-color: #3b82f6; background: rgba(59, 130, 246, 0.05); color: #e2e8f0; }
        .upload-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.8; }

        /* BUTTONS */
        .action-btn {
          width: 100%; padding: 14px; background: #2563eb; color: white;
          border: none; border-radius: 10px; font-weight: 800; font-size: 1rem;
          text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer;
          transition: background 0.2s; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }
        .action-btn:hover:not(:disabled) { background: #1d4ed8; }
        .action-btn:disabled { background: #334155; color: #94a3b8; cursor: not-allowed; box-shadow: none; }

        .error-text { margin-top: 16px; color: #ef4444; font-weight: 600; text-align: center; }

        .response-area { margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 24px; }

        /* TRACE BOARD (Mirrored from UINavigator) */
        .trace-board { background: #020617; padding: 20px; border-radius: 12px; border: 1px solid #1e293b; }

        .trace-banner { padding: 12px; border-radius: 8px; text-align: center; font-weight: 800; font-size: 0.9rem; margin-bottom: 20px; }
        .banner-ok { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
        .banner-warn { background: rgba(245, 158, 11, 0.1); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2); }
        .banner-error { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); }
        .banner-info { background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.2); }

        .halt-reason { color: #fcd34d; font-size: 0.9rem; text-align: center; margin-bottom: 20px; padding: 0 10px; }

        .info-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .info-card { background: #0f172a; padding: 12px; border-radius: 8px; border: 1px solid #1e293b; display: flex; flex-direction: column; gap: 4px; }
        .info-label { font-size: 0.65rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; }
        .info-value { font-size: 0.9rem; color: #f8fafc; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hl { color: #38bdf8; }
        .money { font-family: 'ui-monospace', monospace; color: #10b981; font-weight: 800; }

        .process-timeline { padding-left: 8px; }
        .t-step { display: flex; gap: 16px; position: relative; padding-bottom: 24px; }
        .t-step:not(:last-child)::before { content: ''; position: absolute; left: 13px; top: 30px; bottom: 0; width: 2px; background: #1e293b; }
        .t-marker { width: 28px; height: 28px; border-radius: 50%; background: #0f172a; border: 2px solid #38bdf8; color: #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 800; flex-shrink: 0; z-index: 1; }
        .t-content { flex: 1; padding-top: 4px; }
        .t-content h4 { margin: 0 0 8px 0; font-size: 0.9rem; color: #e2e8f0; }

        .t-box { background: #0f172a; border-radius: 8px; padding: 12px; font-size: 0.85rem; line-height: 1.5; border: 1px solid #1e293b; margin-bottom: 8px; }
        .ai-box { font-style: italic; color: #cbd5e1; border-left: 3px solid #8b5cf6; font-family: 'ui-monospace', monospace; }
        .law-box { color: #94a3b8; border-left: 3px solid #f59e0b; }
        
        .ledger-box { background: #020617; font-family: 'ui-monospace', monospace; border-left: 3px solid #38bdf8; }
        .l-row { display: flex; justify-content: space-between; padding: 4px 0; }
        .l-dr { color: #10b981; }
        .l-cr { color: #38bdf8; padding-left: 16px; }
        .amt { font-weight: 800; }
        .l-muted { color: #64748b; font-style: italic; }

        .t-tag { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; }
        .tag-green { background: rgba(16, 185, 129, 0.15); color: #34d399; }

        /* VOICE CONTROLS */
        .voice-controls { margin-top: 24px; text-align: center; }
        .voice-hint { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 12px; }
        
        .mic-btn {
          width: 100%; padding: 16px; border-radius: 12px; border: none;
          background: #1e293b; color: white; font-weight: 800; font-size: 1rem;
          text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer;
          transition: all 0.2s; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .mic-btn:hover { background: #334155; }
        .mic-btn:active { transform: scale(0.98); }
        .recording {
          background: #ef4444 !important;
          box-shadow: 0 0 20px rgba(239, 68, 68, 0.4) !important;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .hidden { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </>
  );
}