# Frontend-UI: AutoBooks Finance Dashboard

A Next.js-based dashboard and document ingestion system for IFRS-compliant financial management. The Frontend-UI serves as the primary interface between end users and the AutoBooks Finance system, enabling document submission, transaction confirmation, and real-time financial reporting.

## Overview

The Frontend-UI provides:

- **Multi-Document Ingestion**: Upload and process financial documents (invoices, receipts, statements, contracts)
- **Vision-Based Ingestion (UI Navigator)**: Graph-based document processing with computer vision for intelligent field extraction
- **Transaction Dashboard**: Real-time visibility into posted transactions with filtering and search capabilities
- **Financial Reports**: Dynamic balance sheet, profit & loss, and cash flow statement generation
- **Blockchain Treasury Monitoring**: Real-time view of on-chain treasury positions and transaction status
- **Multimodal Finance Interface**:  AI assistant for financial queries

## Architecture

### Network Topology

```
┌───────────────────────┐
│   Frontend-UI         │
│   (Next.js Dashboard) │
└───────┬───────────────┘
        │
        ├─── REST API ──→ [IFRS_Backend: Account Validation]
        │
        ├─── REST API ──→ [Web3 Aggregator: Treasury Status]
        │
        └─── IPC Socket → [Local_Tetherware: Signature Auth]
```

### Component Architecture

```
src/
├── app/
│   ├── page.tsx                 # Root login/dashboard router
│   ├── layout.tsx               # Global layout with auth
│   ├── admin/                   # Admin dashboard
│   ├── analytics/               # Analytics & reporting
│   └── [other routes]/
├── components/
│   ├── ui_navigator/            # Vision-based ingestion interface
│   ├── Accounting.tsx           # Balance sheet & ledger views
│   ├── CreateProfile.tsx        # User onboarding
│   ├── FinancialPosition.tsx    # Real-time P&L and position data
│   ├── ExportFinancialsButton.tsx # Report export (PDF, Excel)
│   ├── Chat.tsx                 # RAG conversational interface
│   └── [other components]/
├── context/
│   ├── AuthContext.tsx          # JWT authentication state
│   └── [other contexts]/
├── services/
│   ├── api.ts                   # IFRS_Backend API client
│   └── [other services]/
├── lib/
│   ├── api/                     # HTTP utilities and interceptors
│   └── [other utilities]/
└── utils/
    ├── tokenUtils.ts            # JWT token handling
    └── [other utilities]/
```

## Key Features

### 1. Multimodal (text, audio, vision) Document Ingestion (UI Navigator)

The UI Navigator provides intelligent document processing through a multi-stage pipeline:

- **Document Upload**: Drag-and-drop or click-to-upload interface for PDFs and images
- **OCR Extraction**: Computer vision extracts text, tables, and key fields from documents
- **Graph-Based Classification**: Document type determined through LLM analysis
- **Field Mapping**: Automatically maps extracted data to IFRS account codes
- **User Confirmation**: Users review and confirm extracted values before posting
- **Atomic Posting**: Valid transactions are submitted to IFRS_Backend for ledger entry

**Supported Document Types**:
- Invoices (revenue transactions)
- Bills (expense transactions)
- Customer receipts (cash inflows)
- Payment vouchers (cash outflows)
- Adjustment notes (credit/debit notes)
- Bank statements (reconciliation documents)
- Asset purchase agreements (fixed asset recognition)

### 2. Real-Time Transaction Dashboard

Displays all posted transactions with:
- Filter by date range, account, or transaction type
- Sort by amount, date, or counterparty
- Search across transaction descriptions
- Drill-down to full journal entry details
- Transaction status indicators (POSTED, REJECTED, REVERSED)
- Reversing entry interface for mistake correction

### 3. Financial Report Generation

Dynamic reports generated from IFRS_Backend account balances:

**Balance Sheet (Statement of Financial Position)**
- Current and non-current asset classification
- Current and non-current liability classification
- Equity breakdown including retained earnings
- IFRS equation validation (Assets = Liabilities + Equity)
- Period-over-period comparison views

