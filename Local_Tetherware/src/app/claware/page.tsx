'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import CryptoJS from 'crypto-js';
import { getTokensFromLocalStorage, refreshAccessTokenIfNeeded } from '../../utils/tokenUtils';
import { useAuth } from '../../context/AuthContext'; 

/**
 * ClawareSigner Component
 * Provides a high-security interface for local enclave management, 
 * autonomous signing via OpenClaw, and multichain treasury operations.
 */
export default function ClawareSigner() {
  const { accessToken, signIn, signUp, signOut } = useAuth();
  
  /**
   * Enclave Boot and Sync State
   */
  const [isBooting, setIsBooting] = useState(true);
  const [hasKeystore, setHasKeystore] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [publicAddress, setPublicAddress] = useState("");
  
  /**
   * Autonomous Signing Configuration
   */
  const [autoSignEnabled, setAutoSignEnabled] = useState(false);
  const activePinRef = useRef<string | null>(null);

  /**
   * Multichain and Asset State
   */
  const [selectedChain, setSelectedChain] = useState("ethereum-sepolia");
  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);

  /**
   * Transaction Management State
   */
  const [showSendForm, setShowSendForm] = useState(false);
  const [showReceiveInfo, setShowReceiveInfo] = useState(false);
  const [transferAddress, setTransferAddress] = useState("");
  const [transferAmount, setTransferAmount] = useState("");

  const [pendingIntents, setPendingIntents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<any | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [step, setStep] = useState(0);

  /**
   * Credential Export State
   */
  const [showExport, setShowExport] = useState(false);
  const [revealPin, setRevealPin] = useState("");
  const [revealedKey, setRevealedKey] = useState("");
  const [revealedSeed, setRevealedSeed] = useState("");

  /**
   * Web2 Identity Binding State
   */
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const DJANGO_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || "https://autobooks-backend-571147915643.us-central1.run.app";
  const NODE_RELAYER_URL = "https://node-web3-server.onrender.com"; 
  const VERCEL_FRONTEND_URL = "https://autobooks-frontend.vercel.app"; 

  /**
   * Boot Sequence
   * Validates local enclave existence and synchronization status on mount.
   */
  useEffect(() => {
    const checkEnclaveBootState = async () => {
      try {
        const res = await fetch('/api/sign');
        const enclave = await res.json();
        if (!enclave.exists) {
          setHasKeystore(false);
          localStorage.removeItem("claware_is_synced");
          signOut(); 
        } else {
          setHasKeystore(true);
          setPublicAddress(enclave.publicAddress);
          if (enclave.encryptedSeed) localStorage.setItem("claware_encrypted_seed", enclave.encryptedSeed);
          const explicitlySynced = localStorage.getItem("claware_is_synced") === "true";
          if (!explicitlySynced) signOut();
        }
      } catch (error) {
        console.error("Enclave Boot Error:", error);
      } finally {
        setIsBooting(false);
      }
    };
    checkEnclaveBootState();
  }, []);

  useEffect(() => {
    const explicitlySynced = localStorage.getItem("claware_is_synced") === "true";
    if (hasKeystore && explicitlySynced && accessToken) {
      setIsSynced(true);
    } else {
      setIsSynced(false);
    }
  }, [accessToken, hasKeystore]);

  /**
   * Balance Synchronization Engine
   * Polls the Node Relayer for current USDT balances across supported chains.
   */
  useEffect(() => {
    if (!hasKeystore || !publicAddress) return;

    const fetchCurrentBalance = async () => {
      setIsFetchingBalance(true);
      try {
        const res = await fetch(`${NODE_RELAYER_URL}/wallet-balance/${publicAddress}/${selectedChain}`);
        if (res.ok) {
          const data = await res.json();
          setUsdtBalance(data.balance); 
        }
      } catch (err) {
        console.error("Balance fetch failed:", err);
      } finally {
        setIsFetchingBalance(false);
      }
    };

    fetchCurrentBalance();
    const interval = setInterval(fetchCurrentBalance, 10000); 
    return () => clearInterval(interval);
  }, [publicAddress, selectedChain, hasKeystore]);

  /**
   * OpenClaw Autonomous Engine
   * Sweeps the backend for unsigned payloads and executes automatic signing if authorized.
   */
  useEffect(() => {
    if (isBooting || !hasKeystore || !isSynced) return;

    const sweepAndAutoSign = async () => {
      try {
        const tokens = getTokensFromLocalStorage();
        if (!tokens.accessToken) return;

        const freshToken = await refreshAccessTokenIfNeeded(tokens.accessToken, tokens.refreshToken);
        const res = await fetch(`${DJANGO_URL}/api/documents/`, {
          headers: { "Authorization": `Bearer ${freshToken}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          const pending = data.filter((doc: any) => doc.unsigned_payload !== null && doc.unsigned_payload !== undefined);
          setPendingIntents(pending);

          if (autoSignEnabled && pending.length > 0 && !loading && activePinRef.current) {
            console.log("OpenClaw: Autonomous signing triggered for Intent ID:", pending[0].id);
            handleAutonomousSign(pending[0]);
          }
        }
      } catch (err) { console.error("Sweeper Error:", err); }
    };

    const interval = setInterval(sweepAndAutoSign, 20000); 
    return () => clearInterval(interval);
  }, [isBooting, hasKeystore, isSynced, autoSignEnabled]);

  const handleAutonomousSign = async (intent: any) => {
    if (loading || !activePinRef.current) return;
    setLoading(true);
    try {
      const encryptedSeed = localStorage.getItem("claware_encrypted_seed");
      const signRes = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encryptedSeed,
          pin: activePinRef.current,
          rawPayload: intent.unsigned_payload, 
          isSponsored: true 
        })
      });
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error);

      const tokens = getTokensFromLocalStorage();
      await fetch(`${DJANGO_URL}/web3/reconcile/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${tokens.accessToken}` },
        body: JSON.stringify({ document_id: intent.id, tx_hash: signData.txHash })
      });
      console.log(`Autonomous Settlement Successful: ${signData.txHash}`);
    } catch (e) { console.error("AutoSign Failed:", e); }
    finally { setLoading(false); }
  };

  /**
   * Wallet Initialization
   * Generates a new EOA and persists the encrypted seed to the local enclave.
   */
  const handleCreateWallet = async () => {
    if (!pin) { setStatusMessage("Error: Please set an Enclave PIN."); return; }
    signOut(); 
    localStorage.removeItem("claware_is_synced");
    setIsSynced(false);
    setLoading(true);
    setStep(1);
    try {
      setStatusMessage("Generating secure local Air-Gapped Wallet...");
      const wallet = ethers.Wallet.createRandom();
      const encryptedSeed = CryptoJS.AES.encrypt(wallet.mnemonic!.phrase, pin).toString();
      const saveRes = await fetch('/api/sign', { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedSeed, publicAddress: wallet.address })
      });
      if (!saveRes.ok) throw new Error("Failed to write to local OS sandbox.");
      localStorage.setItem("claware_encrypted_seed", encryptedSeed);
      setPublicAddress(wallet.address);
      setHasKeystore(true);
      setStatusMessage("Wallet Successfully Created!");
      setTimeout(() => { setPin(""); setStatusMessage(""); setStep(0); }, 1500);
    } catch (err: any) { setStatusMessage(`Error: ${err.message}`); setStep(0); }
    finally { setLoading(false); }
  };

  /**
   * Account Binding
   * Synchronizes the derived Smart Account with the Web2 business profile.
   */
  const handleConnectBusiness = async () => {
    if (!username || !password || !pin || (authMode === 'register' && !email)) {
      setStatusMessage("Error: Missing required fields.");
      return;
    }
    setLoading(true);
    try {
      setStatusMessage("Unlocking Enclave and Deriving Vault...");
      const encryptedSeed = localStorage.getItem("claware_encrypted_seed");

      const deriveRes = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedSeed, pin, action: "derive" })
      });
      const deriveData = await deriveRes.json();
      if (!deriveRes.ok) throw new Error(deriveData.error);
      
      const saAddress = deriveData.smartAccountAddress;

      setStatusMessage(authMode === 'register' ? "Registering Business..." : "Authenticating Profile...");
      if (authMode === 'register') await signUp({ username, email, password, role: 'admin' });
      else await signIn(username, password);

      const freshTokens = getTokensFromLocalStorage();
      setStatusMessage("Binding Vault to Cloud Ledger...");
      const activateRes = await fetch(`${DJANGO_URL}/web3/activate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${freshTokens.accessToken}` },
        body: JSON.stringify({ wallet_address: saAddress, network: 'celo-sepolia' }) 
      });

      if (!activateRes.ok) throw new Error("Binding failed.");

      await fetch('/api/sign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encryptedSeed, publicAddress: saAddress, smartAccountAddress: saAddress })
      });

      setPublicAddress(saAddress);
      localStorage.setItem("claware_is_synced", "true");
      activePinRef.current = pin; 
      setStatusMessage("Successfully Synced Vault!");
      setTimeout(() => { setPin(""); setPassword(""); setStatusMessage(""); setShowConnectForm(false); setIsSynced(true); }, 1500);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally { setLoading(false); }
  };

  /**
   * Manual Transaction Authorization
   * Signs and broadcasts specific intents with explicit user consent.
   */
  const handleSignAndBroadcast = async () => {
    if (!pin || !selectedIntent) return;
    setLoading(true);
    try {
      setStatusMessage("Signature Request: Signing via WDK...");
      const encryptedSeed = localStorage.getItem("claware_encrypted_seed");
      
      const signRes = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            encryptedSeed, 
            pin, 
            rawPayload: selectedIntent.unsigned_payload
        })
      });
      
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error || "Unknown signing or relay error");

      setStatusMessage("Broadcasting and Reconciling...");
      const tokens = getTokensFromLocalStorage();
      const freshToken = await refreshAccessTokenIfNeeded(tokens.accessToken!, tokens.refreshToken!);
      
      await fetch(`${DJANGO_URL}/web3/reconcile/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${freshToken}` },
        body: JSON.stringify({ document_id: selectedIntent.id, tx_hash: signData.txHash })
      });

      activePinRef.current = pin; 
      const shortHash = signData.txHash ? signData.txHash.substring(0, 12) : "UnknownTx";
      const intentType = selectedIntent.unsigned_payload?.intent || "";
      const actionName = intentType ? intentType.replace(/-/g, " ").toUpperCase() : "TRANSACTION";
      
      setStatusMessage(`${actionName} SUCCESSFUL: ${shortHash}...`);
      
      setPendingIntents(prev => prev.filter(i => i.id !== selectedIntent.id));
      setTimeout(() => { setSelectedIntent(null); setPin(""); setStatusMessage(""); }, 3000);
    } catch (error: any) { 
      setStatusMessage(`Error: ${error.message}`); 
    } finally { 
      setLoading(false); 
    }
  };

  /**
   * Direct Asset Transfer
   * Encodes and signs standard ERC20 transfers for manual treasury management.
   */
  const handleDirectTransfer = async () => {
    if (!pin || !transferAddress || !transferAmount) return;
    setLoading(true);
    try {
      setStatusMessage("Signing Direct Transfer...");
      const std_usdt = "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0";
      
      const amountWei = ethers.parseUnits(transferAmount, 6);
      const iface = new ethers.Interface(["function transfer(address to, uint256 amount)"]);
      const encodedData = iface.encodeFunctionData("transfer", [transferAddress, amountWei]);

      const rawPayload = {
        intent: "direct-transfer",
        network: selectedChain,
        transactions: [{
          to: std_usdt,
          value: "0",
          data: encodedData
        }]
      };

      const encryptedSeed = localStorage.getItem("claware_encrypted_seed");
      const signRes = await fetch("/api/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ encryptedSeed, pin, rawPayload })
      });
      
      const signData = await signRes.json();
      if (!signRes.ok) throw new Error(signData.error || "Transfer failed");

      setStatusMessage(`TRANSFER SUCCESSFUL: ${signData.txHash.substring(0, 12)}...`);
      setTimeout(() => { 
        setPin(""); 
        setStatusMessage(""); 
        setShowSendForm(false); 
        setTransferAddress(""); 
        setTransferAmount(""); 
      }, 3000);
    } catch (error: any) {
      setStatusMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRevealKeys = () => {
    try {
      if (!revealPin) throw new Error("PIN required.");
      const encryptedSeed = localStorage.getItem("claware_encrypted_seed");
      const bytes = CryptoJS.AES.decrypt(encryptedSeed!, revealPin);
      const seedPhrase = bytes.toString(CryptoJS.enc.Utf8);
      if (!seedPhrase || seedPhrase.split(' ').length < 12) throw new Error("Invalid PIN.");
      const wallet = ethers.Wallet.fromPhrase(seedPhrase);
      setRevealedKey(wallet.privateKey);
      setRevealedSeed(seedPhrase);
      setRevealPin(""); 
    } catch (err: any) { alert(err.message); }
  };

  const handleHideKeys = () => { setRevealedKey(""); setRevealedSeed(""); setShowExport(false); };
  const handleCopy = (text: string) => { navigator.clipboard.writeText(text); alert("Copied!"); };

  return (
    <div className="claware-desktop">
      <div className="desktop-container">
        
        <header className="dashboard-header">
          <div className="header-left">
            <h1 className="title">TetherWare ENCLAVE</h1>
            <p className="subtitle">10-Chain WDK Autonomous Agent</p>
          </div>
          <div className="header-right">
            <div className="status-badge">
              <span className={isSynced && hasKeystore ? "pulse-dot active" : "pulse-dot"}></span> 
              {isBooting ? "BOOTING SECURE ELEMENT..." : (isSynced ? "AGENT CONNECTED" : (hasKeystore ? "LOCAL WALLET READY" : "OFFLINE"))}
            </div>
          </div>
        </header>

        {isBooting && <div className="full-loading">INITIALIZING SANDBOX...</div>}

        {!isBooting && !hasKeystore && (
          <div className="onboarding-full">
            <div className="onboarding-box">
              <h2>CREATE LOCAL WALLET</h2>
              <p>Generate a secure, air-gapped seed phrase encrypted by your PIN.</p>
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="ENTER DEVICE PIN" disabled={loading} className="hw-input" />
              {statusMessage && <div className="hw-message">{statusMessage}</div>}
              <button className="hw-btn-primary" onClick={handleCreateWallet} disabled={loading || !pin}>GENERATE SEED</button>
            </div>
          </div>
        )}

        {!isBooting && hasKeystore && (
          <div className="dashboard-grid">
            
            <aside className="dashboard-sidebar">
              <div className="hw-panel">
                <h3 className="panel-title">WDK NETWORK</h3>
                <select className="hw-select" value={selectedChain} onChange={(e) => setSelectedChain(e.target.value)}>
                  <option value="ethereum-sepolia">Ethereum Sepolia</option>
                  <option value="base-sepolia">Base Sepolia</option>
                  <option value="arbitrum-sepolia">Arbitrum Sepolia</option>
                  <option value="optimism-sepolia">Optimism Sepolia</option>
                  <option value="polygon-amoy">Polygon Amoy</option>
                  <option value="avalanche-fuji">Avalanche Fuji</option>
                  <option value="celo-alfajores">Celo Alfajores</option>
                  <option value="linea-sepolia">Linea Sepolia</option>
                  <option value="scroll-sepolia">Scroll Sepolia</option>
                  <option value="blast-sepolia">Blast Sepolia</option>
                </select>

                <div className="address-container">
                  <span className="address-label">SMART ACCOUNT ADDRESS</span>
                  <div className="address-value-row">
                    <span className="hw-address">{publicAddress}</span>
                    <button className="hw-btn-small" onClick={() => handleCopy(publicAddress)}>COPY</button>
                  </div>
                </div>

                <div className="hw-balance-box">
                  <span className="balance-label">AVAILABLE USDT</span>
                  <span className="balance-value">{isFetchingBalance ? "SYNCING..." : `${usdtBalance} USDT`}</span>
                </div>
              </div>

              {!isSynced && (
                <div className="hw-panel">
                  <h3 className="panel-title">CLOUD PAIRING</h3>
                  {!showConnectForm ? (
                    <button className="hw-btn-primary" onClick={() => { setShowConnectForm(true); setShowSendForm(false); setShowReceiveInfo(false); }}>CONNECT TO AUTOBOOKS</button>
                  ) : (
                    <div className="hw-form">
                      <div className="hw-tabs">
                        <button className={authMode === 'login' ? 'hw-tab active' : 'hw-tab'} onClick={() => setAuthMode('login')}>LOGIN</button>
                        <button className={authMode === 'register' ? 'hw-tab active' : 'hw-tab'} onClick={() => setAuthMode('register')}>REGISTER</button>
                      </div>
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="USERNAME" className="hw-input" />
                      {authMode === 'register' && <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="EMAIL" className="hw-input" />}
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="PASSWORD" className="hw-input" />
                      <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="DEVICE PIN" className="hw-input highlight-input" />
                      {statusMessage && <div className="hw-message">{statusMessage}</div>}
                      <div className="hw-btn-group">
                        <button className="hw-btn-secondary" onClick={() => setShowConnectForm(false)}>CANCEL</button>
                        <button className="hw-btn-primary" onClick={handleConnectBusiness} disabled={loading}>SYNC</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isSynced && (
                <div className="hw-panel autonomy-panel">
                  <div className="autonomy-header">
                    <h3 className="panel-title">OPENCLAW AUTONOMY</h3>
                    <button onClick={() => setAutoSignEnabled(!autoSignEnabled)} className={`hw-toggle ${autoSignEnabled ? 'on' : 'off'}`}>
                      {autoSignEnabled ? "ENABLED" : "DISABLED"}
                    </button>
                  </div>
                  <p className="autonomy-desc">
                    {autoSignEnabled 
                      ? "Agent is fully authorized to intercept, sign, and broadcast intents from the cloud ledger automatically." 
                      : "Manual PIN approval is required for all blockchain intents."}
                  </p>
                </div>
              )}

              <div className="hw-panel export-panel">
                  {!showExport && <button className="hw-btn-ghost" onClick={() => { setShowExport(true); setShowSendForm(false); setShowReceiveInfo(false); }}>EXPORT PRIVATE KEYS</button>}
                  {showExport && !revealedKey && (
                    <div className="hw-export-form">
                        <input type="password" placeholder="DEVICE PIN" value={revealPin} onChange={(e) => setRevealPin(e.target.value)} className="hw-input" />
                        <div className="hw-btn-group">
                          <button className="hw-btn-ghost" onClick={() => setShowExport(false)}>CANCEL</button>
                          <button className="hw-btn-danger" onClick={handleRevealKeys}>REVEAL</button>
                        </div>
                    </div>
                  )}
                  {showExport && revealedKey && (
                    <div className="hw-revealed">
                        <span className="revealed-label">PRIVATE KEY</span>
                        <div className="hw-key-box">{revealedKey}</div>
                        <span className="revealed-label">SEED PHRASE</span>
                        <div className="hw-key-box">{revealedSeed}</div>
                        <button className="hw-btn-secondary" style={{width: '100%', marginTop: '10px'}} onClick={handleHideKeys}>LOCK DATA</button>
                    </div>
                  )}
              </div>
            </aside>

            <main className="dashboard-main">
               <div className="action-flex-container" style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', alignItems: 'start' }}>
                 
                 <div className="transfer-column">
                   <div className="hw-panel" style={{ background: 'rgba(15, 23, 42, 0.5)', borderColor: '#334155' }}>
                     <h3 className="panel-title">TREASURY ACTIONS</h3>
                     <div className="hw-btn-group" style={{ marginBottom: '15px' }}>
                       <button className={showSendForm ? "hw-btn-confirm" : "hw-btn-primary"} onClick={() => { setShowSendForm(!showSendForm); setShowReceiveInfo(false); setShowExport(false); }}>SEND</button>
                       <button className={showReceiveInfo ? "hw-btn-confirm" : "hw-btn-secondary"} onClick={() => { setShowReceiveInfo(!showReceiveInfo); setShowSendForm(false); setShowExport(false); }}>RECEIVE</button>
                     </div>

                     {showSendForm && (
                       <div className="send-form-active" style={{ borderTop: '1px solid #1e293b', paddingTop: '15px' }}>
                         <label className="address-label">RECIPIENT ADDRESS</label>
                         <input type="text" value={transferAddress} onChange={(e) => setTransferAddress(e.target.value)} placeholder="0x..." className="hw-input" />
                         <label className="address-label">USDT AMOUNT</label>
                         <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} placeholder="0.00" className="hw-input" />
                         <label className="address-label">ENCLAVE PIN</label>
                         <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="DEVICE PIN" className="hw-input highlight-input" />
                         <button className="hw-btn-confirm" onClick={handleDirectTransfer} disabled={loading || !pin || !transferAddress || !transferAmount}>EXECUTE ON-CHAIN</button>
                       </div>
                     )}

                     {showReceiveInfo && (
                       <div className="receive-info-active" style={{ borderTop: '1px solid #1e293b', paddingTop: '15px', textAlign: 'center' }}>
                         <label className="address-label" style={{ color: '#34d399' }}>DEPOSIT ADDRESS</label>
                         <div style={{ background: '#000', padding: '10px', borderRadius: '6px', margin: '10px 0', border: '1px solid #334155' }}>
                           <p style={{ fontSize: '0.65rem', wordBreak: 'break-all', color: '#fff' }}>{publicAddress}</p>
                         </div>
                         <button className="hw-btn-small" style={{ width: '100%' }} onClick={() => handleCopy(publicAddress)}>COPY TO CLIPBOARD</button>
                       </div>
                     )}

                     {statusMessage && !selectedIntent && <div className="hw-message" style={{ marginTop: '15px' }}>{statusMessage}</div>}
                   </div>
                 </div>

                 <div className="intents-column">
                   {isSynced ? (
                     <>
                       <div className="sync-banner" style={{ marginBottom: '20px' }}>
                         <span>ENCLAVE LINKED TO CLOUD</span>
                         <a href={VERCEL_FRONTEND_URL} target="_blank" rel="noreferrer" className="dash-link">DASHBOARD</a>
                       </div>
                       <h2 className="main-title" style={{ marginTop: 0 }}>PENDING CLOUD INTENTS</h2>
                       <div className="intents-list" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                         {pendingIntents.length === 0 ? (
                           <div className="hw-empty-large" style={{ padding: '40px 20px' }}>
                             <span className="empty-icon"></span>
                             <p>NO PENDING PAYLOADS</p>
                             <small>Waiting for Agentic Instructions...</small>
                           </div>
                         ) : (
                           pendingIntents.map(doc => (
                             <div key={doc.id} className="hw-intent-card">
                               <div className="intent-header">
                                 <span className="intent-id">DOCUMENT #{doc.id}</span>
                                 <span className="intent-network">{doc.unsigned_payload?.network?.toUpperCase()}</span>
                               </div>
                               <div className="intent-body">
                                 <h3>{doc.document_type ? `Approve ${doc.document_type.toUpperCase()}` : "BLOCKCHAIN INTENT"}</h3>
                                 <p className="intent-target">Target: {doc.unsigned_payload?.transactions[0]?.to}</p>
                               </div>
                               <button className="hw-btn-action-large" onClick={() => setSelectedIntent(doc)}>REVIEW & SIGN</button>
                             </div>
                           ))
                         )}
                       </div>
                     </>
                   ) : (
                     <div className="hw-empty-large not-synced" style={{ height: '100%' }}>
                       <span className="empty-icon"></span>
                       <p>ENCLAVE NOT SYNCED</p>
                       <small>Pair with your cloud business profile to receive autonomous intents.</small>
                     </div>
                   )}
                 </div>
               </div>
            </main>

          </div>
        )}
      </div>

      {selectedIntent && (
        <div className="hw-modal-takeover">
          <div className="hw-modal-content">
            <h2 className="blink-warning">SIGNATURE REQUIRED</h2>
            <p className="modal-subtitle">Review payload before broadcasting to {selectedIntent.unsigned_payload?.network?.toUpperCase()}</p>
            <div className="hw-payload-view">
              <pre>{JSON.stringify(selectedIntent.unsigned_payload, null, 2)}</pre>
            </div>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="ENTER DEVICE PIN TO AUTHORIZE" disabled={loading} autoFocus className="hw-input large-input" />
            {statusMessage && <div className="hw-message">{statusMessage}</div>}
            <div className="hw-btn-group modal-actions">
              <button className="hw-btn-secondary" onClick={() => { setSelectedIntent(null); setPin(""); setStatusMessage(""); }}>REJECT</button>
              <button className="hw-btn-confirm" onClick={handleSignAndBroadcast} disabled={loading || !pin}>APPROVE & BROADCAST</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .claware-desktop {
          min-height: 100vh;
          background: #020617;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          font-family: 'Courier New', Courier, monospace;
          padding: 2rem;
          color: #cbd5e1;
        }

        .desktop-container {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 20px 30px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }

        .header-left .title {
          margin: 0;
          color: #38bdf8;
          font-size: 1.5rem;
          font-weight: bold;
          letter-spacing: 2px;
        }
        
        .header-left .subtitle {
          margin: 5px 0 0 0;
          color: #64748b;
          font-size: 0.85rem;
          text-transform: uppercase;
        }

        .status-badge {
          display: flex;
          align-items: center;
          background: #020617;
          border: 1px solid #334155;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: bold;
        }

        .pulse-dot {
          display: inline-block;
          width: 8px; height: 8px;
          background: #64748b;
          border-radius: 50%;
          margin-right: 10px;
        }
        .pulse-dot.active {
          background: #34d399;
          box-shadow: 0 0 8px #34d399;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 24px;
          align-items: start;
        }

        .dashboard-sidebar {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .hw-panel {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }

        .panel-title {
          margin: 0 0 15px 0;
          font-size: 0.9rem;
          color: #f8fafc;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 10px;
          letter-spacing: 1px;
        }

        .hw-select {
          width: 100%;
          background: #020617;
          color: #38bdf8;
          border: 1px solid #334155;
          padding: 12px;
          font-family: inherit;
          font-size: 0.9rem;
          border-radius: 8px;
          outline: none;
          margin-bottom: 20px;
          cursor: pointer;
        }

        .address-container {
          background: #000;
          border: 1px solid #1e293b;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
        }
        
        .address-label {
          display: block;
          font-size: 0.7rem;
          color: #64748b;
          margin-bottom: 8px;
        }

        .address-value-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .hw-address {
          color: #34d399;
          font-size: 0.8rem;
          word-break: break-all;
          margin-right: 10px;
        }

        .hw-balance-box {
          background: rgba(56, 189, 248, 0.05);
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
        }

        .balance-label {
          display: block;
          font-size: 0.75rem;
          color: #94a3b8;
          margin-bottom: 8px;
        }

        .balance-value {
          font-size: 1.8rem;
          color: #fff;
          font-weight: bold;
        }

        .hw-input {
          width: 100%;
          background: #020617;
          border: 1px solid #334155;
          color: #34d399;
          padding: 14px;
          font-family: inherit;
          font-size: 0.9rem;
          border-radius: 8px;
          margin-bottom: 12px;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s;
        }
        .hw-input:focus { border-color: #38bdf8; }
        .highlight-input { border-color: #34d399; color: #fff; }

        .hw-btn-primary, .hw-btn-secondary, .hw-btn-confirm, .hw-btn-danger, .hw-btn-ghost, .hw-btn-action-large {
          font-family: inherit;
          font-weight: bold;
          cursor: pointer;
          border: none;
          border-radius: 8px;
          padding: 14px;
          text-transform: uppercase;
          font-size: 0.85rem;
          transition: background 0.2s, transform 0.1s;
        }
        .hw-btn-primary:active, .hw-btn-action-large:active, .hw-btn-confirm:active { transform: translateY(2px); }

        .hw-btn-primary { background: #38bdf8; color: #020617; width: 100%; }
        .hw-btn-secondary { background: #1e293b; color: #cbd5e1; width: 100%; border: 1px solid #334155; }
        .hw-btn-confirm { background: #34d399; color: #020617; width: 100%; }
        .hw-btn-danger { background: #ef4444; color: #fff; width: 100%; }
        .hw-btn-ghost { background: transparent; color: #64748b; text-decoration: underline; width: 100%; margin-top: 5px; }
        .hw-btn-small { background: #334155; color: #fff; padding: 6px 12px; font-size: 0.7rem; border-radius: 6px; cursor: pointer; border: none; }
        
        .hw-btn-action-large {
          background: #1e293b;
          color: #38bdf8;
          border: 1px solid #38bdf8;
          width: 100%;
          margin-top: 15px;
        }
        .hw-btn-action-large:hover { background: #38bdf8; color: #020617; }

        .hw-btn-group { display: flex; gap: 12px; width: 100%; }

        .autonomy-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .autonomy-panel .panel-title { border: none; margin: 0; padding: 0; }
        .autonomy-desc {
          font-size: 0.8rem;
          color: #94a3b8;
          margin: 15px 0 0 0;
          line-height: 1.5;
        }

        .hw-toggle { padding: 8px 16px; border-radius: 6px; font-family: inherit; font-weight: bold; cursor: pointer; border: none; }
        .hw-toggle.on { background: #34d399; color: #000; box-shadow: 0 0 15px rgba(52,211,153,0.3); }
        .hw-toggle.off { background: #1e293b; color: #64748b; border: 1px solid #334155; }

        .dashboard-main {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .sync-banner {
          background: rgba(52, 211, 153, 0.1);
          border: 1px solid rgba(52, 211, 153, 0.3);
          padding: 20px 30px;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #34d399;
          font-weight: bold;
        }

        .dash-link {
          background: #34d399;
          color: #020617;
          padding: 8px 16px;
          border-radius: 6px;
          text-decoration: none;
          font-size: 0.8rem;
        }

        .main-title {
          font-size: 1.2rem;
          color: #f8fafc;
          margin: 10px 0;
          padding-bottom: 10px;
          border-bottom: 1px solid #1e293b;
        }

        .intents-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }

        .hw-intent-card {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
        }

        .intent-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }

        .intent-id {
          background: #1e293b;
          color: #f8fafc;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: bold;
        }

        .intent-network {
          color: #64748b;
          font-size: 0.75rem;
        }

        .intent-body h3 {
          margin: 0 0 10px 0;
          font-size: 1.1rem;
          color: #fff;
        }

        .intent-target {
          margin: 0;
          font-size: 0.8rem;
          color: #94a3b8;
          word-break: break-all;
        }

        .full-loading, .onboarding-full {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 60vh;
          font-size: 1.2rem;
          color: #64748b;
        }

        .onboarding-box {
          background: #0f172a;
          border: 1px solid #1e293b;
          padding: 40px;
          border-radius: 16px;
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .onboarding-box h2 { color: #f8fafc; margin-top: 0; }
        .onboarding-box p { color: #94a3b8; margin-bottom: 30px; font-size: 0.9rem; line-height: 1.5; }

        .hw-empty-large {
          text-align: center;
          padding: 60px 20px;
          background: #0f172a;
          border: 1px dashed #334155;
          border-radius: 12px;
          color: #64748b;
        }
        .empty-icon { font-size: 3rem; display: block; margin-bottom: 15px; opacity: 0.5; }
        .hw-empty-large p { font-size: 1.2rem; font-weight: bold; color: #f8fafc; margin: 0 0 10px 0; }

        .hw-tabs { display: flex; margin-bottom: 20px; border-bottom: 1px solid #334155; }
        .hw-tab { flex: 1; background: none; border: none; color: #64748b; padding: 12px; font-family: inherit; cursor: pointer; font-size: 0.9rem; font-weight: bold; }
        .hw-tab.active { color: #38bdf8; border-bottom: 2px solid #38bdf8; }

        .hw-message { font-size: 0.8rem; text-align: center; margin-bottom: 15px; color: #fbbf24; }
        
        .hw-revealed {
          background: #000;
          padding: 15px;
          border-radius: 8px;
          border: 1px solid #ef4444;
          margin-top: 15px;
        }
        .revealed-label { display: block; color: #ef4444; font-size: 0.7rem; margin-bottom: 5px; font-weight: bold; }
        .hw-key-box { color: #fff; font-size: 0.8rem; word-break: break-all; margin-bottom: 15px; user-select: all; }

        .hw-modal-takeover {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(2,6,23,0.95);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .hw-modal-content {
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 16px;
          padding: 40px;
          max-width: 600px;
          width: 100%;
          box-shadow: 0 20px 50px rgba(0,0,0,0.8);
        }
        .blink-warning { color: #f59e0b; text-align: center; animation: blink 1.5s infinite; margin-top: 0; font-size: 1.5rem; }
        @keyframes blink { 50% { opacity: 0.6; } }
        .modal-subtitle { text-align: center; color: #94a3b8; margin-bottom: 25px; }
        
        .hw-payload-view { 
          background: #000; 
          border: 1px solid #1e293b; 
          border-radius: 8px;
          padding: 20px; 
          height: 250px; 
          overflow-y: auto; 
          font-size: 0.8rem; 
          color: #38bdf8; 
          margin-bottom: 25px; 
        }
        .hw-payload-view::-webkit-scrollbar { width: 6px; }
        .hw-payload-view::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

        .large-input { font-size: 1.2rem; padding: 18px; letter-spacing: 4px; text-align: center; margin-bottom: 25px; }
        .modal-actions { margin-top: 10px; }
      `}</style>
    </div>
  );
}