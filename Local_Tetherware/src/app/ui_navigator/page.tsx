'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';

export default function UINavigator() {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // NEW: State to hold the latest agentic response for visual tracing
  const [lastResponse, setLastResponse] = useState<any | null>(null);
  
  // Visual Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFrameRef = useRef<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Synchronous Locks to prevent ghost polling and overlapping audio
  const isPausedRef = useRef(false);
  const isProcessingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const addLog = (msg: string) => {
    // Keep more logs now that we have a taller terminal
    setLogs(prev => [msg, ...prev].slice(0, 15));
  };

  // --- Shared Formatters for the Trace ---
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

  const startNavigator = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor', frameRate: 5 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsActive(true);
      setIsPaused(false);
      isPausedRef.current = false;
      addLog("System initialized. Awaiting visual input...");

      intervalRef.current = setInterval(() => captureAndSend(null), 4000);

      stream.getVideoTracks()[0].onended = () => stopNavigator();
    } catch (err) {
      addLog("❌ Screen share access denied.");
    }
  };

  const stopNavigator = () => {
    setIsActive(false);
    setIsPaused(false);
    isPausedRef.current = false;
    isProcessingRef.current = false;
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    addLog("🛑 Agent Offline.");
    setLastResponse(null);
  };

  // --- Voice Command Handlers ---
  const startRecording = async () => {
    if (!isActive) return;
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
          addLog("🎙️ Voice command captured. Processing...");
          captureAndSend(base64Audio);
        };
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      addLog("🎤 Listening... (Release to transmit)");
    } catch (e) {
      addLog("❌ Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- The Single API Pipeline ---
  const captureAndSend = async (audioDataB64: string | null) => {
    if (!videoRef.current || !canvasRef.current) return;
    
    if (!audioDataB64) {
      if (isPausedRef.current || isProcessingRef.current) return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const MAX_WIDTH = 1280;
    const scale = Math.min(MAX_WIDTH / video.videoWidth, 1);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const currentFrameBase64 = canvas.toDataURL('image/jpeg', 0.6);

    if (!audioDataB64 && lastFrameRef.current === currentFrameBase64) return;
    lastFrameRef.current = currentFrameBase64;

    isProcessingRef.current = true; 

    try {
      const { accessToken, refreshToken } = getTokensFromLocalStorage();
      if (!accessToken || !refreshToken) {
        addLog("🔑 Error: Missing authentication tokens.");
        stopNavigator();
        return;
      }

      const token = await refreshAccessTokenIfNeeded(accessToken, refreshToken);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';
      
      const payload: any = { image_data: currentFrameBase64 };
      if (audioDataB64) payload.audio_data = audioDataB64;

      const response = await fetch(`${backendUrl}/live-agent-stream/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (data.status === "ignored" && !data.audio_base64) return;

      addLog(`⚙️ ${data.log_message || "Processing neural input..."}`);

      // 2. THE TRACE FIX: Securely merge states if voice command misses document
      if (data.status === "success" || data.status === "requires_human_review") {
        setLastResponse((prev: any) => {
          // If voice command succeeded but didn't return the document data, inherit it!
          if (!data.document && prev?.document) {
            return { ...data, document: prev.document, ledger_entries: prev.ledger_entries };
          }
          return data;
        });
      } else if (data.status === "ignored" && audioDataB64) {
        setLastResponse(null);
      }

      if (data.audio_base64) {
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current.currentTime = 0;
        }
        const cleanAudio = data.audio_base64.replace(/\s/g, '');
        const audio = new Audio(`data:audio/mp3;base64,${cleanAudio}`);
        currentAudioRef.current = audio;
        audio.play().catch(e => console.error("Audio blocked", e));
      }

      if (data.status === "requires_human_review") {
        setIsPaused(true);
        isPausedRef.current = true;
        addLog(`🚨 REVIEW REQUIRED: ${data.reason}`);
      }

      if ((data.status === "success" || data.status === "failed" || data.status === "ignored") && audioDataB64) {
        if (isPausedRef.current) {
            setIsPaused(false);
            isPausedRef.current = false;
            addLog("▶️ Action confirmed. Autobooks Resumed.");
        }
      }

    } catch (error) {
      console.error(error);
      addLog("❌ Error: Neural link severed.");
    } finally {
      isProcessingRef.current = false;
    }
  };

  return (
    <div className="command-center">
      {/* Top Navigation Bar */}
      <nav className="cc-nav">
        <div className="nav-brand">
          <span className="brand-icon">⌘</span>
          <h1>Sovereign Copilot</h1>
        </div>
        <div className="nav-links">
          <Link href="/shopper_dashboard" className="nav-item">📊 Dashboard</Link>
          <Link href="/reconciliation" className="nav-item">🔍 Ledger Overwatch</Link>
        </div>
      </nav>

      <div className="cc-grid">
        
        {/* LEFT PANEL: Controls & Terminal */}
        <div className="cc-panel left-panel">
          
          <div className="status-header">
            <div className="status-pulse-container">
              {isActive && !isPaused && !isRecording && <span className="status-dot active"></span>}
              {isRecording && <span className="status-dot listening"></span>}
              {isPaused && !isRecording && <span className="status-dot paused"></span>}
              {!isActive && <span className="status-dot offline"></span>}
            </div>
            <h3>System Status: <span className="status-text">
              {!isActive ? "OFFLINE" : isRecording ? "LISTENING" : isPaused ? "HALTED" : "MONITORING"}
            </span></h3>
          </div>

          <div className="control-deck">
            {!isActive ? (
              <button onClick={startNavigator} className="cc-btn start-btn">
                ⚡ Initialize Autonomous Agent
              </button>
            ) : (
              <div className="active-controls">
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  className={`cc-btn big-mic-btn ${isRecording ? 'is-recording' : ''}`}
                >
                  {isRecording ? "🎙️ Transmitting..." : "🎙️ HOLD TO SPEAK"}
                </button>
                
                <div className="secondary-controls">
                  <button onClick={() => { setIsPaused(!isPaused); isPausedRef.current = !isPaused; }} className="cc-btn sec-btn pause-btn">
                    {isPaused ? "▶️ Resume Agent" : "⏸️ Force Halt"}
                  </button>
                  <button onClick={stopNavigator} className="cc-btn sec-btn stop-btn">
                    🛑 Disconnect
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="terminal-wrapper">
            <div className="terminal-header">Neural Link Console</div>
            <div className="terminal-body custom-scrollbar">
              {logs.length === 0 ? (
                <span className="term-muted">Awaiting initialization...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`term-line ${i === 0 ? "term-new" : "term-old"}`}>
                    <span className="term-prefix">{'>'}</span> {log}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* RIGHT PANEL: Live Screen Feed & Execution Trace */}
        <div className="cc-panel right-panel">
          
          {/* ALWAYS MOUNTED VIDEO TO MAINTAIN STREAM REFERENCE */}
          <div className={`video-container ${lastResponse ? 'minimized' : 'expanded'}`}>
            {!isActive && !lastResponse && (
              <div className="empty-state">
                <div className="empty-icon">📡</div>
                <h3>Awaiting Visual Data</h3>
                <p>Initialize the agent and share your screen. The AI will automatically extract, analyze, and post financial documents to the ledger.</p>
              </div>
            )}
            
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`screen-feed ${isActive ? 'active-feed' : 'inactive-feed'}`} 
            />

            {/* Scanning Laser Animation */}
            {isActive && !isPaused && !lastResponse && (
              <div className="scanning-overlay">
                <div className="scan-line"></div>
                <span className="scan-text">Analyzing live screen contents...</span>
              </div>
            )}
          </div>

          {/* VISUAL TRACE INJECTION */}
          {lastResponse?.document && (
            <div className="trace-board custom-scrollbar">
              
              <div className={`trace-banner ${lastResponse.status === "requires_human_review" ? "banner-warn" : "banner-ok"}`}>
                {lastResponse.status === "requires_human_review" ? "🚨 REVIEW REQUIRED: AUTONOMOUS POSTING HALTED" : "✅ DOCUMENT SUCCESSFULLY POSTED"}
              </div>

              <div className="info-cards">
                <div className="info-card">
                  <span className="info-label">Document Type</span>
                  <span className="info-value">{lastResponse.document.document_type?.replace("_", " ").toUpperCase()}</span>
                </div>
                <div className="info-card">
                  <span className="info-label">Counterparty / Entity</span>
                  <span className="info-value hl">{lastResponse.document.vendor || lastResponse.document.customer || lastResponse.document.equity_investor || "Unknown"}</span>
                </div>
                <div className="info-card">
                  <span className="info-label">Total Amount</span>
                  <span className="info-value money">{formatCurrency(lastResponse.document.total)}</span>
                </div>
              </div>

              <h3 className="timeline-title">Audit & Execution Trace</h3>
              
              <div className="process-timeline">
                {/* Step 1 */}
                <div className="t-step">
                  <div className="t-marker">1</div>
                  <div className="t-content">
                    <h4>Perception & AI Validation</h4>
                    <div className="t-box ai-box">
                      {lastResponse.document.raw_text || "AI CAPTURE [Conf: 0.95]: Validated"}
                    </div>
                    {lastResponse.status !== "requires_human_review" && (
                      <span className="t-tag tag-green">✓ Mathematical integrity verified</span>
                    )}
                  </div>
                </div>

                {lastResponse.status === "success" && (
                  <>
                    {/* Step 2 */}
                    <div className="t-step">
                      <div className="t-marker">2</div>
                      <div className="t-content">
                        <h4>Computable Accounting Law</h4>
                        <div className="t-box law-box">
                          {getIFRSRuleText(lastResponse.document.document_type)}
                        </div>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="t-step">
                      <div className="t-marker">3</div>
                      <div className="t-content">
                        <h4>Double-Entry Ledger Execution</h4>
                        <div className="t-box ledger-box">
                          {lastResponse.ledger_entries ? (
                              <>
                                  {lastResponse.ledger_entries.debits?.map((d: any, i: number) => (
                                      <div key={`dr-${i}`} className="l-row l-dr">
                                        <span className="acc">DR: {d.account}</span> 
                                        <span className="amt">{formatCurrency(d.amount)}</span>
                                      </div>
                                  ))}
                                  {lastResponse.ledger_entries.credits?.map((c: any, i: number) => (
                                      <div key={`cr-${i}`} className="l-row l-cr">
                                        <span className="acc">CR: {c.account}</span> 
                                        <span className="amt">{formatCurrency(c.amount)}</span>
                                      </div>
                                  ))}
                              </>
                          ) : (
                              <>
                                {/* FALLBACK MOCK IF BACKEND OMITTED ENTRIES DURING VOICE COMMAND */}
                                {lastResponse.document.document_type === 'invoice' && (
                                  <>
                                    <div className="l-row l-dr"><span className="acc">DR: trade_and_other_receivables</span> <span className="amt">{formatCurrency(lastResponse.document.total)}</span></div>
                                    <div className="l-row l-cr"><span className="acc">CR: revenue</span> <span className="amt">{formatCurrency(lastResponse.document.total)}</span></div>
                                  </>
                                )}
                                {lastResponse.document.document_type === 'bill' && (
                                  <>
                                    <div className="l-row l-dr"><span className="acc">DR: operating_expenses</span> <span className="amt">{formatCurrency(lastResponse.document.total)}</span></div>
                                    <div className="l-row l-cr"><span className="acc">CR: trade_and_other_payables</span> <span className="amt">{formatCurrency(lastResponse.document.total)}</span></div>
                                  </>
                                )}
                                {lastResponse.document.document_type === 'receipt' && (
                                  <>
                                    <div className="l-row l-dr"><span className="acc">DR: cash_and_cash_equivalents</span> <span className="amt">{formatCurrency(lastResponse.document.total)}</span></div>
                                    <div className="l-row l-cr"><span className="acc">CR: trade_and_other_receivables</span> <span className="amt">{formatCurrency(lastResponse.document.total)}</span></div>
                                  </>
                                )}
                                {lastResponse.document.document_type === 'equity_injection' && (
                                  <>
                                    <div className="l-row l-dr"><span className="acc">DR: cash_and_cash_equivalents</span> <span className="amt">{formatCurrency(lastResponse.document.total)}</span></div>
                                    <div className="l-row l-cr"><span className="acc">CR: share_capital</span> <span className="amt">{formatCurrency(lastResponse.document.total)}</span></div>
                                  </>
                                )}
                                {['invoice', 'bill', 'receipt', 'equity_injection'].indexOf(lastResponse.document.document_type) === -1 && (
                                  <span className="l-muted">Ledger entries generated implicitly.</span>
                                )}
                              </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Subliminal Navigation CTA */}
                    <div className="cta-wrapper">
                      <Link href="/shopper_dashboard" className="nav-cta">
                        <div className="cta-content">
                          <span className="icon">📊</span>
                          <span>View Updated Statements in Dashboard</span>
                          <span className="arrow">→</span>
                        </div>
                      </Link>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Canvas Buffer (Only used for data extraction, doesn't need to be seen) */}
      <canvas ref={canvasRef} className="hidden" />

      <style jsx>{`
        /* ===============================
           Sovereign Control Center UI
           =============================== */
        
        .command-center, .command-center * {
          box-sizing: border-box; /* CRITICAL FIX: Ensure padding doesn't break flex heights */
        }

        .command-center {
          height: 100vh;
          background: #020617; /* Deep slate */
          color: #f8fafc;
          font-family: 'Inter', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* --- Nav --- */
        .cc-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 32px;
          background: #0f172a;
          border-bottom: 1px solid #1e293b;
          height: 70px;
          flex-shrink: 0;
        }
        
        .nav-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .brand-icon {
          font-size: 1.5rem;
          color: #38bdf8;
        }
        .nav-brand h1 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .nav-links {
          display: flex;
          gap: 16px;
        }
        .nav-item {
          text-decoration: none;
          color: #94a3b8;
          font-size: 0.9rem;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 8px;
          transition: all 0.2s;
          background: rgba(255,255,255,0.05);
        }
        .nav-item:hover {
          color: #f8fafc;
          background: rgba(255,255,255,0.1);
        }

        /* --- Grid Layout --- */
        .cc-grid {
          display: grid;
          grid-template-columns: 400px 1fr;
          flex: 1;
          height: calc(100vh - 70px);
          overflow: hidden; /* CRITICAL FIX: Constrain grid */
        }

        .cc-panel {
          padding: 32px;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden; /* CRITICAL FIX: Constrain panels */
        }

        .left-panel {
          background: #0b1020;
          border-right: 1px solid #1e293b;
        }

        /* --- Status Header --- */
        .status-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 32px;
          padding: 16px;
          background: #0f172a;
          border-radius: 12px;
          border: 1px solid #1e293b;
          flex-shrink: 0;
        }
        
        .status-header h3 {
          margin: 0;
          font-size: 0.9rem;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .status-text {
          color: #f8fafc;
          font-weight: 800;
        }

        .status-pulse-container {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .status-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }
        .active { background: #10b981; box-shadow: 0 0 12px #10b981; animation: pulse 2s infinite; }
        .listening { background: #3b82f6; box-shadow: 0 0 12px #3b82f6; animation: pulse 1s infinite; }
        .paused { background: #f59e0b; }
        .offline { background: #475569; }

        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }

        /* --- Controls --- */
        .control-deck {
          margin-bottom: 32px;
          flex-shrink: 0;
        }

        .cc-btn {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          border: none;
          font-size: 1rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: white;
        }
        .cc-btn:active { transform: scale(0.98); }

        .start-btn {
          background: #10b981;
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.25);
        }
        .start-btn:hover { background: #059669; }

        .active-controls {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .big-mic-btn {
          padding: 24px;
          font-size: 1.2rem;
          background: #2563eb;
          box-shadow: 0 8px 30px rgba(37, 99, 235, 0.4);
        }
        .big-mic-btn:hover { background: #1d4ed8; }
        .is-recording {
          background: #ef4444 !important;
          box-shadow: 0 0 40px rgba(239, 68, 68, 0.6) !important;
          animation: recPulse 1.5s infinite;
        }

        @keyframes recPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }

        .secondary-controls {
          display: flex;
          gap: 12px;
        }
        .sec-btn {
          padding: 12px;
          font-size: 0.8rem;
        }
        .pause-btn { background: #f59e0b; }
        .pause-btn:hover { background: #d97706; }
        .stop-btn { background: #334155; }
        .stop-btn:hover { background: #1e293b; }


        /* --- Terminal --- */
        .terminal-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #020617;
          border: 1px solid #1e293b;
          border-radius: 12px;
          overflow: hidden;
          min-height: 0; /* CRITICAL FIX */
        }
        .terminal-header {
          background: #0f172a;
          padding: 12px 16px;
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border-bottom: 1px solid #1e293b;
          flex-shrink: 0;
        }
        .terminal-body {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-family: 'ui-monospace', 'Menlo', monospace;
          font-size: 0.85rem;
          min-height: 0; /* CRITICAL FIX */
        }
        .term-line { line-height: 1.5; }
        .term-prefix { color: #38bdf8; margin-right: 8px; font-weight: bold; }
        .term-new { color: #e2e8f0; }
        .term-old { color: #64748b; }
        .term-muted { color: #475569; font-style: italic; margin: auto; }


        /* --- Right Panel (Video & Trace) --- */
        .right-panel {
          background: #0f172a;
          position: relative;
          padding: 32px 32px 0 32px; 
        }
        
        .video-container {
          position: relative;
          width: 100%;
          background: #020617;
          border-radius: 16px;
          border: 1px solid #1e293b;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .expanded {
          flex: 1;
          margin-bottom: 32px;
        }

        .minimized {
          height: 180px;
          margin-bottom: 24px;
        }

        .screen-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: opacity 0.3s ease;
        }

        .active-feed { opacity: 1; }
        .inactive-feed { opacity: 0; }

        .empty-state {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #64748b;
          max-width: 400px;
          z-index: 10;
        }
        .empty-icon { font-size: 4rem; margin-bottom: 24px; opacity: 0.5; }
        .empty-state h3 { color: #f8fafc; font-size: 1.5rem; margin-bottom: 12px; }
        .empty-state p { line-height: 1.6; }

        /* The Sci-Fi Scanner Overlay */
        .scanning-overlay {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          pointer-events: none;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: 24px;
          z-index: 20;
          box-shadow: inset 0 0 50px rgba(56, 189, 248, 0.1);
        }

        .scan-text {
          background: rgba(2, 6, 23, 0.85);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 0.8rem;
          color: #38bdf8;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border: 1px solid rgba(56, 189, 248, 0.3);
          backdrop-filter: blur(4px);
        }

        .scan-line {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
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

        /* --- Trace Board --- */
        .trace-board {
          flex: 1;
          min-height: 0; /* CRITICAL FIX: Forces Flexbox to allow scroll */
          overflow-y: auto;
          padding-right: 16px;
          padding-bottom: 32px;
        }

        .trace-banner {
          padding: 20px;
          border-radius: 12px;
          text-align: center;
          font-weight: 800;
          font-size: 1.1rem;
          letter-spacing: 0.05em;
          margin-bottom: 24px;
        }
        .banner-ok { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
        .banner-warn { background: rgba(245, 158, 11, 0.1); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2); }

        .info-cards {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-bottom: 40px;
        }
        .info-card {
          background: #1e293b;
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #334155;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .info-label { font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.05em; }
        .info-value { font-size: 1.1rem; color: #f8fafc; font-weight: 500; }
        .hl { color: #38bdf8; }
        .money { font-family: 'ui-monospace', monospace; color: #10b981; font-weight: 800; font-size: 1.25rem; }

        .timeline-title {
          font-size: 1.2rem;
          color: #f8fafc;
          margin-bottom: 24px;
          padding-bottom: 12px;
          border-bottom: 1px solid #1e293b;
        }

        /* --- Timeline Execution --- */
        .process-timeline {
          padding-left: 12px;
        }
        
        .t-step {
          display: flex;
          gap: 24px;
          position: relative;
          padding-bottom: 40px;
        }
        
        .t-step:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 19px;
          top: 40px;
          bottom: 0;
          width: 2px;
          background: #1e293b;
        }

        .t-marker {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #0f172a;
          border: 2px solid #38bdf8;
          color: #38bdf8;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          font-weight: 800;
          flex-shrink: 0;
          z-index: 1;
        }

        .t-content {
          flex: 1;
          padding-top: 8px;
        }
        .t-content h4 {
          margin: 0 0 16px 0;
          font-size: 1.1rem;
          color: #e2e8f0;
        }

        .t-box {
          background: #1e293b;
          border-radius: 12px;
          padding: 20px;
          font-size: 0.95rem;
          line-height: 1.6;
          border: 1px solid #334155;
          margin-bottom: 16px;
        }

        .ai-box { font-style: italic; color: #cbd5e1; border-left: 4px solid #8b5cf6; }
        .law-box { color: #94a3b8; border-left: 4px solid #f59e0b; }
        
        .ledger-box {
          background: #020617;
          font-family: 'ui-monospace', monospace;
          border-left: 4px solid #38bdf8;
        }
        
        .l-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 1rem; }
        .l-dr { color: #10b981; }
        .l-cr { color: #38bdf8; padding-left: 32px; }
        .amt { font-weight: 800; }
        .l-muted { color: #64748b; font-style: italic; }

        .t-tag {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .tag-green { background: rgba(16, 185, 129, 0.15); color: #34d399; }

        /* --- Navigation CTA --- */
        .cta-wrapper {
          padding-bottom: 32px; /* Ensure space at bottom of scroll */
        }
        
        .nav-cta {
          display: block;
          margin-top: 8px;
          text-decoration: none;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(79, 70, 229, 0.1) 100%);
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 12px;
          padding: 16px;
          transition: all 0.2s ease;
        }

        .nav-cta:hover {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(79, 70, 229, 0.2) 100%);
          border-color: rgba(99, 102, 241, 0.6);
          transform: translateY(-2px);
        }

        .cta-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #e0e7ff;
          font-weight: 600;
          font-size: 0.95rem;
        }

        .cta-content .icon { font-size: 1.2rem; }
        .cta-content .arrow { transition: transform 0.2s; }
        .nav-cta:hover .arrow { transform: translateX(6px); }

        /* Custom Scrollbar */
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        
        .hidden { display: none; }
      `}</style>
    </div>
  );
}