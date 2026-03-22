# AutoBooks Finance: IFRS-Compliant Blockchain Treasury System

A modular, production-grade system integrating IFRS-compliant accounting with non-custodial blockchain treasury management. The architecture separates concerns into four specialized services: financial data ingestion and validation, deterministic ledger operations, local signing infrastructure, and blockchain transaction execution.

## System Overview

AutoBooks Finance operates as an integrated pipeline:

```
User Input (Documents, Transactions)
         ↓
   [Frontend-UI: Dashboard & Ingestion]
         ↓
[IFRS_Backend: Validation & Double-Entry Ledger]
         ↓
[Local_Tetherware: Key Management & Signing]
         ↓
[Node_Web3_Server: Blockchain Execution]
         ↓
   Final Settlement (On-Chain)
```

### Data Flow

1. **Ingestion**: Users submit financial documents and transaction requests through the Frontend-UI.
2. **Validation**: The IFRS_Backend applies deterministic IFRS rules, validates double-entry integrity, and maintains the authoritative ledger.
3. **Enclave Processing**: Local_Tetherware receives validated transactions, applies local key security protocols, and orchestrates signatures via Tether WDK.
4. **Blockchain Execution**: Node_Web3_Server constructs and submits UserOperations to blockchain bundlers for finalization.

## Architecture Components

### [Frontend-UI](./Frontend-UI)
**Next.js-based dashboard and ingestion layer**
- Document upload and vision-based ingestion via UI Navigator
- Real-time transaction display and financial reporting
- Conversational finance interface with RAG capabilities
- Blockchain treasury status monitoring
- Dashboard components for balance sheet, P&L, and cash flow views

**Tech Stack**: Next.js 15, React 19, TypeScript, Tailwind CSS, ethers.js

---

### [IFRS_Backend](./IFRS_Backend)
**Django-based double-entry accounting engine**
- IFRS for SMEs (2025 Third Edition) compliance framework
- Deterministic account validation and transaction posting
- Multi-document auto-classification using LLM intelligence
- Audit trail with immutable journal entries
- Financial statement generation (Balance Sheet, P&L, Cash Flow)
- REST API for all accounting operations

**Tech Stack**: Django 5.2, PostgreSQL, Celery, Redis, Google Gemini AI

---

### [Local_Tetherware](./Local_Tetherware)
**Electron-based local signing enclave**
- Non-custodial private key management
- Tether WDK signature orchestration
- OpenClaw integration for autonomous execution workflows
- Deterministic audit gates for transaction authorization
- Air-gapped key operations with secure inter-process communication

**Tech Stack**: Electron, Node.js, Tether WDK, OpenClaw

---

### [Node_Web3_Server](./Node_Web3_Server)
**Node.js-based blockchain relayer**
- ERC-4337 Account Abstraction support
- UserOperation construction and validation
- Blockchain bundler integration
- Multi-chain transaction routing
- Real-time transaction state tracking

**Tech Stack**: Node.js, ethers.js v6, Express, ERC-4337 standards

---

## System Requirements

### Frontend-UI
- Node.js 18+
- npm or yarn package manager
- Environment variables for backend URLs and authentication

### IFRS_Backend
- Python 3.11+
- PostgreSQL 15+
- Redis 7+ (for Celery task queue)
- Docker (recommended for containerized deployment)

### Local_Tetherware
- Node.js 16+
- Electron (build target)
- Tether WDK access credentials
- OpenClaw environment configuration

### Node_Web3_Server
- Node.js 16+
- Blockchain RPC endpoints
- Bundler service credentials

## Getting Started

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/AutoBooks-Finance-Tetherware.git
   cd AutoBooks-Finance-Tetherware
   ```

2. **Set up environment configuration**:
   Each service requires environment variables. See the individual README files for detailed configuration instructions.

3. **Start services individually** (see respective README files):
   - Frontend-UI development server
   - IFRS_Backend Django application
   - Local_Tetherware Electron application
   - Node_Web3_Server Node process

### Docker Deployment

The IFRS_Backend includes Docker configuration:

```bash
cd IFRS_Backend
docker-compose up
```

This starts PostgreSQL, Redis, and the Django application in containerized environments.

## Key Design Principles

### Determinism
All account validation and transaction logic is deterministic. Given the same input state and transaction, the system always produces the same output. This enables:
- Reproducible audit trails
- Consistent financial reporting across instances
- Reliable blockchain state synchronization

### Separation of Concerns
Each service owns its domain:
- **Frontend-UI**: User interaction and presentation
- **IFRS_Backend**: Financial logic and ledger state
- **Local_Tetherware**: Key management and signing
- **Node_Web3_Server**: Blockchain integration

### Non-Custodial Architecture
Private keys remain under user control within the Local_Tetherware enclave. The IFRS_Backend and Frontend-UI never access cryptographic material directly.

### IFRS Compliance
All account hierarchies, measurement rules, and reporting structures conform to IFRS for SMEs (2025 Third Edition). This ensures:
- Regulatory alignment
- Cross-system financial statement consistency
- Proper deferred taxation and provisioning rules

## API Contracts

### Frontend-UI ↔ IFRS_Backend
- REST API on `http://localhost:8000/api/`
- Endpoints for transaction posting, account queries, and report generation
- JWT-based authentication

### IFRS_Backend ↔ Local_Tetherware
- IPC (Inter-Process Communication) via local socket
- Transaction payload submission and signature receipt
- Deterministic payload signing with WDK

### Node_Web3_Server ↔ Blockchain
- JSON-RPC via blockchain provider endpoints
- ERC-4337 bundler contract interface
- Standard ethers.js v6 provider abstraction

## Monitoring and Logging

- **Frontend-UI**: Browser console and Vercel Analytics
- **IFRS_Backend**: Django logging and Flower (Celery monitoring)
- **Local_Tetherware**: Electron main/renderer process logs
- **Node_Web3_Server**: Node.js console and file-based logging

## Security Considerations

1. **Key Management**: All private keys are isolated within Local_Tetherware. Never transmit or log cryptographic material.
2. **API Authentication**: Use JWT tokens for service-to-service communication.
3. **Database Access**: PostgreSQL should run behind a private network interface.
4. **Environment Variables**: Sensitive configuration must be loaded from secure vaults, not hardcoded.
5. **Audit Logging**: All financial operations are logged with user identity and timestamp.

## File Structure

```
AutoBooks-Finance-Tetherware/
├── Frontend-UI/              # Next.js dashboard
├── IFRS_Backend/             # Django accounting engine
├── Local_Tetherware/         # Electron signing enclave
├── Node_Web3_Server/         # Node.js blockchain relayer
└── README.md                 # This file
```

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