**Profit & Loss (Income Statement)**
- Revenue and cost of sales
- Gross profit and operating expenses
- EBITDA and operating profit
- Finance costs and tax expense
- Net profit for period and EPS calculations
- Multi-period variance analysis

**Cash Flow Statement**
- Operating, investing, and financing activity sections
- Direct method reconciliation
- Opening and closing cash balance
- Working capital changes

### 4. Blockchain Treasury Monitoring

Real-time integration with Node_Web3_Server for:
- On-chain account balance display
- UserOperation submission status
- Transaction confirmation tracking
- Gas fee estimation before submission
- Network switching interface (multi-chain support)

### 5. Conversational Finance Interface

Chat-based interface with RAG capabilities:
- Query financial data using natural language
- Automatic context injection of P&L, balance sheet, and cash flow
- Multi-turn conversation support
- Question history and saved queries
- Export conversation as PDF summary

## Tech Stack

| Component         | Technology          | Version   | Purpose                              |
|-------------------|---------------------|-----------|--------------------------------------|
| Framework         | Next.js             | 15.2.8    | Server-side rendering & routing     |
| Runtime           | React               | 19.0.0    | Component library                   |
| Language          | TypeScript          | 5.x       | Type safety                         |
| Styling           | Tailwind CSS        | 4.0.14    | Utility-first CSS                   |
| HTTP Client       | axios               | 1.10.0    | API requests                        |
| Web3              | ethers.js           | 6.15.0    | Blockchain interactions            |
| Charts            | recharts            | 3.1.0     | Financial data visualization        |
| Drag & Drop       | @hello-pangea/dnd   | 18.0.1    | UI reordering                       |
| Icons             | react-icons         | 5.5.0     | UI iconography                      |
| Analytics         | @vercel/analytics   | 1.5.0     | Performance monitoring              |

## Installation & Setup

### Prerequisites

- Node.js 18.0 or higher
- npm 9.0 or higher (or yarn/pnpm equivalent)
- Running IFRS_Backend instance (port 8000 by default)
- Running Node_Web3_Server instance (port 3001 by default)

### Installation Steps

1. **Clone and navigate to the Frontend-UI directory**:
   ```bash
   cd Frontend-UI
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Create environment configuration**:
   Create a `.env.local` file in the `Frontend-UI` root directory:
   ```env
   # Backend API URLs
   NEXT_PUBLIC_IFRS_BACKEND_URL=http://localhost:8000/api
   NEXT_PUBLIC_WEB3_SERVER_URL=http://localhost:3001/api

   # Blockchain Configuration
   NEXT_PUBLIC_CHAIN_ID=1                    # Ethereum mainnet
   NEXT_PUBLIC_RPC_URL=https://eth.llamarpc.com

   # Authentication
   NEXT_PUBLIC_AUTH_DOMAIN=autobooks-auth.local
   NEXT_PUBLIC_JWT_STORAGE_KEY=autobooks_jwt

   # Feature Flags
   NEXT_PUBLIC_ENABLE_RAG_CHAT=true
   NEXT_PUBLIC_ENABLE_IOT_INTEGRATION=false
   ```

4. **Build and run**:
   ```bash
   # Development server (with hot reload)
   npm run dev

   # Production build
   npm run build
   npm start
   ```

5. **Access the dashboard**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

## API Integration Patterns

### IFRS_Backend Integration

All accounting operations route through the IFRS_Backend API:

```typescript
// Example: Post a new transaction
const response = await fetch('/api/transactions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    description: 'Equipment Purchase',
    date_posted: '2026-03-15',
    entries: [
      { account_code: '1510', debit: 5000, credit: 0 },  // Fixed Assets
      { account_code: '1110', debit: 0, credit: 5000 }   // Cash
    ]
  })
});
```

```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for development
npm test --watch

# Coverage report
npm test --coverage
```

### Linting and Code Style

```bash
# Run ESLint
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Building for Production

```bash
# Create optimized production build
npm run build

# Test production build locally
npm start
```

## Environment and Configuration

### Configuration Hierarchy

