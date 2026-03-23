"use client"

import React, { useState, useRef, useEffect } from "react";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from "@utils/tokenUtils";
import { useRouter } from "next/navigation"; 

interface ChatMessage {
  id: string;
  role: "user" | "copilot";
  text: string;
  metadata?: { type?: "financial_data" | "audit_trace" | "action_required" | "text"; data?: any; };
}

interface PendingDocument {
  id: number; document_type: string; vendor: string; total: number; ai_detected_type?: string;
}

export default function Chat() {
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingDocument, setPendingDocument] = useState<PendingDocument | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); 
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const router = useRouter();
  const { accessToken, refreshToken } = getTokensFromLocalStorage();

  useEffect(() => {
    const stored = localStorage.getItem("autobooks_chat_log");
    if (stored) { try { setChatLog(JSON.parse(stored)); } catch {} }
  }, []);

  useEffect(() => {
    localStorage.setItem("autobooks_chat_log", JSON.stringify(chatLog));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, loading]);

  useEffect(() => {
    if (!isVoiceEnabled && currentAudioRef.current) currentAudioRef.current.pause();
  }, [isVoiceEnabled]);

  const parseAgentResponse = (response: string): ChatMessage["metadata"] => {
    if (response.includes("Balance Sheet")) return { type: "financial_data", data: { content: response } };
    if (response.includes("Profit & Loss")) return { type: "financial_data", data: { content: response } };
    if (response.includes("Cash Flow")) return { type: "financial_data", data: { content: response } };
    if (response.includes("LEDGER ENTRIES")) return { type: "audit_trace", data: { content: response } };
    if (response.includes("REVIEW NEEDED")) return { type: "action_required", data: { content: response } };
    return { type: "text" };
  };

  const playAudioPayload = (base64Audio: string) => {
    if (!isVoiceEnabled) return;
    try {
      if (currentAudioRef.current) currentAudioRef.current.pause();
      const audioBlob = new Blob([new Uint8Array(atob(base64Audio).split("").map(c => c.charCodeAt(0)))], { type: "audio/mpeg" });
      const generatedAudioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(generatedAudioUrl);
      const audio = new Audio(generatedAudioUrl);
      currentAudioRef.current = audio;
      audio.play().catch(e => console.error(e));
    } catch (e) {}
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result as string;
      setLoading(true);
      
      setChatLog(prev => [...prev, { id: `msg-${Date.now()}`, role: "user", text: `[FILE_UPLOAD] ${file.name}`, metadata: { type: "text" } }]);

      try {
        const token = await refreshAccessTokenIfNeeded(accessToken || "", refreshToken || "");
        const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'https://autobooks-backend-571147915643.us-central1.run.app';
        
        const res = await fetch(`${baseUrl}/api/chat/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ image_data: base64Image }),
        });

        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        
        if (data.pending_document) setPendingDocument(data.pending_document);
        if (data.audio_base64) playAudioPayload(data.audio_base64);

        setChatLog(prev => [...prev, { id: `msg-${Date.now()}-bot`, role: "copilot", text: data.reply, metadata: parseAgentResponse(data.reply) }]);
      } catch (err) {
        setChatLog(prev => [...prev, { id: `msg-${Date.now()}-err`, role: "copilot", text: "ERR: Document extraction failed." }]);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (voicePayloadBase64?: string) => {
    const isTextMsg = message.trim().length > 0;
    if (!isTextMsg && !voicePayloadBase64) return;
    setLoading(true);

    try {
      const userMessage: ChatMessage = { id: `msg-${Date.now()}`, role: "user", text: isTextMsg ? message : "[AUDIO_PAYLOAD_RECEIVED]" };
      setChatLog(prev => [...prev, userMessage]);
      setMessage("");

      const bodyPayload: any = {};
      if (isTextMsg) bodyPayload.message = userMessage.text;
      if (voicePayloadBase64) bodyPayload.audio_data = voicePayloadBase64;

      const token = await refreshAccessTokenIfNeeded(accessToken || "", refreshToken || "");
      const res = await fetch("https://autobooks-backend-571147915643.us-central1.run.app/api/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (data.pending_document) setPendingDocument(data.pending_document);
      if (data.audio_base64) playAudioPayload(data.audio_base64);

      setChatLog(prev => [...prev, { id: `msg-${Date.now()}-bot`, role: "copilot", text: data.reply, metadata: parseAgentResponse(data.reply) }]);

      if (data.trigger_action === "START_VISION") {
        setTimeout(() => { router.push('/ui_navigator'); }, 2000); 
      }
    } catch (err) {
      setChatLog(prev => [...prev, { id: `err`, role: "copilot", text: "ERR: Connection lost." }]);
    } finally { setLoading(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => { handleSend(reader.result as string); };
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (e) { alert("Hardware microphone required."); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleDocumentAction = async (action: "POST" | "REVOKE") => {
    if (!pendingDocument) return;
    setLoading(true);
    try {
      const token = await refreshAccessTokenIfNeeded(accessToken || "", refreshToken || "");
      const res = await fetch("https://autobooks-backend-571147915643.us-central1.run.app/api/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: action === "POST" ? "Proceed" : "Cancel", pending_document_action: action }),
      });
      const data = await res.json();
      if (data.audio_base64) playAudioPayload(data.audio_base64);
      setChatLog(prev => [...prev, { id: `msg-${Date.now()}-bot`, role: "copilot", text: data.reply, metadata: parseAgentResponse(data.reply) }]);
      setPendingDocument(null);
    } catch (err) { } finally { setLoading(false); }
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.metadata?.type === "financial_data" || msg.metadata?.type === "audit_trace") {
      const lines = msg.metadata.data.content.split("\n").filter((l: string) => l.trim());
      return <div className="hw-data-card">
        {lines.map((l: string, i: number) => <div key={i} className="monospace-line">{l}</div>)}
      </div>;
    }
    if (msg.metadata?.type === "action_required") {
      const isReview = msg.metadata.data.content.includes("REVIEW NEEDED");
      return (
        <div className={`hw-action-card ${isReview ? 'hw-warning' : 'hw-success'}`}>
          <div className="action-text">{msg.metadata.data.content}</div>
          {isReview && pendingDocument && (
            <div className="hw-action-btn-group">
              <button className="hw-btn-approve" onClick={() => handleDocumentAction("POST")}>[ CONFIRM ]</button>
              <button className="hw-btn-cancel" onClick={() => handleDocumentAction("REVOKE")}>[ ABORT ]</button>
            </div>
          )}
        </div>
      );
    }
    return <div className="text-content">{msg.text}</div>;
  };

  return (
    <>
      <style>{`
        .hw-scrollbar::-webkit-scrollbar { width: 4px; }
        .hw-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 0; }
        
        .hw-input-area:focus { outline: none; border-color: #38bdf8 !important; }
        
        /* Agent Readout Data */
        .hw-data-card { 
          background: #000000; 
          color: #38bdf8; 
          padding: 8px 10px; /* Tighter padding */
          border: 1px solid #1e293b;
          border-left: 2px solid #38bdf8;
          border-radius: 4px; 
          font-size: 0.75rem; /* Smaller font */
          margin-top: 6px; 
        }
        
        /* Action Cards */
        .hw-action-card { padding: 10px; border-radius: 4px; margin-top: 6px; border-left: 2px solid; }
        .hw-warning { background: rgba(245, 158, 11, 0.1); border-color: #f59e0b; color: #fcd34d; white-space: pre-wrap;}
        .hw-success { background: rgba(52, 211, 153, 0.1); border-color: #34d399; color: #6ee7b7; white-space: pre-wrap;}
        
        /* Action Buttons */
        .hw-action-btn-group { display: flex; gap: 6px; margin-top: 10px; }
        .hw-btn-approve, .hw-btn-cancel { 
          flex: 1; padding: 8px; font-weight: 800; cursor: pointer; 
          font-family: inherit; font-size: 0.75rem; letter-spacing: 1px;
          background: #000; border-radius: 4px;
        }
        .hw-btn-approve { color: #34d399; border: 1px solid #34d399; }
        .hw-btn-approve:hover { background: #34d399; color: #000; }
        .hw-btn-cancel { color: #ef4444; border: 1px solid #ef4444; }
        .hw-btn-cancel:hover { background: #ef4444; color: #000; }
        
        .text-content { white-space: pre-wrap; word-break: break-word; line-height: 1.4; font-size: 0.8rem; }
        
        .hw-recording { 
          color: #ef4444 !important; 
          text-shadow: 0 0 10px #ef4444;
          animation: hw-pulse-red 1s infinite alternate; 
        }
        @keyframes hw-pulse-red { 0% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>

      {audioUrl && <audio controls src={audioUrl} style={{ display: "none" }} />}

      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: "transparent" }}>
        
        {/* Inline Audio Toggle */}
        <div style={{ padding: "6px 12px", borderBottom: "1px solid #1e293b", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#000" }}>
          <span style={{ color: "#64748b", fontSize: "0.65rem", fontWeight: "bold", letterSpacing: "1px" }}>AUDIO_OUT</span>
          <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} style={{ background: "transparent", color: isVoiceEnabled ? "#34d399" : "#64748b", border: "none", cursor: "pointer", fontSize: "0.7rem", fontWeight: "bold" }}>
            {isVoiceEnabled ? "[ ON ]" : "[ OFF ]"}
          </button>
        </div>

        {/* Chat Area */}
        <div className="hw-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {chatLog.length === 0 && !loading && (
            <div style={{ textAlign: "center", color: "#475569", fontSize: "0.75rem", marginTop: "10px", letterSpacing: "1px" }}>
              AWAITING INPUT_
            </div>
          )}
          {chatLog.map((line, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: line.role === "user" ? "flex-end" : "flex-start", width: "100%" }}>
              {/* Sender Label */}
              <span style={{ fontSize: "0.55rem", color: line.role === "user" ? "#64748b" : "#38bdf8", marginBottom: "2px", fontWeight: "bold" }}>
                {line.role === "user" ? "ADMIN_INPUT" : "CFO_RESPONSE"}
              </span>
              
              {/* Message Content */}
              <div style={{
                color: line.role === "user" ? "#94a3b8" : "#f8fafc",
                maxWidth: "95%", fontSize: "0.8rem"
              }}>
                {line.role === "user" ? (
                  <span style={{ display: "flex", gap: "6px" }}>
                    <span style={{ color: "#34d399" }}>&gt;</span> {renderMessageContent(line)}
                  </span>
                ) : (
                  renderMessageContent(line)
                )}
              </div>
            </div>
          ))}
          {loading && <div style={{ color: "#38bdf8", fontSize: "0.75rem", padding: "8px", animation: "hw-pulse-red 1s infinite alternate" }}>PROCESSING...</div>}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{ padding: "12px", borderTop: "2px solid #1e293b", background: "#000", display: "flex", gap: "8px", alignItems: "center" }}>
          
          <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*,application/pdf" onChange={handleFileUpload} />
          <button onClick={() => fileInputRef.current?.click()} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1rem" }} title="Inject Payload">📎</button>

          <button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={isRecording ? 'hw-recording' : ''} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "1rem" }}>
            🎙️
          </button>

          <input type="text" className="hw-input-area" value={message} onChange={(e) => setMessage(e.target.value)} disabled={isRecording} onKeyDown={(e) => e.key === "Enter" && handleSend()} 
            style={{ flex: 1, padding: "8px 10px", borderRadius: "4px", border: "1px solid #334155", background: "#020617", color: "#34d399", fontFamily: "inherit", fontSize: "0.8rem" }} 
            placeholder="ENTER COMMAND..." 
          />
          
          <button onClick={() => handleSend()} disabled={loading || (!message.trim() && !isRecording)} 
            style={{ padding: "8px 12px", background: loading || (!message.trim() && !isRecording) ? "#1e293b" : "#38bdf8", color: loading || (!message.trim() && !isRecording) ? "#475569" : "#000", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "900", fontFamily: "inherit", letterSpacing: "1px", fontSize: "0.8rem" }}>
            EXE
          </button>
        </div>
      </div>
    </>
  );
}