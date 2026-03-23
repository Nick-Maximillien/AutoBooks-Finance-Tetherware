# Frontend-UI - AutoBooks Financial Dashboard

Modern React dashboard for IFRS-compliant financial management with AI-powered document processing and Web3 wallet integration.

## Overview

Frontend-UI provides the primary user interface for interacting with AutoBooks Finance:
- **Financial Dashboards**: Real-time balance sheet, P&L, and cash flow visualizations
- **Document Ingestion**: Upload invoices/receipts → AI extraction → automatic ledger posting
- **Multi-Chain Treasury**: Monitor USDT positions across 10 blockchain networks
- **Journal Entry Management**: Browse, filter, and audit transaction history
- **Authentication**: Secure JWT-based login with business profile management

## Technology Stack

**Framework & Language**:
- Next.js 15.2.8 - React framework with file-based routing
- React 19.x - Modern UI component library
- TypeScript 5.x - Type-safe JavaScript
- Tailwind CSS 4.2 - Utility-first CSS framework

**API & Data Management**:
- Axios - HTTP client for REST API calls
- TanStack Query - React query caching and synchronization
- Zustand or Redux - State management for auth/UI state
- Socket.io (optional) - Real-time updates

**Blockchain Integration**:
- ethers.js 6.13 - Web3 library for chain interaction
- Wagmi (optional) - React hooks for Web3
- MetaMask integration for wallet connection

**UI Components**:
- Recharts - Financial data visualization (line, bar, pie charts)
- React Hook Form - Form management and validation
- Headless UI - Accessible component library
- Bootstrap CSS (legacy) - Fallback styling

## Project Structure

```
Frontend-UI/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── layout.tsx          # Root layout with nav/footer
│   │   ├── page.tsx            # Home/dashboard
│   │   ├── error.jsx           # Error boundary
│   │   ├── not-found.tsx       # 404 page
│   │   ├── globals.css         # Global Tailwind styles
│   │   ├── admin/              # Admin controls
│   │   ├── analytics/          # Financial dashboards
│   │   ├── api/                # API route handlers
│   │   ├── auth/               # Login/signup pages
│   │   ├── journal/            # Journal entry viewer
│   │   ├── reconciliation/     # Bank reconciliation
│   │   ├── contact/            # Contact form
│   │   ├── create_profile/     # Business setup
│   │   ├── message/            # Messaging interface
│   │   ├── shopper_*/          # Multi-tenant commerce
│   │   ├── team/               # Team management
│   │   ├── ui_navigator/       # Real-time screen monitoring
│   │   ├── web/                # Web pages
│   │   ├── web3/               # Wallet & blockchain pages
│   │   ├── whatsapp/           # WhatsApp bot interface
│   │   └── components/         # Reusable components
│   ├── context/
│   │   └── AuthContext.tsx     # Authentication context
│   ├── lib/
│   │   ├── api.ts              # API client with auth
│   │   └── api/                # Specific API modules
│   └── utils/
│       └── tokenUtils.ts       # JWT token management
├── public/
│   ├── products.json           # Product catalog
│   └── bootstrap/css/          # Bootstrap styles
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## Key Features

### Authentication
- JWT token-based login via `/api/auth/signup` and `/api/auth/login`
- AuthContext provides user state globally
- Automatic token refresh on expiration
- Protected routes via middleware

### Financial Dashboards (Analytics)
**Balance Sheet Page**:
- Current assets, liabilities, and equity breakdown
- Real-time account balances from backend
- Period selector for historical comparison
- Export to PDF/Excel

**P&L Statement**:
- Income vs. expenses tracking
- Variance analysis (actual vs. budget)
- YTD totals and monthly trends
- Profitability visualization

**Cash Flow Statement**:
- Operating, investing, financing activities
- Net cash position trends
- Liquidity forecasting
- Payment schedule visualization

### Document Processing (Upload Flow)
1. **File Upload**: Drag-and-drop or file picker for invoices/receipts (PDF, JPG, PNG)
2. **AI Processing**: 
   - Image/PDF sent to backend with Vertex AI
   - Extracts: vendor, amount, date, line items, tax
   - Returns AI confidence score
3. **Classification**: System proposes document type (invoice, bill, asset_purchase, equity_injection)
4. **Preview**: User reviews extracted data and AI extraction
5. **Posting**: Confirm → automatic ledger posting with double-entry validation
6. **Audit Trail**: View extraction metadata and reason for human review (if flagged)

### Wallet Integration
- Connect MetaMask via ethers.js
- Display treasury address and USDT balance across chains
- Monitor multi-chain positions (Ethereum, Base, Arbitrum, Celo, etc.)
- Initiate payments to vendors from treasury

### Journal Entry Viewer
- Chronological list of all posted journal entries
- Filter by account, date range, or search term
- Expandable entries showing debit/credit breakdown
- Immutable audit trail with timestamps and user attribution
- Link to source document (invoice, manual entry, or system-generated)

### UI Navigator (Real-Time Document Detection)
- Screen capture monitoring (with user permission)
- Live financial document detection (invoices, receipts, bank statements)
- One-click upload and extraction
- Background watcher for hands-free operation

## API Integration

### Base Configuration
```typescript
// src/lib/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Axios instance with JWT interceptor
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// Add token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

### Key Endpoints

