# AutoBooks Finance: IFRS-Compliant Blockchain Treasury System

A **non-custodial AI finance agent** that reads real-world financial documents and autonomously settles them on-chain using Tether WDK and OpenClaw. The architecture separates concerns into four specialized services: financial accounting engine with AI document processing, deterministic ledger operations, local air-gapped signing infrastructure, and stateless blockchain transaction relaying.

## Live Deployments 

| Service | Infrastructure | Live URL |
|---------|----------------|----------|
| **Frontend UI** | Vercel | [autobooks-frontend.vercel.app](https://autobooks-frontend.vercel.app) |
| **IFRS Backend** | GCP Cloud Run + Cloud SQL | [autobooks-backend-571147915643.us-central1.run.app](https://autobooks-backend-571147915643.us-central1.run.app) |
| **Node Web3 Relayer**| Render | [node-web3-server.onrender.com](https://node-web3-server.onrender.com) |
| **Local Tetherware** | Local OS / Desktop | *Requires Local Build (Electron)* |

## System Overview

AutoBooks Finance operates as an integrated pipeline for financial document to blockchain execution:

```
User Input (Documents, Transactions)
         ↓
   [Frontend-UI: Dashboard & AI Ingestion]
         ↓
[IFRS_Backend: Validation & Double-Entry Ledger]
         ↓
[Local_Tetherware: Secure Local Signing]
         ↓
[Node_Web3_Server: Blockchain Execution]
         ↓
   Final Settlement (On-Chain)
```

### Core Data Flows

1. **Financial Document Ingestion**: Users submit invoices, receipts, and statements via Frontend-UI. Google Vertex AI extracts and auto-classifies documents. IFRS_Backend validates and posts to ledger.

2. **Real-Time Financial Reporting**: Retrieve balance sheet, P&L, and cash flow via REST API. Supports multiple financial periods with automatic period closing.

3. **Web3 Signing Pipeline**: IFRS_Backend generates transaction intents. Local_Tetherware signs locally via PIN-protected enclave. Node_Web3_Server broadcasts to blockchain.

4. **Conversational Finance**: WhatsApp and web chat interfaces allow voice commands (close period, request liquidity, approve bills) routed through AI agent with access to full financial ledger.

## Architecture Components

### [Frontend-UI](./Frontend-UI)
**Next.js 15 + React 19 web dashboard and document ingestion**

- **Vision-Based Document Processing**: Upload invoices/receipts → Google Vertex AI extracts text/tables/amounts → UI Navigator displays for confirmation
- **Real-Time Financial Dashboard**: 
  - Balance sheet (live account balances)
  - P&L statement (income vs. expenses)
  - Cash flow tracking
  - Journal entry view with filtering
- **Multi-Document Ingestion**: Auto-classification as invoices, bills, receipts, asset purchases
- **Authentication**: JWT tokens via AuthContext
- **Blockchain Integration**: Monitor treasury positions via ethers.js
- **Data Export**: Download financial statements as PDF/Excel

**Tech Stack**: 
- Next.js 15.2.8, React 19, TypeScript 5
- Tailwind CSS 4.0 for styling
- Ethers.js 6 for Web3 integration
- Axios for REST API calls
- Recharts for financial charting
- Google Vertex AI integration for document analysis

---

### [IFRS_Backend](./IFRS_Backend)
**Django 5 REST API implementing IFRS for SMEs (2025 Third Edition) compliance engine**

**Core Responsibilities**:
- **Double-Entry Ledger**: Enforce debits = credits invariant atomically
- **Chart of Accounts**: 60+ IFRS-mapped accounts (Assets, Liabilities, Equity, Income, Expense)
- **Financial Calculations**: 
  - Depreciation (straight-line & reducing-balance methods)
  - Asset impairment testing
  - Tax calculations
  - Period closing with automatic P&L transfer to Retained Earnings
- **Document Processing with AI**:
  - Google Vertex AI auto-extracts from PDFs/images
  - Deterministic ownership verification (prevents posting wrong entity's docs)
  - LLM-based document type classification
  - Multi-layer validation gates
- **Real-Time Financial APIs**:
  - Balance Sheet, P&L, Cash Flow endpoints
  - Manual adjustments (depreciation, accruals)
  - Journal entry posting
  - Transaction reversal (creates reversing entries)
- **Conversational Agent** (WhatsApp/Web Chat):
  - Voice command processing via Google Gemini
  - Financial query tools: get balance sheet, request liquidity, settle bills, execute payroll
  - Autonomous transaction signing (with user approval)
  - Real-time updates via Text-to-Speech responses

**Key Models**:
- `BusinessProfile` - Company entity with financial year config
- `FinancialPeriod` - Accounting periods (open/closed state)
- `Account` - Chart of accounts with running balance
- `Transaction` - Ledger transactions (DRAFT/POSTED/PENDING_SIGNATURE status)
- `JournalEntry` - Double-entry records (debit/credit pairs)
- `Document` - Ingested invoices/receipts with AI extraction
- `FixedAsset` - PP&E with depreciation schedules
- `Shareholder` - Equity holders for dividend distribution

**Deployment Architecture**:
- Django 5.2.7 with Gunicorn WSGI server
- PostgreSQL 15 (Docker containerized)
- Redis 7 for Celery task queue
- Celery workers for async document processing
- Google Cloud Run compatible

**Tech Stack**:
- Django 5.2, DRF 3.16
- PostgreSQL 15, Redis 7
- Celery 5.5 for async tasks
- Google Vertex AI (genai library) + Text-to-Speech API
- Stripe + Twilio (WhatsApp)
- web3.py, eth-account for blockchain integration
- Pandas + ReportLab for Excel/PDF export

---

### [Local_Tetherware](./Local_Tetherware)
**Electron desktop application with local air-gapped signing enclave**

**Purpose**: Secure, offline-capable private key management where signing happens locally, never exposing keys to backend.

**Key Capabilities**:
- **Air-Gapped Signing**: Private keys stored locally (IndexedDB with AES-256-GCM encryption)
- **PIN-Protected Access**: Decrypt seed phrases only when signing
- **Multi-Chain Support**: Handles transactions across 10 EVM chains (Ethereum, Base, Arbitrum, Polygon, Optimism, Avalanche, Celo, Linea, Scroll, Blast)
- **Autonomous Signing**: OpenClaw deterministic approval policies
- **Transaction Intent Processing**: Receives unsigned intents from IFRS_Backend, signs them, broadcasts via Node_Web3_Server
- **USDT Treasury Monitoring**: Real-time balance queries across chains
- **Web2 Identity Binding**: Link desktop enclave to Django user account

**Architecture**:
- Electron wrapper around Next.js 15
- Internal HTTP server (port 3000) runs locally for offline operation
- `/api/sign` route handles cryptographic signing via WDK
- IndexedDB for encrypted key storage
- Automatic key export/import with encrypted backup

**Tech Stack**:
- Electron 30.0 desktop framework
- Next.js 15.2.8 renderer
- TypeScript + Tailwind CSS
- @tetherto/wdk-wallet-evm-erc-4337 (TetherTo Wallet SDK)
- ethers.js 6 for chain interactions
- CryptoJS for client-side encryption

---

### [Node_Web3_Server](./Node_Web3_Server)
**Express.js stateless relay service for blockchain transaction execution**

**Purpose**: Convert signed transaction payloads into blockchain-executable operations and broadcast to ERC-4337 bundlers.

**Core Responsibilities**:
- **Multi-Chain Routing**: Route transactions to correct RPC endpoint/bundler (10 supported EVM chains)
- **UserOperation Construction**: Build ERC-4337 UserOps with proper gas estimates
- **Bundler Coordination**: Submit to Pimlico/Stackup/Alchemy bundler networks
- **Transaction State Tracking**: Monitor on-chain confirmation and relay status back to frontend
- **USDT Transfer Handling**: ERC-20 transfer encoding and execution
- **Gasless Execution**: Leverages account abstraction for zero-gas user experience (optional sponsor handles gas)

**API Endpoints**:
- `POST /encode-intent` - Prepare unsigned transaction payload
- `POST /submit-transaction` - Broadcast signed txn to BlockChain
- `GET /get-balance` - Query USDT balance across chains
- `GET /get-gas-price` - Estimate current network fees

**Configuration**:
- Environment variables for:
  - `MASTER_MNEMONIC` - HD wallet for signing operations
  - `ALLOWED_ORIGIN` - CORS whitelist
  - `THIRDWEB_SECRET_KEY` - AA infrastructure credentials
  - Chain RPC endpoints and bundler addresses

**Tech Stack**:
- Express.js 5.1 (Node.js HTTP server)
- ethers.js 6.15 for blockchain interaction
- Thirdweb SDK 5.119 for ERC-4337 account abstraction
- CORS-enabled for frontend communication

---

## System Integration

### Request Flow: "Post an Invoice"

```
1. User uploads invoice PDF
        ↓
2. Frontend-UI → Google Vertex AI
   (Extract invoice details)
        ↓
3. Frontend-UI → IFRS_Backend POST /documents/
   (Validate and store)
        ↓
4. IFRS_Backend runs deterministic ownership check
   (Verify invoice belongs to this business)
        ↓
5. If valid → Auto-post to double-entry ledger
   Creates: DR [Accounts Receivable] = CR [Revenue]
        ↓
6. Ledger updated atomically in PostgreSQL
   Account balances recalculated
```

### Request Flow: "Close Financial Year"

```
1. User says "close the year" via WhatsApp
        ↓
2. Message → IFRS_Backend WhatsApp webhook
        ↓
3. Google Gemini AI processes command
   (Recognizes close_financial_period intent)
        ↓
4. IFRS_Backend computes:
   - Depreciation on all fixed assets
   - Net profit/loss for period
   - Tax provisions
        ↓
5. Posts closing entries atomically:
   - DR [Income] = CR [Retained Earnings]
   - Records depreciation expense
        ↓
6. Marks financial period as CLOSED
   Opens new period for next year
```

### Request Flow: "Pay a Vendor Bill"

```
1. User initiates bill payment in Local_Tetherware
        ↓
2. IFRS_Backend generates unsigned transaction intent:
   "Transfer 500 USDT to vendor_wallet on Celo chain"
        ↓
3. Local_Tetherware downloads intent
   Displays details: "Pay vendor X 500 USDT?"
        ↓
4. User enters PIN → Enclave decrypts seed phrase
        ↓
5. WDK Wallet signs transaction locally
   (No key leaves the machine)
        ↓
6. Signed UserOp → Node_Web3_Server
        ↓
7. Node_Web3_Server constructs full UserOp
   Submits to Pimlico bundler on Celo
        ↓
8. Bundler includes in batch → mints on-chain
   IFRS_Backend marks as POSTED (immutable)
```

## Getting Started

### Prerequisites

- **All services**: Docker & Docker Compose (recommended)
- **Frontend-UI**: Node.js 18+, npm/yarn
- **IFRS_Backend**: Python 3.11+, PostgreSQL 15+, Redis 7+
- **Local_Tetherware**: Node.js 16+, Electron build environment
- **Node_Web3_Server**: Node.js 16+, blockchain RPC endpoints

### Quick Setup

#### 1. Clone and Install

```bash
git clone <repo-url>
cd AutoBooks-Finance-Tetherware

# Frontend
cd Frontend-UI && npm install && cd ..

# Backend
cd IFRS_Backend && pip install -r requirements.txt && cd ..

# Desktop
cd Local_Tetherware && npm install && cd ..

# Web3
cd Node_Web3_Server && npm install && cd ..
```

#### 2. Environment Configuration

Create `.env` files in each service:

**IFRS_Backend/.env**:
```
GOOGLE_APPLICATION_CREDENTIALS=/path/to/gcp-key.json
GCP_PROJECT_ID=your-project-id
DATABASE_URL=postgresql://user:password@localhost:5432/autobooks
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-django-secret-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
STRIPE_API_KEY=your-stripe-key
```

**Node_Web3_Server/.env**:
```
MASTER_MNEMONIC=your-wallet-seed-phrase
ALLOWED_ORIGIN=http://localhost:3000
THIRDWEB_SECRET_KEY=your-thirdweb-key
```

#### 3. Start Services

```bash
# Backend (Docker Compose)
cd IFRS_Backend && docker-compose up -d

# Frontend (dev server)
cd Frontend-UI && npm run dev

# Desktop
cd Local_Tetherware && npm start

# Web3 Relay
cd Node_Web3_Server && npm start
```

## Key Design Principles

### 1. Determinism
All account validation and transaction logic is deterministic:
- Same input → Same output across all instances
- Enables reproducible audit trails
- Reliable blockchain synchronization

### 2. Separation of Concerns
Each service owns its domain:
- **Frontend-UI**: Presentation & user interaction
- **IFRS_Backend**: Financial logic & ledger state
- **Local_Tetherware**: Key management & local signing  
- **Node_Web3_Server**: Blockchain integration (stateless relay)

### 3. Non-Custodial Architecture
Private keys never leave the Local_Tetherware enclave:
- IFRS_Backend has zero access to cryptographic material
- Frontend-UI cannot sign on its own
- Only signed transactions reach blockchain

### 4. IFRS Compliance
All account hierarchies conform to IFRS for SMEs (2025):
- Ensures regulatory alignment
- Cross-system consistency
- Proper deferred taxation and provisioning

### 5. AI-Augmented Finance
Google Vertex AI enables:
- Intelligent document classification (invoice vs. bill vs. expense)
- Automatic field extraction (amounts, vendors, dates)
- Conversational financial queries (WhatsApp voice commands)
- Autonomous approval workflows

## API Documentation

### Frontend-UI ↔ IFRS_Backend

**REST API Base URL**: `http://localhost:8000/api/`

**Key Endpoints**:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/signup/` | User registration |
| POST | `/auth/token/` | Get JWT access token |
| GET | `/business/profile/` | Get company info |
| POST | `/documents/` | Upload and ingest document |
| GET | `/documents/` | List documents |
| POST | `/documents/{id}/post/` | Post document to ledger |
| GET | `/balance-sheet/` | Get balance sheet (current period) |
| GET | `/pnl/` | Get profit & loss statement |
| GET | `/cashflow/` | Get cash flow statement |
| GET | `/journal-entries/` | Get all journal entries |
| POST | `/transactions/` | Create manual transaction |
| GET | `/financial-periods/` | List periods |
| POST | `/financial-periods/{id}/close/` | Close period (year-end) |
| POST | `/manual-adjustment/` | Post depreciation/adjustment |

**Authentication**: JWT Bearer token in `Authorization` header

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/balance-sheet/
```

### IFRS_Backend ↔ Local_Tetherware

**IPC/HTTP via local socket** or HTTP on `http://localhost:8000/api/web3/`

**Endpoints**:
- `GET /api/web3/signing-intent/{doc_id}/` - Get unsigned transaction
- `POST /api/web3/sign-receipt/` - Submit signed transaction hash

### Node_Web3_Server API

**Base URL**: `http://localhost:4000/`

**Endpoints**:

```bash
# Encode transaction
POST /encode-intent
{
  "chainId": "42161",
  "recipientWallet": "0x...",
  "amountUsdt": "500.00"
}

# Submit signed transaction
POST /submit-transaction
{
  "signedTx": "0x...",
  "chainId": "42161"
}

# Get balance
GET /get-balance?wallet=0x...&chainId=42161

# Get gas price
GET /get-gas-price?chainId=42161
```

## Security Considerations

1. **Key Management**:
   - Private keys isolated in Local_Tetherware only
   - Never log or transmit seed phrases
   - Use AES-256-GCM encryption for storage

2. **API Authentication**:
   - JWT tokens expire after configurable duration
   - Refresh tokens for session extension
   - HTTPS required in production

3. **Database Security**:
   - PostgreSQL behind private network
   - Use parameterized queries (Django ORM)
   - Enable row-level security for multi-tenancy

4. **Blockchain Security**:
   - Validate gas estimates before signing
   - Check recipient addresses against whitelist
   - Rate-limit transaction submissions

5. **Audit Logging**:
   - All financial operations logged with user ID
   - Immutable transaction records in PostgreSQL
   - Monitor for anomalous access patterns

## Deployment

### Live Environments

- **Frontend-UI**: Hosted on **Vercel** ([Link](https://autobooks-frontend.vercel.app))
- **IFRS_Backend**: Hosted on **Google Cloud Run** with **Cloud SQL** for PostgreSQL ([Link](https://autobooks-backend-571147915643.us-central1.run.app))
- **Node_Web3_Server**: Hosted on **Render** ([Link](https://node-web3-server.onrender.com))
- **Local_Tetherware**: Runs locally on the user's host machine as a hardened Electron app.

### Production Checklist

- [x] Configure GCP project and Vertex AI API access
- [x] Set up PostgreSQL 15+ with Cloud SQL backups
- [x] Deploy IFRS_Backend to Google Cloud Run
- [x] Deploy Node_Web3_Server as a Render Web Service
- [x] Deploy Frontend-UI to Vercel
- [ ] Deploy Redis cluster for Celery (Optional for full-scale async)
- [ ] Configure Stripe and Twilio accounts
- [ ] Set up monitoring (Sentry, CloudWatch, Datadog)
- [ ] Distribute Local_Tetherware desktop app via signed installer

### Docker Deployment

```bash
cd IFRS_Backend
docker-compose -f docker-compose.yaml up -d

# Verify
docker ps  # Should show Django, PostgreSQL, Redis containers
docker logs -f <container_id>
```

## Monitoring & Logging

- **Frontend-UI**: Browser console + Vercel Analytics
- **IFRS_Backend**: Django logging + Flower (Celery monitoring) at `http://localhost:5555`
- **Local_Tetherware**: Electron main/renderer logs in `~/.config/Tetherware/logs/`
- **Node_Web3_Server**: Node.js console logs + structured JSON logging

## File Structure

```
AutoBooks-Finance-Tetherware/
├── Frontend-UI/              # Next.js 15 web dashboard
│   ├── src/app/              # Next.js app router
│   ├── src/components/       # React components
│   ├── src/context/          # Authentication context
│   ├── package.json
│   └── README.md
├── IFRS_Backend/             # Django accounting engine
│   ├── app/                  # Core Django app
│   ├── autobooks/            # Django project settings
│   ├── requirements.txt
│   ├── docker-compose.yaml
│   └── README.md
├── Local_Tetherware/         # Electron signing enclave
│   ├── src/app/              # Next.js renderer
│   ├── main.js               # Electron main process
│   ├── package.json
│   └── README.md
├── Node_Web3_Server/         # Express.js blockchain relay
│   ├── index.js              # Main server
│   ├── package.json
│   └── README.md
└── README.md                 # This file
```

## Contributing

Please ensure all code changes:
1. Maintain deterministic output for financial operations
2. Include unit tests with >80% coverage
3. Follow IFRS for SMEs standards
4. Document API changes in respective README

## License

Proprietary - AutoBooks Finance (Tetherware)

## Testing

Each service includes test suites:

- **Frontend-UI**: Jest and React Testing Library
- **IFRS_Backend**: Django test framework with pytest integration
- **Local_Tetherware**: Electron unit and integration tests
- **Node_Web3_Server**: Jest-based transaction validation tests

Run tests in each service directory with the respective test command (see individual READMEs).

## Performance Characteristics

- **Ledger Operations**: PostgreSQL queries typically sub-100ms
- **Transaction Validation**: IFRS rule checks complete within 50-200ms
- **Blockchain Submission**: UserOperation bundling and submission within 2-5 seconds
- **UI Responsiveness**: Dashboard updates within 100-300ms of transaction posting

## Dependencies and Licenses

See `requirements.txt` (backend) and `package.json` (frontend, enclave, relayer) files for detailed dependency lists and versions.

## Governance and Changes

Significant architectural changes, including modifications to:
- IFRS account hierarchies
- Transaction validation rules
- Key management procedures
- Blockchain integration patterns

...should be documented in change logs and may require multi-stakeholder review before deployment.

## Support and Documentation

Detailed documentation for each service is available in their respective README.md files:
- [Frontend-UI/README.md](./Frontend-UI/README.md)
- [IFRS_Backend/README.md](./IFRS_Backend/README.md)
- [Local_Tetherware/README.md](./Local_Tetherware/README.md)
- [Node_Web3_Server/README.md](./Node_Web3_Server/README.md)

## Version Information

- **System Version**: 1.0.0 (Initial Release)
- **IFRS Framework**: IFRS for SMEs Third Edition 2025
- **Node.js Minimum**: 16.x
- **Python Minimum**: 3.11
- **Last Updated**: March 2026