1. **`.env.local`**: Local environment overrides (not committed to git)
2. **`.env`**: Shared environment defaults (committed to git)
3. **`next.config.js`**: Next.js build and runtime configuration
4. **`tailwind.config.js`**: Tailwind CSS design system

### Required Environment Variables

| Variable                      | Type     | Required | Description                           |
|-------------------------------|----------|----------|---------------------------------------|
| `NEXT_PUBLIC_IFRS_BACKEND_URL` | string   | Yes      | IFRS_Backend API endpoint            |
| `NEXT_PUBLIC_WEB3_SERVER_URL`  | string   | Yes      | Node_Web3_Server API endpoint        |
| `NEXT_PUBLIC_CHAIN_ID`         | number   | Yes      | Blockchain network ID                |
| `NEXT_PUBLIC_RPC_URL`          | string   | Yes      | Blockchain RPC provider URL          |
| `NEXT_PUBLIC_AUTH_DOMAIN`      | string   | No       | Authentication provider domain       |

## Performance Optimization

### Code Splitting
- Route-based code splitting with Next.js `dynamic()` imports
- Component lazy loading for heavy charting libraries
- Automatic compression with Tailwind CSS purge

### Caching Strategy
- JSON responses cached with 5-minute TTL in localStorage
- Balance sheet and P&L cached with 1-minute TTL
- Real-time updates via WebSocket (planned)

### Bundle Analysis

To analyze bundle size:

```bash
npm install -g webpack-bundle-analyzer
next build
ANALYZE=true npm run build
```

## Security Considerations

### Authentication Flow
1. User enters credentials at login screen
2. Frontend submits to IFRS_Backend `/api/auth/login` endpoint
3. Backend returns JWT token
4. Frontend stores JWT in secure, httpOnly cookie
5. All subsequent requests include JWT in Authorization header

### Sensitive Data Handling
- Private keys are never transmitted to Frontend-UI
- Cryptographic operations happen exclusively in Local_Tetherware
- Balance and transaction data are encrypted in transit via HTTPS
- User session tokens are short-lived (15 min default) with refresh tokens

### Content Security Policy
- Strict CSP headers prevent inline script execution
- External API calls only to whitelisted domains
- Subresource integrity checks for third-party libraries

## Deployment

### Vercel Deployment

```bash
# Connect repository to Vercel
# Push to main branch to trigger auto-deployment
git push origin main

# View deployment logs
vercel logs
```

### Self-Hosted Deployment

```bash
# Build production-optimized bundle
npm run build

# Start production server
npm start

# Or use process manager (PM2)
pm2 start ecosystem.config.js
```

## Troubleshooting

### CORS Errors

If you see `CORS policy blocked` errors:
1. Verify IFRS_Backend is running with CORS enabled
2. Check `NEXT_PUBLIC_IFRS_BACKEND_URL` matches backend server address
3. Ensure backend `ALLOWED_HOSTS` includes your frontend domain

### Authentication Issues

- Clear browser cookies and localStorage (`localStorage.clear()` in console)
- Check JWT token expiration in browser DevTools Application tab
- Verify `NEXT_PUBLIC_AUTH_DOMAIN` matches authentication provider

### Blockchain Connection Issues

- Confirm `NEXT_PUBLIC_RPC_URL` is reachable
- Check for rate limiting on RPC provider
- Verify `NEXT_PUBLIC_CHAIN_ID` matches selected network

## Contributing

1. Create a feature branch: `git checkout -b feature/new-feature`
2. Make changes and run tests: `npm test`
3. Commit with meaningful message: `git commit -m 'Add new feature'`
4. Push to remote: `git push origin feature/new-feature`
5. Open a pull request for review

## Version Information

- **Frontend-UI Version**: 0.1.0
- **Node.js Minimum**: 18.0
- **Last Updated**: March 2026

## Related Documentation

- [AutoBooks Finance Main README](../README.md)
- [IFRS_Backend Documentation](../IFRS_Backend/README.md)
- [Local_Tetherware Documentation](../Local_Tetherware/README.md)
- [Node_Web3_Server Documentation](../Node_Web3_Server/README.md)
```


## License

MIT License.
