"use client"

import React, { useState, useRef, useEffect } from "react";
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from "@utils/tokenUtils";
import { useRouter } from "next/navigation"; // FOR ROUTING TO UI-NAVIGATOR

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
  const fileInputRef = useRef<HTMLInputElement>(null); // For document uploads
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

  // --- DOCUMENT UPLOAD CONDUIT ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Image = reader.result as string;
      setLoading(true);
      
      setChatLog(prev => [...prev, { id: `msg-${Date.now()}`, role: "user", text: ` Uploaded: ${file.name}`, metadata: { type: "text" } }]);

      try {
        const token = await refreshAccessTokenIfNeeded(accessToken || "", refreshToken || "");
        const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://127.0.0.1:8000';
        
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
        setChatLog(prev => [...prev, { id: `msg-${Date.now()}-err`, role: "copilot", text: " Document extraction failed." }]);
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
      const userMessage: ChatMessage = { id: `msg-${Date.now()}`, role: "user", text: isTextMsg ? message : "🎙️ Voice Command" };
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

      // --- VISION CONDUIT TRIGGER ---
      if (data.trigger_action === "START_VISION") {
        setTimeout(() => { router.push('/ui_navigator'); }, 2000); // Redirect to the LiveStream UI
      }
    } catch (err) {
      setChatLog(prev => [...prev, { id: `err`, role: "copilot", text: " Error connecting to CFO." }]);
    } finally { setLoading(false); }
  };

  // ... [Keep startRecording, stopRecording, handleDocumentAction exactly as they were]
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
    } catch (e) { alert("Microphone access is required."); }
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
      return <div className={msg.metadata.type === "financial_data" ? "financial-data-card" : "audit-trace-container"}>
        {lines.map((l: string, i: number) => <div key={i} className="monospace-line">{l}</div>)}
      </div>;
    }
    if (msg.metadata?.type === "action_required") {
      const isReview = msg.metadata.data.content.includes("REVIEW NEEDED");
      return (
        <div className={`action-card ${isReview ? 'warning' : 'success'}`}>
          <div className="action-text">{msg.metadata.data.content}</div>
          {isReview && pendingDocument && (
            <div className="action-button-group">
              <button className="btn-approve" onClick={() => handleDocumentAction("POST")}> Proceed</button>
              <button className="btn-cancel" onClick={() => handleDocumentAction("REVOKE")}> Discard</button>
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
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 10px; }
        .custom-input:focus { outline: none; border-color: #007AFF !important; box-shadow: 0 0 0 3px rgba(0,122,255,0.1) !important; }
        .financial-data-card { font-family: 'Fira Code', monospace; background: #0f172a; color: #38bdf8; padding: 12px; border-radius: 8px; font-size: 0.8rem; margin-top: 8px; }
        .audit-trace-container { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px; margin-top: 8px; font-family: monospace; font-size: 0.8rem; color: #475569;}
        .action-card { padding: 12px; border-radius: 8px; margin-top: 8px; }
        .warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; white-space: pre-wrap;}
        .success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; white-space: pre-wrap;}
        .action-button-group { display: flex; gap: 8px; margin-top: 12px; }
        .btn-approve, .btn-cancel { flex: 1; padding: 8px; border-radius: 6px; font-weight: 600; cursor: pointer; border: none; }
        .btn-approve { background: #16a34a; color: white; }
        .btn-cancel { background: #dc2626; color: white; }
        .text-content { white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
        .mic-btn.recording { background: #ef4444 !important; color: white !important; animation: pulse-red 1.5s infinite; }
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7); } 70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } }
        
        .upload-btn {
          padding: 10px; border-radius: 50%; border: none; background: #f1f5f9; color: #475569;
          cursor: pointer; font-size: 1.1rem; display: flex; align-items: center; justify-content: center;
          transition: background 0.2s;
        }
        .upload-btn:hover { background: #e2e8f0; }
      `}</style>

      {audioUrl && <audio controls src={audioUrl} style={{ display: "none" }} />}

      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", backgroundColor: "#ffffff", overflow: "hidden" }}>
        
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #f0f0f0", zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, color: "#111", fontSize: "1rem", fontWeight: "600" }}>Assistant</h3>
          <button onClick={() => setIsVoiceEnabled(!isVoiceEnabled)} style={{ background: isVoiceEnabled ? "#e0f2fe" : "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer" }}>
            {isVoiceEnabled ? "🔊" : "🔇"}
          </button>
        </div>

        <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "15px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {chatLog.length === 0 && !loading && (
            <div style={{ textAlign: "center", color: "#8e8e93", fontSize: "0.85rem", marginTop: "10px" }}>
              Upload docs, hold mic to speak, or type "look at my screen".
            </div>
          )}
          {chatLog.map((line, i) => (
            <div key={i} style={{ display: "flex", justifyContent: line.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                backgroundColor: line.role === "user" ? "#007AFF" : "#f1f5f9",
                color: line.role === "user" ? "#ffffff" : "#0f172a",
                padding: "10px 14px", borderRadius: line.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                maxWidth: "85%", fontSize: "0.9rem"
              }}>
                {renderMessageContent(line)}
              </div>
            </div>
          ))}
          {loading && <div style={{ color: "#94a3b8", fontSize: "0.8rem", padding: "10px" }}>Assistant is working...</div>}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: "12px 15px", borderTop: "1px solid #f0f0f0", display: "flex", gap: "8px", alignItems: "center" }}>
          
          {/* NEW: Document Upload Button inside Chat */}
          <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*,application/pdf" onChange={handleFileUpload} />
          <button className="upload-btn" onClick={() => fileInputRef.current?.click()} title="Upload Document">📎</button>

          <button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`mic-btn ${isRecording ? 'recording' : ''}`} style={{ padding: "10px", borderRadius: "50%", border: "none", background: "#f1f5f9", cursor: "pointer", fontSize: "1.1rem" }}>
            🎙️
          </button>

          <input type="text" className="custom-input" value={message} onChange={(e) => setMessage(e.target.value)} disabled={isRecording} onKeyDown={(e) => e.key === "Enter" && handleSend()} style={{ flex: 1, padding: "10px 16px", borderRadius: "20px", border: "1px solid #e5e7eb", background: "#f9fafb" }} placeholder="Message..." />
          
          <button onClick={() => handleSend()} disabled={loading || (!message.trim() && !isRecording)} style={{ padding: "10px 16px", background: loading || (!message.trim() && !isRecording) ? "#e5e7eb" : "#007AFF", color: "white", border: "none", borderRadius: "20px", cursor: "pointer", fontWeight: "600" }}>
            Send
          </button>
        </div>
      </div>
    </>
  );
}