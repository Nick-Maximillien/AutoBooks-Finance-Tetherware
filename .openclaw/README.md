# OpenClaw Autonomous Finance Engine

**The Deterministic Policy Layer for Autonomous Corporate Liability Signing**

OpenClaw is the **autonomy and governance backbone** of AutoBooks Finance. It operates as a sophisticated policy enforcement engine that enables the AI CFO to **autonomously sign and execute recurring corporate liabilities** without exposing private keys, while maintaining strict deterministic treasury controls.

---

## Architecture Role

### Within AutoBooks Finance

```
┌─────────────────────────────────────────────────────────────┐
│ IFRS_Backend (Django)                                       │
│ - Financial transactions & ledger                           │
│ - Generates signing payloads                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ OpenClaw Policy Engine (.openclaw/)                         │
│ - Agent orchestration (django-brain, wdk-enclave)           │
│ - Deterministic policy validation                           │
│ - Background job scheduling ("While I Sleep")               │
│ - Autonomy governance layer                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Local_Tetherware (Electron → Next.js)                       │
│ - PIN-protected seed phrase decryption                      │
│ - WDK signing engine (/api/sign)                            │
│ - UserOperation generation                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Node Web3 Server (ERC-4337 Bundler Relay)                   │
│ - UserOperation relay to blockchains                        │
│ - Multi-chain transaction broadcasting                      │
│ - Receipt tracking                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
.openclaw/
├── README.md                        # This file
├── openclaw.json                    # Main configuration (policies, agents, bindings)
├── gateway.cmd                      # Windows gateway startup script
│
├── agents/
│   ├── django-brain/               # CFO orchestration agent workspace
│   └── main/                        # Core OpenClaw logic
│
├── cron/
│   ├── jobs.json                   # Background job schedules & payloads
│   └── runs/                        # Historical execution logs
│
├── devices/
│   ├── paired.json                 # Registered signing devices (keystores)
│   └── pending.json                # Devices awaiting pairing
│
├── workspace/
│   ├── IDENTITY.md                 # AI CFO identity configuration
│   ├── SOUL.md                     # Core personality & decision logic
│   ├── HEARTBEAT.md                # Health monitoring
│   ├── AGENTS.md
│   ├── BOOTSTRAP.md
│   ├── TOOLS.md
│   ├── USER.md
│   └── .openclaw/                  # Nested configuration
│
├── identity/                        # Cryptographic identity (unused in demo)
├── canvas/                          # Agent reasoning state
├── logs/                            # Execution logs & audit trail
└── update-check.json                # Version tracking

```

---

## Core Components

### **1. Main Configuration (openclaw.json)**

The master configuration file that ties everything together:

```json
{
  "agents": {
    "list": [
      {
        "id": "django-brain",
        "name": "Django CFO Proxy",
        "role": "financial-orchestrator"
      },
      {
        "id": "wdk-enclave",
        "name": "WDK Deterministic Signer",
        "role": "signing-engine"
      }
    ]
  },
  "policies": {
    "treasury": {
      "deterministic": true,
      "limits": { ... }
    },
    "autonomy": {
      "whileISleep": {
        "enabled": true,
        "backgroundSweeper": true
      }
    }
  },
  "bindings": [
    {
      "source": "django-brain",
      "target": "wdk-enclave",
      "type": "payload-signing"
    }
  ]
}
```

### **2. Deterministic Treasury Policies (openclaw.json → policies)**

All financial controls are **hard-coded**, non-negotiable thresholds:

#### **Daily Recurring Liabilities**
- **Limit**: $50,000 USD per day
- **Purpose**: Cap day-to-day vendor payments and subscriptions
- **Enforcement**: Before each signing, validate total against this window

#### **Vendor Settlement**
- **Per-Transaction Max**: $25,000 USD
- **Purpose**: Prevent single-vendor overpayment
- **Human Approval**: Disabled (deterministic auto-signing)

#### **Payroll Batch (Bi-Weekly)**
- **Per-Cycle Max**: $100,000 USD
- **Schedule**: Every other Friday at 2:00 PM UTC
- **Purpose**: Protect employee salary integrity
- **Auto-Sign**: Enabled