**Authentication**:
- `POST /api/auth/signup` - Register new business
- `POST /api/auth/login` - Get JWT tokens

**Business Profile**:
- `GET /api/business/profile` - Current business details
- `POST /api/business/profile` - Update business info

**Documents**:
- `POST /api/documents/upload` - Upload file for AI extraction
- `GET /api/documents` - List uploaded documents
- `POST /api/documents/{id}/post` - Post to ledger
- `POST /api/documents/{id}/revoke` - Reverse and delete

**Statements**:
- `GET /api/statements/balance-sheet` - Current balance sheet
- `GET /api/statements/pnl` - P&L for current period
- `GET /api/statements/cash-flow` - Cash flow statement

**Ledger**:
- `GET /api/journal/entries` - All journal entries
- `GET /api/accounts/{code}` - Account details and history

**Web3**:
- `GET /api/web3/balances` - Treasury positions
- `GET /api/web3/chains` - Supported networks
- `POST /api/web3/tx/broadcast` - Send signed transaction

## Environment Variables

```bash
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Web3 Configuration
NEXT_PUBLIC_WEB3_RPC=https://eth-mainnet.g.alchemy.com/v3/YOUR_KEY
NEXT_PUBLIC_USDT_ADDRESS=0xdAC17F958D2ee523a2206206994597C13D831ec7

# Optional: Analytics
NEXT_PUBLIC_AMPLITUDE_KEY=...
NEXT_PUBLIC_SENTRY_DSN=...
```

## Running Locally

### Prerequisites
- Node.js 20+
- npm or pnpm

### Installation

```bash
cd Frontend-UI
npm install

# Development server
npm run dev

# Production build
npm run build
npm start

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

The app runs on `http://localhost:3000` by default.

### Development Tips
- Hot module reloading enabled for instant feedback
- TypeScript provides compile-time type safety
- Tailwind CSS IntelliSense for styling
- ESLint configured for code quality
- Next.js optimizes images and code splitting automatically

## Authentication Flow

```plaintext
1. User visits /auth/login
2. Enters credentials (username, password)
3. Frontend sends to POST /api/auth/login
4. Backend returns { access_token, refresh_token }
5. Frontend stores tokens in localStorage
6. AuthContext updated with user data
7. Redirect to /analytics (dashboard)
8. All subsequent requests include Bearer token
```

## Request/Response Examples

### Upload Document
```typescript
const formData = new FormData();
formData.append('file', file); // PDF or image
formData.append('ui_source', 'web'); // or 'whatsapp', 'ui_navigator'

const response = await apiClient.post('/documents/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// Response:
// {
//   "id": 123,
//   "document_type": "invoice",
//   "total": 50000,
//   "vendor": "AWS",
//   "date": "2024-01-15",
//   "ai_detected_type": "invoice",
//   "confidence_score": 0.95,
//   "requires_human_review": false,
//   "items": [...],
//   "raw_text": "..."
// }
```

### Get Balance Sheet
```typescript
const response = await apiClient.get('/statements/balance-sheet');

// Response:
// {
//   "assets": 250000,
//   "liabilities": 100000,
//   "equity": 150000,
//   "accounts": {
//     "1110": {"name": "Cash", "balance": 50000},
//     "1200": {"name": "Accounts Receivable", "balance": 80000},
//     ...
//   }
// }
```

## Performance Optimization

- **Code Splitting**: Automatic route-based splitting via Next.js
- **Image Optimization**: next/image for responsive images
- **Font Optimization**: System fonts + Google Fonts preload
- **Caching**: TanStack Query caches API responses
- **Minification**: Production builds automatically minified
- **CDN Deployment**: Static assets served from CDN edge locations

## Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t autobooks-frontend .
docker run -p 3000:3000 autobooks-frontend
```

### Environment Variables (Production)
Set these in your deployment platform:
- `NEXT_PUBLIC_API_URL=https://api.autobooks.finance`
- `NEXT_PUBLIC_WEB3_RPC=https://eth-mainnet.g.alchemy.com/v3/PROD_KEY`
- Other secret keys as needed

## Troubleshooting

### Blank Page / 404 Errors
- Check `NEXT_PUBLIC_API_URL` is correctly set
- Verify backend is running and accessible
- Check browser console for errors

### Authentication Loop
- Clear localStorage: `localStorage.clear()`
- Check JWT token expiration: `jwt.io`
- Verify backend auth endpoints are working

### Document Upload Fails
- Check file size (limit is 50MB)
- Verify file format (PDF, JPG, PNG only)
- Check Google Cloud credentials are configured
- Check Vertex AI API is enabled

### Web3 Connection Issues
- MetaMask must be installed
- Verify supported networks in MetaMask
- Check RPC endpoint is not rate-limited

## Directory Reference

| Path | Purpose |
|------|---------|
| `app/analytics` | Financial dashboards |
| `app/auth` | Login/signup pages |
| `app/journal` | Journal entry viewer |
| `app/api` | Internal API routes |
| `app/web3` | Wallet & blockchain UI |
| `components` | Reusable React components |
| `context` | Global state (AuthContext) |
| `lib/api.ts` | HTTP client configuration |
| `utils` | Utility functions (tokens, parsing) |

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Follow TypeScript/React conventions
3. Test changes locally: `npm run dev`
4. Submit PR against main branch

## License

Proprietary - Tether Finance 2024
