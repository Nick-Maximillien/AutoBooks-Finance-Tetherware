# Node_Web3_Server: ERC-4337 Account Abstraction Relayer

A Node.js-based blockchain relayer implementing ERC-4337 Account Abstraction standards. The Node_Web3_Server orchestrates the submission of UserOperations to blockchain bundlers, converting validated transactions from IFRS_Backend into on-chain settlement.

## Overview

The Node_Web3_Server provides:

- **UserOperation Construction**: Converts transactions to ERC-4337 compliant UserOperations
- **Account Abstraction Integration**: Smart account deployment and execution coordination
- **Blockchain Bundler Interface**: Multiple bundler service support (Pimlico, Stackup, Alchemy)
- **Multi-Chain Support**: Ethereum, Polygon, Optimism, Arbitrum, and other chains
- **Real-Time State Tracking**: Transaction status monitoring and confirmation tracking
- **Gas Optimization**: Dynamic gas price calculation and bundling strategies
- **Transaction History**: Immutable record of all blockchain submissions
- **REST API**: Full HTTP interface for transaction submission and status queries

## Architecture

### System Integration

```
┌──────────────────────┐
│  IFRS_Backend        │
│  (Validated Txns)    │
└──────────┬───────────┘
           │
    REST API POST /submit
           │
           ▼
┌──────────────────────────────────────────┐
│  Node_Web3_Server (Relayer)              │
├──────────────────────────────────────────┤
│ ┌────────────────────────────────────┐   │
│ │  UserOp Constructor                │   │
│ │  ├── Payload Encoding              │   │
│ │  ├── account_gasLimits Calculation │   │
│ │  ├── preVerificationGas Estimation │   │
│ │  └── gasFees (maxFeePerGas setup)  │   │
│ └────────────────────────────────────┘   │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │  Bundler Router                    │   │
│ │  ├── Pimlico (Primary)             │   │
│ │  ├── Stackup (Fallback)            │   │
│ │  └── Alchemy (Fallback 2)          │   │
│ └────────────────────────────────────┘   │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │  State Manager                     │   │
│ │  ├── Pending UserOps               │   │
│ │  ├── Confirmation Tracking         │   │
│ │  ├── Failed Bundling Retry         │   │
│ │  └── Memory Pool Management        │   │
│ └────────────────────────────────────┘   │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │  Chain Managers                    │   │
│ │  ├── Ethereum Mainnet (ID: 1)      │   │
│ │  ├── Polygon (ID: 137)             │   │
│ │  ├── Optimism (ID: 10)             │   │
│ │  ├── Arbitrum (ID: 42161)          │   │
│ │  └── Additional chains...          │   │
│ └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
           │
           ├─── JSON-RPC ──→ Bundler Services (Pimlico, Stackup, etc.)
           │
           ├─── JSON-RPC ──→ Blockchain RPC Providers
           │
           └─→ State Polling (Monitor on-chain execution)

Bundler contracts and relayers forward UserOps to chosen Entry Point
           │
           ▼
    ┌─────────────────┐
    │  Blockchain     │
    │  (on-chain      │
    │   execution)    │
    └─────────────────┘
```

## 2. Environment Variables

| Variable            | Description                             |
| ------------------- | --------------------------------------- |
| `ENCRYPTION_SECRET` | AES secret for encrypting private keys  |
| `DJANGO_API_URL`    | Django endpoint to save wallet metadata |
| `LISK_RPC_URL`      | RPC provider for Lisk L2                |
| `SEPOLIA_RPC_URL`   | RPC provider for Ethereum Sepolia       |
| `MASTER_MNEMONIC`   | Mnemonic used to fund user wallets      |

---

## Key Components

### 1. UserOperation Constructor

Converts validated IFRS transactions into ERC-4337 UserOperations:

**Input Transaction** (from IFRS_Backend):
```json
{
  "transaction_id": "txn-2026-03-15-001",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc2e7595f42bE9",
  "amount": "100.5",
  "currency": "USDT",
  "data": "0x",
  "timestamp": 1686312900000
}
```

**Output UserOperation** (ERC-4337 format):
```json
{
  "sender": "0xc0ffee254729296a45a3885639AC7E10F9d54979",
  "nonce": "42",
  "initCode": "0x",
  "callData": "0xa9059cbb000000000000000000000000742d35cc6634c0532925a3b844bc2e7595f42be90000000000000000000000000000000000000000000000056bc75e2d630eb20000",
  "accountGasLimits": "0x000000000000000000000000000000000000000000000000000000000000a4b80000000000000000000000000000000000000000000000000000000000001d4c0",
  "preVerificationGas": "0x00000000000000000000000000000000000000000000000000000000000118c0",
  "gasFees": "0x00000000000000000000000000000000000000000000000000b9aca0000000000ffffffff",
  "paymasterAndData": "0x",
  "signature": "0x..."
}
```

**Gas Calculations**:
- `callGasLimit`: Estimated gas needed to execute the transaction (typically 21000 for ERC-20 transfers + buffer)
- `verificationGasLimit`: Gas for EntryPoint to validate the signature (typically 50000)
- `preVerificationGas`: Gas for bundle data processing (varies by bundler)
- `maxPriorityFeePerGas`: Tip to bundler (current: 2 Gwei typical)
- `maxFeePerGas`: Total max gas price including priority fee