#### **Tax Escrow Fund**
- **Per-Deposit Max**: $75,000 USD
- **Schedule**: Monthly on the 1st at 3:00 AM UTC
- **Purpose**: Auto-fund corporate tax obligations
- **Documentation**: Required (audit trail)

#### **Yield Deployment**
- **Per-Deployment Max**: $50,000 USD
- **Minimum Reserve Ratio**: 25% of cash balance must remain
- **Schedule**: Weekly on Mondays at 4:00 AM UTC
- **Purpose**: Optimize surplus cash yield without jeopardizing operations

---

## "While I Sleep" Background Automation

OpenClaw's signature feature: **Autonomous execution of recurring financial operations** when the human is offline.

### **How It Works**

```
┌─────────────────────────────────────┐
│ OpenClaw Cron Engine                │
│ (Runs continuously in background)   │
└──────────────┬──────────────────────┘
               │
      ┌────────┴────────┐
      │                 │
      ▼                 ▼
  2:00 AM UTC    14:00 UTC (Fridays)
  Recurring      Payroll
  Liabilities    Batch
  Sweeper        Signing
      │                 │
      └────────┬────────┘
               │
      ┌────────▼────────┐
      │ Policy Engine   │
      │ Validates       │
      │ - Amount limits │
      │ - Treasury      │
      │ - Compliance    │
      └────────┬────────┘
               │
               ▼
      ┌────────────────┐
      │ wdk-enclave    │
      │ Agent:         │
      │ Sign & Relay   │
      └────────┬───────┘
               │
      ┌────────▼─────────────┐
      │ Node Web3 Server    │
      │ Broadcast to 10     │
      │ blockchains         │
      └─────────────────────┘
```

### **Configured Background Jobs**

All jobs are defined in `cron/jobs.json`:

| Job ID | Schedule | Purpose | Max Amount | Auto-Sign |
|--------|----------|---------|------------|-----------|
| `recurring-liabilities-sweeper` | Daily 2:00 AM | Vendor payments | $50,000 | ✅ Yes |
| `payroll-scheduler` | Bi-weekly Friday 2:00 PM | Salary disbursements | $100,000 | ✅ Yes |
| `tax-escrow-checker` | Monthly 1st @ 3:00 AM | Tax funding | $75,000 | ✅ Yes |
| `yield-deployment-evaluator` | Weekly Monday 4:00 AM | Surplus cash optimization | $50,000 | ✅ Yes |
| `dividend-payout-scheduler` | Q-end (Mar/Jun/Sep/Dec 15) | Shareholder distributions | Per-vendor limit | ✅ Yes |
| `policy-compliance-audit` | Daily 6:00 AM | Treasury compliance check | N/A | N/A |
| `heartbeat-claware` | Every 5 minutes | Pending signature detection | N/A | N/A |

### **Execution Flow for Recurring Liabilities (2:00 AM UTC)**

1. **Wake**: OpenClaw cron triggers at 2:00 AM
2. **Query**: django-brain queries IFRS_Backend for bills due within 24 hours
3. **Validate**: Check each bill against policy:
   - Is amount ≤ $50,000 daily limit?
   - Is amount ≤ $25,000 per-vendor limit?
   - Is vendor in approved list?
   - Does transaction balance the ledger?
4. **Aggregate**: If multiple bills, combine into single batch_payroll intent
5. **Sign Request**: Send to wdk-enclave: `POST /api/sign` with encrypted seed phrase
6. **Decrypt & Sign**: TetherWare decrypts seed (via pre-shared PIN), generates UserOperation
7. **Relay**: Send signed UserOperation to Node Web3 Server
8. **Broadcast**: Relayer broadcasts to target blockchain (e.g., Celo Sepolia)
9. **Audit**: Log tx hash, amounts, recipients, timestamp to `.openclaw/logs/`
10. **Notify**: Slack alert to `#finance-bot-alerts` with execution summary

---

## Agent Architecture

### **Agent: `django-brain`**

**Role**: Financial Orchestrator & Decision Maker

- **Mode**: Vertex AI LLM with financial domain knowledge
- **Responsibilities**:
  - Analyze ledger state from IFRS_Backend
  - Determine which recurring liabilities are due
  - Validate policy compliance
  - Generate transaction payloads
  - Make autonomous signing decisions
- **Policy Enforcement**: Enforces all treasury limits before requesting signatures

### **Agent: `wdk-enclave`**

**Role**: Deterministic Signing Engine

- **Mode**: Stateless signer (no reasoning, pure cryptography)
- **Responsibilities**:
  - Receive validated payload from django-brain
  - Decrypt PIN-protected seed phrase
  - Initialize WDK wallet for target chain
  - Generate ERC-4337 UserOperation
  - Sign with deterministic ECDSA (EIP-712)
  - Return signed UserOperation
- **Security**: Never stores keys; only stores encrypted keystore reference
- **Network**: Isolated to Local_Tetherware Electron process (air-gapped)

### **Binding: django-brain → wdk-enclave**

```json
{
  "id": "django-to-wdk",
  "source": "django-brain",
  "target": "wdk-enclave",
  "type": "payload-signing",
  "contractPath": "/api/sign"
}
```

---

## Policy Enforcement Mechanisms

### **Hierarchical Validation**

```
Transaction Request
        │
        ▼
┌──────────────────────────────┐
│ 1. Amount Limits             │
│ - Single tx ≤ $25k vendor?   │
│ - Daily total ≤ $50k?        │ ← FAIL → Reject & Alert
└──────────────────────────────┘
        │✅
        ▼
┌──────────────────────────────┐
│ 2. Network Compliance        │
│ - Approved chain?            │
│ - RPC available?             │ ← FAIL → Reject & Alert
└──────────────────────────────┘
        │✅
        ▼
┌──────────────────────────────┐
│ 3. Ledger Integrity          │
│ - DR = CR?                   │
│ - Account codes valid?       │ ← FAIL → Reject & Alert
└──────────────────────────────┘
        │✅
        ▼
┌──────────────────────────────┐
│ 4. Reconciliation            │
│ - Vendor address valid?      │
│ - Escrow sufficiency check?  │ ← FAIL → Reject & Alert
└──────────────────────────────┘
        │✅
        ▼
  PROCEED TO SIGNING
```

### **Deterministic vs. Discretionary**

- **Deterministic** (hard limits, immutable):
  - Treasury thresholds ($50k daily, $25k per-vendor)
  - Network whitelists (10 chains only)
  - Minimum reserve ratios (25% cash)
  - Account code mappings
  
- **Discretionary** (AI reasoning, changeable):
  - Whether to deploy yield (depends on opportunistic analysis)
  - Optimal chain selection based on gas
  - Dividend distribution timing (within Q window)

---

## Autonomous Permission Model

### **No Private Key Exposure**

The AI CFO **never sees the private key**:

```
AI Agent (django-brain)
    │
    └─→ "Please sign this payload"
            │
            ▼
       PIN-Protected Enclave (wdk-enclave)
            │
            ├─→ Decrypt seed with PIN
            │   (PIN = organizational secret, not in code)
            │
            ├─→ Generate UserOperation
            │
            ├─→ Sign with ECDSA
            │
            └─→ Return signed UserOp to AI
                (Private key destroyed after signing)
```

### **Signing Authority Chain**

```
AI CFO Decision
   │ (Is it within policy limits?)
   │
   ▼
Treasury Policy Engine
   │ (Validate against hard limits)
   │
   ▼
Blockchain Account Abstraction (ERC-4337)
   │ (EntryPoint validates signature)
   │
   ▼
Smart Account (Safe)
   │ (Execute transaction)
   │
   ▼
2. Blockchain (Celo, Ethereum, etc.)
```

---

## Configuration Files Deep Dive

### **openclaw.json Structure**