### 2. Bundler Router

Manages connections to multiple bundler services with failover logic:

**Primary Bundler: Pimlico**
- Endpoint: `https://api.pimlico.io/v2/{chainId}/rpc`
- Min stake requirement: 32 ETH (or alternative)
- Supported chains: Ethereum, Polygon, Optimism, Arbitrum

**Fallback 1: Stackup**
- Endpoint: `https://api.stackup.sh/v1/{chainId}/rpc`
- Flexible requirement
- Good chain coverage

**Fallback 2: Alchemy**
- Endpoint: `https://{chain}.g.alchemy.com/v2/{apiKey}`
- Premium tier support
- Ethereum and Polygon focus

### 3. State Manager

Tracks pending and completed UserOperations with lifecycle management from pending → included → confirmed.

### 4. Chain Managers

Per-chain managers handle RPC communication for Ethereum, Polygon, Optimism, Arbitrum, and others.

## Tech Stack

| Component         | Technology              | Purpose                              |
|-------------------|-------------------------|--------------------------------------|
| Runtime           | Node.js 16+             | JavaScript execution                |
| Framework         | Express.js              | HTTP server and routing             |
| Web3 Library      | ethers.js v6            | Blockchain interactions            |
| Web3 Framework    | thirdweb SDK            | Account abstraction utilities      |
| HTTP Client       | node-fetch              | API requests to bundlers            |
| Encryption        | crypto-js               | Transaction payload signing         |
| Environment       | dotenv                  | Configuration management            |

## Installation & Setup

### Prerequisites

- Node.js 16.x or higher
- npm or yarn package manager
- Bundler API keys (Pimlico, Stackup, or Alchemy)
- Blockchain RPC endpoints (public or private)

### Installation Steps

1. **Clone and navigate to Node_Web3_Server directory**:
   ```bash
   cd Node_Web3_Server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create environment configuration**:
   Create a `.env` file in the `Node_Web3_Server` root directory:
   ```env
   # Server Configuration
   PORT=3001
   NODE_ENV=production
   LOG_LEVEL=info

   # Primary Chain (Ethereum Mainnet)
   CHAIN_1_RPC=https://eth.llamarpc.com
   CHAIN_1_BUNDLER=pimlico
   CHAIN_1_ENTRY_POINT=0x5FF137D4b0FDCD49DcA30c7B5Cb8ff81B490713D
   
   # Bundler API Keys
   PIMLICO_API_KEY=your_pimlico_api_key
   STACKUP_API_KEY=your_stackup_api_key
   ALCHEMY_API_KEY=your_alchemy_api_key
   
   # Secondary Chains
   CHAIN_137_RPC=https://polygon-rpc.com
   CHAIN_137_BUNDLER=pimlico
   CHAIN_137_ENTRY_POINT=0x5FF137D4b0FDCD49DcA30c7B5Cb8ff81B490713D
   
   # Gas Configuration
   GAS_PRICE_MULTIPLIER=1.2
   MAX_PRIORITY_FEE_GWEI=2
   MAX_FEE_PER_GAS_GWEI=100
   
   # State Management
   PENDING_USEROP_TTL_MINUTES=30
   CONFIRMATION_BLOCKS=12
   
   # IFRS_Backend Integration
   IFRS_BACKEND_URL=http://localhost:8000/api
   ```

4. **Start the server**:
   ```bash
   # Development mode (with nodemon)
   npm run dev
   
   # Production mode
   npm start
   ```

5. **Verify the server is running**:
   ```bash
   curl http://localhost:3001/health
   ```

## API Endpoints

### POST /api/submit

Submit a validated transaction for blockchain execution.

### GET /api/status/{userOpHash}

Query the status of a submitted UserOperation.

### GET /api/transactions

List all submitted transactions with pagination.

### POST /api/estimate-gas

Estimate gas costs for a proposed transaction.

## Transaction Flow

End-to-end submission process from IFRS_Backend validation through blockchain confirmation tracking.

## Error Handling and Retries

Automatic retry with exponential backoff and bundler fallback logic for failed submissions.

## Performance Characteristics

| Operation                     | Expected Time       | Notes                            |
|-------------------------------|---------------------|---------------------------------|
| UserOp Submission             | 2-5 seconds         | Including bundler response       |
| Gas Estimation                | 500ms - 1 second    | RPC call to blockchain          |
| Confirmation Check            | <100ms              | In-memory state lookup          |
| Bundling (inclusion in block) | 20-60 seconds       | Depends on bundler capacity     |
| Full confirmation (12 blocks) | 3-5 minutes         | On Ethereum mainnet             |

## Security Considerations

All UserOperations are verified before submission with signature validation, nonce checks, and rate limiting.

## Testing

```bash
# Run all tests
npm test

# Coverage report
npm test -- --coverage
```

## Version Information

- **Node_Web3_Server Version**: 1.0.0
- **ERC-4337 Standard**: Latest (EntryPoint v0.6)
- **ethers.js Version**: 6.15.0
- **Node.js Minimum**: 16.0
- **Last Updated**: March 2026

## Related Documentation

- [AutoBooks Finance Main README](../README.md)
- [Frontend-UI Documentation](../Frontend-UI/README.md)
- [IFRS_Backend Documentation](../IFRS_Backend/README.md)
- [Local_Tetherware Documentation](../Local_Tetherware/README.md)