```javascript
{
  "meta": {
    "projectId": "autobooks-finance-tetherware",
    "projectName": "AutoBooks Finance - TetherWare Enclave"
  },
  "agents": {
    "defaults": {
      "workspace": "C:\\Users\\zico\\.openclaw\\workspace"
    },
    "list": [
      // Agent definitions
    ]
  },
  "tools": {
    "signing": {
      "enabled": true,
      "backend": "wdk",
      "keystorePath": "C:\\...\\Local_Tetherware\\.claware_keystore"
    },
    "blockchain": {
      "supportedChains": [
        "ethereum-sepolia",
        "base-sepolia",
        // ... 10 chains total
      ]
    }
  },
  "policies": {
    "treasury": {
      "deterministic": true,
      "limits": {
        "daily_recurring_liabilities": { "threshold": 50000 },
        "vendor_settlement": { "maxPerTransaction": 25000 },
        "payroll_batch": { "maxPerCycle": 100000 },
        "tax_escrow": { "maxPerDeposit": 75000 },
        "yield_deployment": { "maxPerDeployment": 50000 }
      }
    },
    "autonomy": {
      "whileISleep": {
        "enabled": true,
        "backgroundSweeper": true,
        "patterns": ["0 2 * * *", "0 14 * * *"]
      }
    }
  },
  "paths": {
    "keystoreDir": "C:\\...\\Local_Tetherware",
    "backendDir": "C:\\...\\IFRS_Backend",
    "nodeServerDir": "C:\\...\\Node_Web3_Server",
    "frontendDir": "C:\\...\\Frontend-UI"
  }
}
```

### **cron/jobs.json Structure**

Each job defines:

```javascript
{
  "id": "unique-job-id",
  "agentId": "django-brain",        // Which agent runs it
  "name": "Display Name",
  "enabled": true,
  "isPolicyEnforced": true,         // Validate against policies
  "schedule": {
    "kind": "cron",
    "expression": "0 2 * * *",      // 2:00 AM UTC daily
    "timezone": "UTC"
  },
  "sessionTarget": "isolated",      // Run in isolated LLM context
  "wakeMode": "scheduled",          // Wake on schedule (not on-demand)
  "payload": {
    "kind": "agentTurn",
    "action": "process_recurring_liabilities",
    "message": "Human-readable instruction for the AI agent",
    "context": {
      "policyKey": "autonomy.recurringLiabilities",
      "maxDailyAmount": 50000
    }
  },
  "delivery": {
    "mode": "slack",                // Send Slack notification
    "channel": "finance-bot-alerts"
  }
}
```

---

## Integration Points

### **1. IFRS_Backend ↔ OpenClaw**

IFRS_Backend calls OpenClaw when transactions are ready for autonomous signing:

```python
# app/views.py (Django)
from openclaw import PolicyEngine

engine = PolicyEngine(config_path=".openclaw/openclaw.json")

# Check if recurring bill should auto-sign
if engine.validate_policy("daily_recurring_liabilities", amount=15000):
    # Safe to sign this vendor bill
    response = engine.request_signing(
        agent="wdk-enclave",
        payload=build_settle_bill_intent(vendor, amount, network)
    )
```

### **2. OpenClaw ↔ Local_Tetherware**

OpenClaw's wdk-enclave agent submits signing requests to TetherWare's `/api/sign` endpoint:

```javascript
// .openclaw/agents/wdk-enclave workflow
POST http://localhost:3000/api/sign
Content-Type: application/json
{
  "encryptedSeed": "U2FsdGVkX1...",  // From .claware_keystore
  "pin": "organizational-pin-secret",
  "rawPayload": {
    "intent": "settle-bill",
    "network": "celo-sepolia",
    "transactions": [...]
  },
  "action": "sign"
}
```

### **3. Local_Tetherware ↔ Node Web3 Server**

After signing, TetherWare relays to Node Web3 Server:

```javascript
// Local_Tetherware /api/sign/route.ts
await fetch("https://node-web3-server.onrender.com/web3/settle-bill", {
  method: "POST",
  body: JSON.stringify({
    signed_payload: finalUserOp,
    is_user_op: true,
    network_rpc: "https://forno.celo-sepolia.celo-testnet.org"
  })
});
```

---

## Security Model

### **Threat Model**

| Threat | Mitigation | Owner |
|--------|-----------|-------|
| Private key exposure | Key locked in PIN-protected keystore, AI never sees it | wdk-enclave |
| Policy bypass | Hard-coded limits in openclaw.json, immutable at runtime | OpenClaw Policy Engine |
| unauthorized signing | Each tx requires policy validation AND cryptographic signature | django-brain + wdk-enclave |
| Backend compromise | Signing happens locally in air-gapped enclave | Local_Tetherware |
| Relay tampering | Signed UserOp validated by EntryPoint on-chain | ERC-4337 |
| Clock skew attacks | validAfter/validUntil timestamps encoded in signature | EIP-712 |

### **Key Derivation**

```
Organizational Secret (PIN)
  │
  ├─→ Decrypt seed phrase (from .claware_keystore)
  │
  ├─→ Generate wallet hierarchy (BIP44)
  │
  └─→ Derive:
      ├─ EOA signer address (0x...)
      └─ ERC-4337 smart account (Safe proxy)
```

---

## Monitoring & Audit

### **Log Locations**

| Log | Path | Contents |
|-----|------|----------|
| Job executions | `.openclaw/cron/runs/` | Timestamps, statuses, errors |
| Policy violations | `.openclaw/logs/policy_violations.log` | Rejected transactions with reasons |
| Signed transactions | `.openclaw/logs/signed_tx_audit.log` | All signed UOs with timestamp, amount, recipient |
| Agent decisions | `.openclaw/canvas/` | Agent reasoning traces (LLM context) |

### **Slack Notifications**

OpenClaw sends real-time updates to configured Slack channels:

- `#finance-bot-alerts` → Recurring liabilities execution
- `#payroll-automation` → Payroll batches signed
- `#tax-automation` → Tax escrow funding
- `#treasury-optimization` → Yield deployments
- `#compliance-alerts` → Policy violations

---

## Troubleshooting

### **Job Failed to Execute**

1. Check `.openclaw/cron/runs/` for error logs
2. Verify Local_Tetherware is running (`http://localhost:3000`)
3. Check PIN configuration in IFRS_Backend
4. Verify WDK package version in Local_Tetherware/package.json

### **"Policy Limit Exceeded" Error**

The transaction amount exceeds the daily/per-transaction limit. Options:
- Split transaction into smaller batches
- Request manual approval (future feature)
- Adjust policy limit (requires openclaw.json edit + restart)

### **Signature Mismatch**

EntryPoint accepted UserOp but signature validation failed:
1. Verify seed phrase is correct (re-derive if needed)
2. Check chain RPC is responding
3. Verify Account Abstraction EntryPoint address in Local_Tetherware/app/api/sign/route.ts

### **Keystore Not Found**

`.claware_keystore` file missing or path incorrect:

```bash
# Verify file exists
test -f C:\Users\zico\Desktop\tether\AutoBooks-Finance-Tetherware\Local_Tetherware\.claware_keystore

# If missing, regenerate from backend
curl -X PUT http://localhost:8000/api/keystore/derive \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"mnemonic":"..."}'
```

---

## Performance Tuning

### **Cron Job Timing**

Default schedule spacing avoids collisions:

```
00:00 ─────────────────────── Start of day (UTC)
  │
02:00 ─→ Recurring Liabilities
  │
03:00 ─→ Tax Escrow Checker
  │
04:00 ─→ Yield Deployment Evaluator
  │
06:00 ─→ Policy Compliance Audit
  │
14:00 ─→ Payroll Scheduler (Fridays only)
```

To adjust timing, edit `cron/jobs.json` → `schedule.expression` (CRON format).

---

## Roadmap

### **Planned Features**

- **Multi-Sig Support**: Require 2-of-3 agent signatures for high-value txs
- **Manual Approval Gateway**: Require human sign-off for txs near policy limits
- **Dynamic Policy Updates**: Adjust treasury limits based on quarterly performance
- **Dividend Scheduling**: Auto-distribute profits at Q-end based on shareholder records
- **Cross-Chain Briging**: Optimize liquidity across 10-chain treasury

---

## Support

For OpenClaw configuration issues:
- Check `openclaw.json` syntax (must be valid JSON)
- Review `cron/jobs.json` for schedule expressions
- Check Local_Tetherware HTTP connectivity
- Verify IFRS_Backend Django API is responding

For signing failures:
- Verify PIN is correct
- Check `.claware_keystore` file permissions
- Review Local_Tetherware console logs

---

## License

OpenClaw is part of the **AutoBooks Finance** proprietary system. All deterministic policies and autonomous signing capabilities are trade secrets.
