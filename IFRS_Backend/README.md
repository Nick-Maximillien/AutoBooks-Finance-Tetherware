# IFRS Accounting Domain Engine (Django) - FinTech Backend

[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.1.7-green.svg)](https://www.djangoproject.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A **production-grade, domain-driven accounting engine** built with Django, designed to enforce **IFRS for SMEs (Third Edition 2025)** rules while serving as a **reliable financial truth layer for AI services** and fintech applications.

This system provides deterministic, auditable financial data suitable for:
- 🤖 **AI Financial Assistants** - Google Gemini-powered conversational finance agents
- 📄 **Automated Document Processing** - Intelligent invoice, receipt, and payroll ingestion with AI classification
- 💼 **Fintech Applications** - Core accounting infrastructure with regulatory compliance
- 📊 **Regulatory-Aware Reporting** - IFRS-compliant Balance Sheets, P&L, and Cash Flow statements
- 💬 **Multi-Channel AI Agents** - WhatsApp, Web Chat, and real-time streaming interfaces
- 🔐 **Audit-Ready Systems** - Immutable journal entries with complete transaction trails

### Core Strength: Deterministic Financial State
Unlike black-box accounting systems, every transaction is validated against IFRS rules at the backend level. This ensures that AI agents, clients, and stakeholders always see the same financial truth.

---

## 🎯 Core Objectives

- ✅ **Enforce Double-Entry Bookkeeping** - Structural invariant: Assets = Liabilities + Equity
- 📚 **IFRS Compliance** - Model IFRS for SMEs (2025 Third Edition) chart of accounts and measurement rules
- 🔒 **Deterministic Financial State** - Provide trustworthy data for downstream AI systems without hidden side effects
- 🚀 **Automatic Document Posting** - Intelligently classify and post documents (invoices, receipts, payroll, assets, loans, etc.)
- 📈 **Clean Financial Reporting** - Generate explainable, auditable reports: Balance Sheet, P&L, Cash Flow, Journal Entries
- 🧠 **AI-First Design** - Google Gemini integration for document intelligence, entity verification, and anomaly detection
- 🔄 **Conversational Banking** - WhatsApp/Web agents with voice synthesis (Google Cloud TTS)
- 🎯 **Extensible & Testable** - Clear separation of concerns; backend owns all accounting logic

---

## 🚀 Key Features

### 1. IFRS-Aligned Domain Model
- **60+ Predefined IFRS Accounts** - Fully mapped per IFRS for SMEs 2025 Edition
  - Assets: Cash, Receivables, Inventory, PPE, Intangibles, Investment Property
  - Liabilities: Payables, Short/Long-term Borrowings, Provisions
  - Equity: Share Capital, Retained Earnings, Reserves
  - Income: Revenue, Cost of Sales, Operating Income
  - Expenses: Operating Expenses, Depreciation, Finance Costs, Tax
- **Account Classes** - Assets, Liabilities, Equity, Income, Expenses with inherent semantics
- **Financial Period Management** - Controlled opening, posting, closing, and roll-forward
- **Retained Earnings Automation** - Automatic calculation and roll-forward on period close
- **Contra-Accounts** - Accumulated depreciation/amortization natively modeled

### 2. Bulletproof Double-Entry Enforcement
- **Atomic Posting** - Every transaction validated before ledger commitment
- **Structural Validation** - Total debits = Total credits (to 2 decimal places)
- **Amount Constraints** - No negative amounts; reverse entries only via explicit debit/credit
- **Account Class Semantics** - System respects asset/liability/equity definitions
- **Immutable Audit Trail** - All journal entries timestamped and permanently recorded
- **Transaction Status Lifecycle** - DRAFT → POSTED → REJECTED with full auditability

### 3. AI-Powered Intelligent Document Processing
Documents uploaded to the platform are automatically processed using **Google Gemini AI**:
- **📸 Multi-Format Support** - Images (JPG, PNG) and PDFs accepted
- **🔍 Smart Classification** - 22+ document types auto-identified (invoice, receipt, bill, payroll, asset purchase, loan agreement, etc.)
- **📝 Intelligent Extraction** - Amounts, dates, counterparties, line items, tax, balances
- **⚖️ Entity Verification** - Validates document is addressed to the correct business entity
- **🛡️ Mismatch Detection** - Flags entity mismatches and anomalies for human review
- **🤖 Final Boss Override** - When entity mismatch detected, automatically re-classifies invoice → bill
- **✨ Auto-Posting** - Valid documents post directly to ledger with zero manual intervention
- **📋 Comprehensive Logging** - Original AI detection, overrides, and review flags preserved

**Supported Document Types (22+):**
- Revenue: Invoice, Customer Contract, Revenue Recognition, Quotation, Delivery Note
- Expenses: Bill, Expense Claim, Purchase Order
- Adjustments: Credit Note, Debit Note
- Cash: Receipt, Payment Voucher, Bank Statement
- Assets: Asset Purchase, Lease Agreement
- Capital: Equity Injection, Short-term Borrowing, Long-term Borrowing
- Other: Tax Filing, Journal Entry, Unknown

### 4. Comprehensive Financial Reporting APIs
- **📊 Balance Sheet (Statement of Financial Position)**
  - Current & Non-Current Assets
  - Current & Non-Current Liabilities
  - Equity breakdown
  - IFRS equation validation (Assets = Liabilities + Equity)
  - Period-aware with opening balances
  
- **💰 Profit & Loss (Income Statement)**
  - Revenue, Cost of Sales, Gross Profit
  - Operating Income/Expenses
  - Finance Costs, Tax, Profit for the Period
  - Segment view (current period vs year-to-date)
  
- **💵 Cash Flow Statement**
  - Operating Activities (direct method)
  - Investing Activities
  - Financing Activities
  - Net change in cash & closing balance
  
- **📜 Journal Entry Audit Trail**
  - Complete transaction history
  - Filter by date, account, status
  - Source document references
  - User accountability

### 5. Multi-Channel Conversational AI Agents
- **💬 WhatsApp Agent** - Twilio-powered accounting assistant
  - Ask questions about balances, transactions, reports
  - Receive responses via WhatsApp
  - Voice synthesis for mobile-first UX
  
- **🌐 Web Chat Interface** - Browser-based conversational AI
  - Real-time streaming responses
  - Structured financial data retrieval
  - Transaction context awareness
  
- **🎙️ Text-to-Speech** - Google Cloud TTS integration
  - Voice responses for accessibility
  - Multi-language support (future)
  
- **🔄 Live Streaming** - Real-time agentic updates
  - Server-sent events (SSE) for live responses
  - Asynchronous processing with Celery

### 6. AI-Ready by Design
- **Clean Financial State** - No hidden side effects; all state mutations are explicit and logged
- **Structured Outputs** - Pydantic schemas ensure AI and clients receive identical data shapes
- **RAG-Compatible** - Financial data optimized for Retrieval-Augmented Generation pipelines
- **Zero Hallucination Risk** - Agents query deterministic ledger state, not LLM memory
- **Strict Type Validation** - Pydantic enforces schema contracts; no invalid data reaches the ledger
- **Financial Source of Truth** - Designed as single source of truth for all downstream AI systems

### 7. Enterprise-Grade Features
- **Multi-Tenancy** - Each user has isolated business entity with complete ledger separation
- **JWT Authentication** - Secure token-based API access with refresh mechanisms
- **Role-Based Access** - Support for superusers and admin dashboards
- **Cloudinary Integration** - Secure document and media storage
- **Celery Background Tasks** - Asynchronous document processing and report generation
- **Flower Monitoring** - Visual dashboard for task queue health
- **CORS Support** - Flexible cross-origin requests for web frontends
- **Docker Orchestration** - Multi-service deployment (Django, PostgreSQL, Redis, Celery)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│  Web Frontend │ Mobile App │ WhatsApp │ Integrations             │
└────────────────────┬─────────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                      API LAYER (REST)                            │
│  Authentication │ Documents │ Transactions │ Reports             │
│  (Django REST Framework + Simple JWT)                            │
└────────────────────┬─────────────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ▼               ▼               ▼
  ┌──────────┐  ┌──────────┐  ┌─────────────────┐
  │   AI     │  │ Celery   │  │  IFRS Accounting│
  │ Processing│  │ Tasks    │  │  Rules Engine   │
  │ (Gemini) │  │ (Async)  │  │ (Domain Logic)  │
  └────┬─────┘  └────┬─────┘  └────────┬────────┘
       │             │                  │
       └─────────────┼──────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│                   DATA PERSISTENCE LAYER                         │
│  PostgreSQL 15  │  Redis 7  │  Cloudinary Storage                │
│  • Accounts     │ • Cache   │ • Images/Documents                 │
│  • Transactions │ • Queue   │                                    │
│  • Documents    │ • Sessions│                                    │
│  • Ledger       │           │                                    │
└──────────────────────────────────────────────────────────────────┘

KEY ARCHITECTURAL PRINCIPLE:
Backend owns ALL accounting logic. Clients (web, mobile, AI agents) 
are "thin" -- they submit data and query reports. The system enforces 
IFRS rules regardless of client behavior.
```

### Dataflow Example: Document Processing

```
1. Client uploads invoice.pdf
              ↓
2. API stores file in Cloudinary
              ↓
3. Celery task triggered (async)
              ↓
4. Gemini AI: Classify document type, extract amounts/dates/parties
              ↓
5. Pydantic validates extracted data (AgenticPayload schema)
              ↓
6. Entity verification: Is document addressed to our business?
              ↓
7a. Mismatch detected → Flag for human review, auto-correct classification
    (e.g., invoice → bill if not addressed to us)
              ↓
7b. Entity verified → Generate journal entries atomically
              ↓
8. Transaction.post() validates double-entry, creates JournalEntries
              ↓
9. Ledger updated; Document status = POSTED
              ↓
10. Client queries Balance Sheet → sees updated balances instantly
```

---

## 📁 Project Structure

```
fintech-backend/
├── app/                                    # Main Django application (heart of the system)
│   ├── models.py                           # Core domain models (894 lines)
│   │   ├── IFRSAccountRules                # IFRS calculation engine
│   │   │   ├── calculate_depreciation_amortisation()  # Straight-line & reducing balance methods
│   │   │   ├── calculate_impairment()      # Net Realizable Value (NRV) calculations
│   │   │   ├── calculate_fair_value_adjustment()      # Investment property valuation changes
│   │   │   └── validate_balance()          # IFRS equation validation
│   │   ├── IFRSTransactionRules            # Transaction-level validation
│   │   │   └── validate_transaction()      # Double-entry structural checks
│   │   ├── BusinessProfile                 # Business entity (owns all ledger data)
│   │   ├── Account                         # IFRS chart of accounts (60+ accounts)
│   │   ├── FinancialPeriod                 # Period management (open/close/roll-forward)
│   │   ├── Document                        # Uploaded documents with AI extraction
│   │   ├── Transaction                     # Transaction grouping (DRAFT/POSTED/REJECTED)
│   │   ├── JournalEntry                    # Immutable ledger entries (debit/credit)
│   │   └── FixedAsset                      # Asset sub-ledger (depreciation tracking)
│   │
│   ├── views.py                            # API endpoints (2034 lines)
│   │   ├── SignupView                      # User registration
│   │   ├── CreateProfileView               # Create business entity
│   │   ├── MyProfileView                   # User's business profile
│   │   ├── DocumentListCreateAPIView       # Document upload & AI processing
│   │   ├── LiveAgentStreamView             # Streaming conversational AI
│   │   ├── WhatsAppWebhookView             # Twilio WhatsApp webhook handler
│   │   ├── WebChatView                     # Web chat conversational interface
│   │   ├── BalanceSheetAPIView             # Balance sheet (SFP) reporting
│   │   ├── PnLView                         # Profit & Loss statement
│   │   ├── CashFlowView                    # Cash flow statement
│   │   ├── JournalEntryListView            # Transaction audit trail
│   │   ├── ManualAdjustmentAPIView         # Manual journal entry posting
│   │   ├── FinancialPeriodListView         # Period management
│   │   ├── CloseFinancialPeriodView        # Period closing (with accruals/depreciation)
│   │   ├── RevokeDocumentView              # Reverse/revoke posted document
│   │   ├── ExportYearEndFinancialsView     # Export financials for reporting
│   │   ├── health_check                    # System health probe
│   │   └── create_superuser_view           # Admin user creation
│   │
│   ├── serializers.py                      # DRF serializers
│   │   ├── BusinessProfileSerializer       # Profile CRUD
│   │   ├── DocumentSerializer              # Document metadata
│   │   ├── AccountSerializer               # Account balance queries
│   │   ├── TransactionSerializer           # Transaction status
│   │   ├── JournalEntrySerializer          # Ledger entry details
│   │   ├── BalanceSheetSerializer          # BS structure + validation
│   │   ├── PnLSerializer                   # P&L line items
│   │   ├── CashFlowSerializer              # Cash flow statement
│   │   ├── CustomTokenObtainPairSerializer # JWT + user metadata
│   │   ├── SignupSerializer                # User registration
│   │   ├── FixedAssetSerializer            # Asset details
│   │   └── ManualAdjustmentSerializer      # Manual entry validation
│   │
│   ├── schemas.py                          # Pydantic validation schemas (166 lines)
│   │   ├── DocumentType                    # Enum: 22+ document classifications
│   │   ├── AssetClass                      # Enum: PPE, Intangibles, Investment Property
│   │   ├── ExpenseCategory                 # Enum: Operating, COGS, Employee Benefits, Finance, D&A
│   │   ├── LineItem                        # Schema: description, qty, unit_price, amount
│   │   ├── EmployeeSalaryLine              # Schema: employee, gross, tax, net
│   │   ├── BankStatementLine               # Schema: date, description, withdrawal, deposit, balance
│   │   └── AgenticPayload                  # Master schema: Complete AI-extracted document
│   │
│   ├── urls.py                             # URL routing (all API endpoints)
│   ├── utils.py                            # Helper functions
│   │   └── get_or_create_business()        # Business entity initialization
│   ├── signals.py                          # Django signals (document post-processing)
│   ├── admin.py                            # Django admin interface
│   ├── apps.py                             # App configuration
│   ├── tests.py                            # Unit tests
│   ├── generate_docs.py                    # API documentation generation
│   ├── generate_friction.py                # Test data/friction scenarios
│   │
│   └── management/commands/                # Django management commands
│       ├── fetch_drone_data.py             # (Legacy) Background data tasks
│       └── fix_misposted_documents.py      # Data correction utilities
│
├── autobooks/                              # Django project configuration
│   ├── settings.py                         # Environment-aware settings
│   │   ├── Database (PostgreSQL)           # Primary datastore
│   │   ├── Celery/Redis config             # Async task broker
│   │   ├── Cloudinary setup                # Media storage
│   │   ├── JWT authentication              # Token-based auth
│   │   ├── CORS config                     # Cross-origin requests
│   │   └── Installed apps                  # Django + DRF + extensions
│   ├── urls.py                             # Root URL dispatcher
│   ├── celery.py                           # Celery configuration (SSL support)
│   ├── wsgi.py                             # WSGI application (production)
│   └── asgi.py                             # ASGI application (async)
│
├── Dockerfile                              # Main application image
│   ├── Base: python:3.11-slim              # Minimal production footprint
│   ├── Stage 1: Deps layer (cached)        # Python packages
│   ├── Stage 2: Source code                # App code
│   └── Stage 3: Entrypoint                 # Container boot sequence
│
├── celery_worker.Dockerfile                # Dedicated celery worker image
├── docker-compose.yaml                     # Local multi-service orchestration
│   ├── django service (port 8000)          # API server
│   ├── postgres service                    # Database
│   ├── redis service                       # Cache/queue broker
│   └── Network: cvlabs                     # Service discovery
│
├── entrypoint.sh                           # Container initialization
│   ├── Postgres readiness check            # Wait for DB
│   ├── Database migrations                 # Schema setup
│   ├── Static files collection             # Assets
│   └── Gunicorn server startup             # App server
│
├── requirements.txt                        # Python dependencies
├── manage.py                               # Django CLI
├── render.yaml                             # Render.com deployment manifest
└── README.md                               # This documentation
```

---

## 📊 Data Models Overview

### User & BusinessProfile
**User** (Django built-in)
- Authentication & authorization
- JWT token generation
- Admin permissions

**BusinessProfile**
- Owns all financial data for a single business entity
- Links to Django User (one-to-one relationship)
- Stores metadata: business_name, address, phone, email, logo (Cloudinary)
- Manages financial year dates (financial_year_start, financial_year_end)
- Manages financial periods (FinancialPeriod children)
- Auto-initializes 60+ IFRS accounts on creation
- Exposes reporting methods: get_balance_sheet(), get_pnl(), get_cash_flow()

### Account (IFRS Chart of Accounts)
- Represents single account in ledger
- IFRS classification: account_code, ifrs_account, account_name, account_class
- Account classes: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
- Running balance (updated atomically on every journal entry)
- 60+ predefined accounts per IFRS for SMEs:
  - **Assets**: cash_and_cash_equivalents, trade_and_other_receivables, inventory, property_plant_equipment, accumulated_depreciation_ppe, intangible_assets, accumulated_amortisation_intangibles, investment_property_cost, investment_property_fair_value, trade_and_other_receivables, biological_assets_fair_value
  - **Liabilities**: trade_and_other_payables, short_term_borrowings, long_term_borrowings, employee_benefits_payable, current_tax_payable, provisions
  - **Equity**: share_capital, retained_earnings, reserves
  - **Income**: revenue, cost_of_goods_sold, other_income, change_in_inventories
  - **Expenses**: operating_expenses, depreciation_and_amortisation, finance_costs, tax_expense, employee_benefits_expense
- Supports contra-accounts (accumulated_depreciation_ppe, accumulated_amortisation_intangibles)
- Enforced constraints:
  - Assets & Expenses carry natural debit balances
  - Liabilities, Equity, Income carry natural credit balances
  - Contra-assets carry credit balances (negative under asset class)

### FinancialPeriod
- Tracks accounting periods (monthly, quarterly, annual)
- Status: OPEN, CLOSED
- Period dates: start_date, end_date
- Opening balances snapshot
- Closing logic:
  - Applies depreciation/amortization on FixedAssets
  - Accrues expenses
  - Calculates period profit
  - Rolls retained earnings forward
  - Prevents posting to closed periods
- Links: BusinessProfile (parent), Transactions (children)

### Document
- Represents uploaded financial document (image or PDF)
- File storage: Cloudinary (cloudinary_url)
- AI-extracted metadata:
  - document_type (enum: 22+ types, see schemas.py)
  - amount (total transaction amount)
  - transaction_date (document date)
  - vendor, customer, billed_to, payment_from (counterparties)
  - invoice_number, receipt_number, bill_number (reference numbers)
  - tax, subtotal, balance (financial details)
  - line_items (JSON: description, qty, unit_price, amount per item)
  - payroll_lines (JSON: employee name, gross, tax, net for salary docs)
  - bank_statement_lines (JSON: date, description, withdrawal, deposit for bank stmts)
- Processing flags:
  - requires_human_review (boolean)
  - human_review_reason (text)
  - ai_detection_override (boolean; true if system re-classified from AI guess)
- Transaction linking: Links to Transaction once validated and posted
- Status pipeline: UPLOADED → VALIDATED → POSTED or REJECTED

### Transaction
- Groups related journal entries (all from single document or manual entry)
- Status lifecycle: DRAFT → POSTED, PENDING_REVIEW, or REJECTED
- Links: Document (source), BusinessProfile, FinancialPeriod
- Fields: transaction_date, description, created_at, updated_at
- Posting logic: Atomic validation → create JournalEntries → update Account balances
- Immutable once POSTED (can only revoke via RevokeDocumentView)

### JournalEntry
- Immutable ledger line item
- Links: Transaction (group), Account (which account), FinancialPeriod
- Entry type: DEBIT or CREDIT
- Amount: Decimal, always positive
- Timestamp: created_at (audit trail)
- Natural balance: 
  - DEBIT increases Assets/Expenses, decreases Liabilities/Equity/Income
  - CREDIT does the opposite
- Validation: Transaction.total_debit == Transaction.total_credit before posting

### FixedAsset (Sub-Ledger)
- Represents single depreciable asset (building, equipment, software, etc.)
- Purchase details:
  - asset_type (enum: property_plant_equipment, intangible_assets, investment_property_cost, etc.)
  - purchase_date, purchase_cost
  - useful_life_years, residual_value
  - depreciation_method (straight_line, reducing_balance)
  - asset_description (free text)
- Running calculations:
  - accumulated_depreciation (sum of annual depreciation charges)
  - net_book_value = purchase_cost - accumulated_depreciation
- Links: Account (where depreciation posts), FixedAsset.account_field
- Depreciation posting:
  - On FinancialPeriod.close(), system calculates depreciation_expense
  - Posts debit to depreciation_and_amortisation (expense), credit to accumulated_depreciation_ppe (contra-asset)
  - Updates Account balances automatically

---

## 🔌 API Endpoints

### Authentication & User Management
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/signup/` | User registration (email/password) | None |
| POST | `/token/` | Obtain JWT access + refresh tokens | Username/password |
| POST | `/token/refresh/` | Refresh expired access token | Refresh token |
| POST | `/create-superuser/` | Create admin/superuser account | None |
| GET | `/health` | Health check (readiness probe) | None |

### Business Profile Management
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/create-profile/` | Create business entity | Bearer JWT |
| GET | `/business/` | Get current user's business | Bearer JWT |
| GET/PUT | `/business/profile/` | View/update business profile | Bearer JWT |

### Document Management
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET/POST | `/api/documents/` | List documents / Upload new document | Bearer JWT |
| POST | `/api/documents/<id>/revoke/` | Revoke/reverse posted document | Bearer JWT |

### Financial Reporting
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/balance-sheet/` | Balance Sheet (Statement of Financial Position) | Bearer JWT |
| GET | `/pnl/` | Profit & Loss (Income Statement) | Bearer JWT |
| GET | `/cashflow/` | Cash Flow Statement | Bearer JWT |
| GET | `/journal-entries/` | Audit trail (all transactions) | Bearer JWT |
| GET | `/export-financials/` | Export full year-end financials (PDF/Excel) | Bearer JWT |

### Period Management
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/financial-periods/` | List all periods (open/closed) | Bearer JWT |
| POST | `/financial-period/close/` | Close current period (accrue, depreciate, roll forward) | Bearer JWT |

### Accounting Operations
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/manual-adjustment/` | Post manual journal entry (for adjustments) | Bearer JWT |

### AI Agents (Conversational)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/live-agent-stream/` | Streaming AI assistant (server-sent events) | Bearer JWT |
| POST | `/whatsapp-webhook/` | Twilio WhatsApp webhook (inbound messages) | Twilio signature |
| POST | `/api/chat/` | Web chat conversational interface | Bearer JWT |

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup/` | User registration |
| POST | `/token/` | Obtain JWT access/refresh tokens |
| POST | `/token/refresh/` | Refresh access token |
| POST | `/create-superuser/` | Create admin user |

### Business Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-profile/` | Create business profile |
| GET | `/business/` | Get current user's business |
| GET/PUT | `/business/profile/` | View/update business profile |

### Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/documents/` | List/upload documents |
| POST | `/api/documents/<id>/revoke/` | Revoke posted document |

### Financial Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/balance-sheet/` | Balance Sheet (SFP) |
| GET | `/pnl/` | Profit & Loss Statement |
| GET | `/cashflow/` | Cash Flow Statement |
| GET | `/journal-entries/` | Audit trail of all entries |

### Financial Periods
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/financial-periods/` | List all periods |
| POST | `/financial-periods/close/` | Close current period |

### Accounting Operations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/manual-adjustment/` | Post manual journal entry |

### AI Agents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/live-agent-stream/` | Streaming AI assistant |
| POST | `/whatsapp-webhook/` | WhatsApp webhook endpoint |
| POST | `/api/chat/` | Web-based chat interface |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check endpoint |

---

## 🧠 AI Integration

### Document Processing Flow
---

## 🧠 AI Integration & Document Processing

### Document Processing Pipeline

**Step-by-Step Flow:**

```
1. CLIENT UPLOADS DOCUMENT
   └─→ POST /api/documents/ with file + business_id
   
2. API STORES FILE
   └─→ Cloudinary cloud storage (on-demand image transformation)
   
3. CELERY TASK TRIGGERED (async, non-blocking)
   └─→ ingest_agentic_payload() in views.py
   
4. GOOGLE GEMINI AI ANALYSIS
   Input: Image/PDF binary
   Output: Structured JSON via Pydantic AgenticPayload schema
   ├─ Document type classification (invoice, receipt, bill, payroll, asset_purchase, etc.)
   ├─ Financial amounts extraction (total, subtotal, tax, balance)
   ├─ Counterparty detection (vendor, customer, billed_to, payment_from)
   ├─ Line items parsing (product/service details with amounts)
   ├─ Reference numbers (invoice #, receipt #, PO #)
   └─ Dynamic categorization (asset_class for purchases, expense_category for bills)
   
5. PYDANTIC VALIDATION
   └─→ Validate extracted data against AgenticPayload schema
       (Type checking, amount precision, enum constraints)
   
6. ENTITY VERIFICATION (DETERMINISTIC OWNERSHIP CHECK)
   ├─ Normalize business name (strip punctuation, remove common suffixes)
   ├─ Pool ALL extracted text (vendor, customer, billed_to, narration, etc.)
   ├─ Check: Does our business name appear ANYWHERE in the document?
   └─ Result: ownership_verified = True/False
   
7. ANOMALY DETECTION & FINAL BOSS OVERRIDE
   If ownership_verified = False:
   ├─ Set requires_human_review = True
   ├─ Store reason: "Ownership Mismatch: Document not addressed to <business>"
   └─ FINAL BOSS LOGIC:
       If (document was invoice AND ownership mismatch detected):
       ├─ Re-classify: invoice → bill
       ├─ Log override: "Document classified as bill (not invoice)"
       └─ Rationale: We can't issue an invoice to ourselves; re-classify as inbound bill
   
   Else (no ownership mismatch):
   └─ Use AI's original classification
   
8. TRANSACTION POSTING (IF VALIDATED)
   ├─ Create Transaction record (status=DRAFT)
   ├─ Generate JournalEntries based on document_type:
   │  ├─ Invoice       → Debit:Receivables, Credit:Revenue
   │  ├─ Receipt       → Debit:Cash, Credit:Receivables
   │  ├─ Bill          → Debit:Expense, Credit:Payables
   │  ├─ Payroll       → Debit:Benefits_Expense, Credit:Cash
   │  ├─ Asset         → Debit:PPE, Credit:Cash
   │  └─ ... (22 document types, each with specific GL mappings)
   │
   ├─ DOUBLE-ENTRY VALIDATION:
   │  └─→ Sum(debits) == Sum(credits) within 2 decimal places?
   │       ├─ YES: Post all entries atomically
   │       └─ NO: Flag as requires_human_review, status=REJECTED
   │
   ├─ UPDATE ACCOUNT BALANCES (atomic)
   │  └─→ For each JournalEntry:
   │       Account.balance += debit_amount OR -= credit_amount
   │
   └─ SET DOCUMENT STATUS = POSTED
   
9. AUDIT TRAIL PRESERVATION
   ├─ Original AI detection: payload.document_type.value
   ├─ System override applied: ai_detection_override = True (if reclassified)
   ├─ Human review flag: requires_human_review + reason
   ├─ JournalEntry timestamps: immutable proof of posting time
   └─ Transaction status: POSTED (immutable, can only revoke)
   
10. CLIENT SEES UPDATED LEDGER
    └─→ Balance Sheet, P&L, Cash Flow, Journal Entries all updated
        (Real-time, no lag)
```

### Pydantic Schemas (Type Safety)

**AgenticPayload** (Master Schema)
- Enforces 1:1 mapping between AI extraction and Document model
- All fields strictly typed: Decimal for amounts, datetime_date for dates, Enum for classifications
- Validation rules:
  - total must not be negative
  - date in YYYY-MM-DD format
  - document_type must match one of 22 enum values
  - asset_class and expense_category validated only when relevant
  - Line items validated recursively

**Sub-Schemas:**
- `LineItem`: description (str), quantity (Decimal), unit_price (Decimal), amount (Decimal)
- `EmployeeSalaryLine`: employee_name (str), gross_pay (Decimal), tax_deducted (Decimal), net_pay (Decimal)
- `BankStatementLine`: date, description, withdrawal (Decimal), deposit (Decimal), balance (Decimal)

**Benefits of Pydantic:**
- Type checking at API boundary (no invalid data enters ledger)
- Clear error messages (what field, what constraint violated)
- JSON serialization for API responses
- IDE autocomplete support for developers

### AI Safety Features

| Feature | Mechanism | Benefit |
|---------|-----------|---------|
| **Entity Mismatch Detection** | Normalize business name; check if appears in document | Prevents posting 3rd-party documents; catches phishing |
| **Final Boss Override** | Auto-reclassify invoice→bill if entity mismatch | Self-healing; reduces human review burden |
| **Human-in-the-Loop** | Documents with anomalies flagged requires_human_review | Accountant approval before posting unknown/suspicious docs |
| **Audit Preservation** | Store original AI detection + override reason | Compliance; explains why classification changed |
| **Decimal Precision** | All amounts rounded to 2 decimal places (ROUND_HALF_UP) | No floating-point errors in financial reporting |
| **Atomic Posting** | Transaction.post() validates BEFORE database commit | No partial updates; ledger is always in valid state |
| **Immutable Entries** | JournalEntries cannot be edited (only revoked) | Permanent audit trail; regulatory compliance |

### Document Type Mappings (22+ Types)

Each document type maps to specific IFRS accounts:

| Document Type | Debit Account | Credit Account | Special Logic |
|---------------|---------------|----------------|---------------|
| **invoice** | Trade & Other Receivables | Revenue | Entity mismatch → re-classify to bill |
| **receipt** | Cash & Equivalents | Trade & Other Receivables | Settles invoice |
| **bill** | Operating Expenses / Payables | Trade & Other Payables | Expense classification extracted by AI |
| **credit_note** | Revenue (reversal) | Trade & Other Receivables | Negative amount entry |
| **debit_note** | Trade & Other Payables | Operating Expenses (reversal) | Negative payable |
| **payroll** | Employee Benefits Expense | Cash & Equivalents | Payroll lines parsed; tax deducted |
| **asset_purchase** | PPE / Intangibles (per asset_class) | Cash & Equivalents | Creates FixedAsset sub-ledger |
| **equity_injection** | Cash & Equivalents | Share Capital | Increases equity |
| **short_term_borrowing** | Cash & Equivalents | Short-term Borrowings | Liability |
| **long_term_borrowing** | Cash & Equivalents | Long-term Borrowings | Non-current liability |
| **lease_agreement** | PPE (ROU Asset) | Lease Liabilities | IFRS 16 (future enhancement) |
| **bank_statement** | Cash & Equivalents (per line) | Various (balancing) | Bank rec lines parsed; netted |
| **tax_filing** | Tax Expense | Current Tax Payable | Assessed tax amount |
| **purchase_order** | Inventory (commitment) | Trade Payables | Contingent entry (future) |
| **expense_claim** | Operating Expenses | Cash / Payables | Employee reimbursement |
| **customer_contract** | N/A | Revenue (deferred) | IFRS 15 revenue recognition (future) |
| ... | ... | ... | ... |

---

## 🛠️ Technology Stack

### Backend Framework
- **Django 5.1.7** - Web framework with ORM
- **Django REST Framework (DRF) 3.16.0** - API serialization and viewsets
- **djangorestframework-simplejwt 5.5.0** - JWT authentication (stateless)
- **django-cors-headers 4.7.0** - Cross-origin resource sharing
- **python-decouple 3.8** - Environment variable management

### Database & Caching
- **PostgreSQL 15** - Primary relational database
- **psycopg2-binary 2.9.10** - PostgreSQL adapter
- **Redis 7** - In-memory cache and message broker
- **dj-database-url 1.2.0** - Parse DATABASE_URL

### AI & Machine Learning
- **google-genai 1.2.0** - Google Gemini AI API (document processing)
- **google-cloud-text-to-speech 2.24.1** - Text-to-speech for WhatsApp/Web responses
- **pydantic >=2.0.0** - Data validation (schemas)

### Async Task Processing
- **celery 5.5.3** - Distributed task queue
- **redis 5.3.0** - Celery broker
- **flower 2.0.1** - Celery task monitoring UI

### Media Storage
- **cloudinary 1.40.0** - Cloud image/document storage
- **django-cloudinary-storage 0.3.0** - Django integration
- **Pillow 10.3.0** - Image processing

### Communication
- **twilio** - WhatsApp API integration
- **requests 2.32.3** - HTTP client library

### WSGI/ASGI Servers
- **gunicorn 23.0.0** - Production WSGI server
- **channels** (optional) - WebSocket support for real-time chat

### Blockchain (Optional)
- **web3 >=6.0.0** - Ethereum interaction
- **eth-account >=0.10.0** - Ethereum account management

### Development & Deployment
- **Docker** - Container runtime
- **Docker Compose** - Multi-container orchestration

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.11+** - Python runtime
- **PostgreSQL 15+** - Relational database
- **Redis 7+** - Cache and message broker
- **Docker & Docker Compose** (optional) - Container orchestration
- **Google Cloud Platform account** - For Gemini AI and Text-to-Speech APIs
- **Twilio account** - For WhatsApp integration (optional)
- **Cloudinary account** - For document storage

### Environment Variables

Create a `.env` file in the project root. Use `.env.example` as template:

```bash
# ===== DJANGO SETTINGS =====
SECRET_KEY=your-super-secret-key-generate-with-secrets.token_urlsafe()
DEBUG=False  # Set to True for local development only
ENV=production  # Options: local, staging, production
ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com,localhost

# ===== DATABASE (PostgreSQL) =====
# Option A: Single DATABASE_URL (preferred for cloud deployment)
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Option B: Separate credentials (legacy, for Railway/docker-compose)
DATABASE_NAME=fintech_db
DATABASE_USER=postgres
DATABASE_PASSWORD=your_secure_password
DATABASE_HOST=postgres  # Use 'postgres' if in docker-compose
DATABASE_PORT=5432

# ===== CACHE & MESSAGE BROKER (Redis) =====
REDIS_URL=redis://redis:6379/0  # Use 'redis' as hostname in docker-compose
# For production (Render/Railway):
# REDIS_URL=rediss://your-redis-host:6379?ssl_cert_reqs=none

# ===== CLOUD STORAGE (Cloudinary) =====
CLOUDINARY_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# ===== GOOGLE CLOUD PLATFORM =====
GCP_PROJECT_ID=your-gcp-project-id
GCP_LOCATION=us-central1  # Region for Text-to-Speech

# Note: For GCP Service Account, either:
#   1. Place JSON at /etc/secrets/gcp_sa.json (production)
#   2. Place JSON locally and set GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
#   3. Use Workload Identity Federation (GKE)
#   4. Use Application Default Credentials (gcloud auth application-default login)

# ===== AUTHENTICATION =====
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com
JWT_SECRET=optional-secret-for-custom-jwt-signing  # Uses SECRET_KEY by default

# ===== TWILIO (WhatsApp Integration) =====
TWILIO_ACCOUNT_SID=AC0000000000000000000000000000
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886  # Sandbox or your business number

# ===== OPTIONAL: EMAIL (for future user notifications) =====
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-specific-password

# ===== OPTIONAL: SENTRY (Error tracking) =====
SENTRY_DSN=https://your-sentry-url

# ===== OPTIONAL: ENVIRONMENT-SPECIFIC =====
LOG_LEVEL=INFO
SECURE_SSL_REDIRECT=True  # For production HTTPS
CSRF_COOKIE_SECURE=True   # For production HTTPS
SESSION_COOKIE_SECURE=True # For production HTTPS
```

### Installation (Local Development)

**1. Clone the repository**
```bash
git clone https://github.com/yourusername/fintech-backend.git
cd fintech-backend
```

**2. Create and activate virtual environment**
```bash
# macOS/Linux
python3.11 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

**3. Install Python dependencies**
```bash
pip install -r requirements.txt
```

**4. Configure Google Cloud credentials**
```bash
# Download service account JSON from GCP Console
# Save to project root or /etc/secrets/gcp_sa.json
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/gcp_sa.json"
```

**5. Create .env file**
```bash
# Copy template and fill in values
cp .env.example .env
# Edit .env with your credentials
```

**6. Run database migrations**
```bash
python manage.py migrate
```

**7. Create cache table** (if using database cache)
```bash
python manage.py createcachetable
```

**8. Create superuser** (admin account)
```bash
python manage.py createsuperuser
# Follow prompts for email and password
```

**9. Create a test business profile** (optional)
```bash
python manage.py shell
>>> from app.models import BusinessProfile
>>> from django.contrib.auth.models import User
>>> user = User.objects.get(username='admin')
>>> bp = BusinessProfile.objects.create(
...     user=user,
...     business_name='Acme Corp',
...     address='123 Main St',
...     phone='+1234567890',
...     email='info@acme.com'
... )
>>> exit()
```

**10. Run development server**
```bash
python manage.py runserver
# API available at http://localhost:8000
```

**11. Run Celery worker** (in separate terminal)
```bash
celery -A autobooks worker --loglevel=info
```

**12. Monitor Celery tasks** (optional, in separate terminal)
```bash
celery -A autobooks flower --port=5555
# Flower UI available at http://localhost:5555
```

---

### Installation (Docker Compose - Recommended)

**1. Clone and setup**
```bash
git clone https://github.com/yourusername/fintech-backend.git
cd fintech-backend
cp .env.example .env
# Edit .env with your values (Cloudinary, GCP, Twilio, etc.)
```

**2. Ensure Docker network exists**
```bash
docker network create cvlabs 2>/dev/null || true
```

**3. Build and start all services**
```bash
docker-compose up --build
# Services start in the following order:
#  - PostgreSQL (with health check)
#  - Redis (with health check)
#  - Django API (waits for Postgres readiness)
#  - (optional) Celery worker
#  - (optional) Flower monitoring
```

**4. Access services**
```
Django API:        http://localhost:8000
Flower Monitor:    http://localhost:5555
PostgreSQL:        localhost:5432
Redis:             localhost:6379
```

**5. View logs**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f django
docker-compose logs -f postgres
docker-compose logs -f redis
```

**6. Stop services**
```bash
docker-compose down
# Add -v to remove volumes (databases)
docker-compose down -v
```

---

### Installation (Production - Render.com)

The project includes `render.yaml` for one-click deployment to Render:

```bash
# Push to GitHub and connect to Render
# Render auto-detects render.yaml and deploys web + worker services
```

**render.yaml structure:**
```yaml
services:
  - type: web
    name: fintech-backend
    runtime: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "gunicorn autobooks.wsgi:application --bind 0.0.0.0:$PORT"
    
  - type: worker
    name: fintech-celery
    runtime: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "celery -A autobooks worker"
```

### 1. Create Business Profile

```bash
POST /create-profile/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "business_name": "Acme Corporation",
  "address": "123 Main St, City, Country",
  "phone": "+1234567890",
  "email": "info@acme.com",
  "financial_year_start": "2024-01-01",
  "financial_year_end": "2024-12-31"
}
```

### 2. Upload & Process Document

```bash
POST /api/documents/
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <invoice.pdf>
business: 1
```

**AI automatically:**
- Classifies document type
- Extracts amounts, dates, parties
- Validates entity
- Posts to correct accounts
- Creates audit trail

### 3. Get Balance Sheet

```bash
GET /balance-sheet/
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "business": "Acme Corporation",
  "period": "2024-01-01 to 2024-12-31",
  "assets": {
    "Current Assets": {
      "accounts": [
        {
          "code": "cash_and_cash_equivalents",
          "name": "Cash and Cash Equivalents",
          "balance": "50000.00"
        },
        ...
      ],
      "subtotal": "120000.00"
    },
    "Non-Current Assets": {...},
    "total": "250000.00"
  },
  "liabilities": {...},
  "equity": {...},
  "validation": {
    "balanced": true,
    "equation": "Assets (250000.00) = Liabilities (100000.00) + Equity (150000.00)"
  }
}
```

### 4. Manual Journal Entry

```bash
POST /manual-adjustment/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "date": "2024-03-04",
  "description": "Accrued interest expense",
  "entries": [
    {
      "ifrs_account": "finance_costs",
      "amount": "500.00",
      "type": "debit"
    },
    {
      "ifrs_account": "trade_and_other_payables",
      "amount": "500.00",
      "type": "credit"
    }
  ]
}
```

### 5. Chat with AI Agent

```bash
POST /api/chat/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "message": "What was my revenue last month?",
  "business_id": 1
}
```

---

## 🔒 IFRS Rules Engine

### Accounting Rules Enforced

1. **Double-Entry Bookkeeping**
   - Every transaction has equal debits and credits
   - Amounts validated to 2 decimal places
   - No negative amounts allowed (use reverse entries)

2. **Depreciation & Amortization** (IAS 16, IAS 38)
   - Straight-line method: `(Cost - Residual) / Useful Life`
   - Reducing balance method: `Net Book Value × Rate`
   - Automatic calculation on period close

3. **Impairment** (Section 27)
   - Net Realizable Value (NRV) calculation
   - Impairment loss recognition
   - Inventory write-downs

4. **Balance Sheet Equation**
   - Assets = Liabilities + Equity
   - Validation on every report
   - Current year profit included in equity

5. **Period Management**
   - Retained earnings roll-forward
   - Depreciation accrual on close
   - Prevents posting to closed periods

### Transaction Posting Logic

Each document type maps to specific IFRS accounts:

| Document Type | Debit Account | Credit Account |
|---------------|---------------|----------------|
| Invoice | Trade Receivables | Revenue |
| Receipt | Cash | Trade Receivables |
| Bill | Operating Expenses | Trade Payables |
| Payroll | Employee Benefits | Cash |
| Asset Purchase | PPE/Intangibles | Cash |
| Equity Injection | Cash | Share Capital |
| Borrowing | Cash | Borrowings |
| Credit Note | Revenue | Trade Receivables |
| Payment Voucher | Trade Payables | Cash |

---

## 🧪 Testing

```bash
# Run all tests
python manage.py test

# Run specific test module
python manage.py test app.tests

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

---

## 📦 Deployment

### Render.com

The project includes `render.yaml` for Render deployment:

```yaml
services:
  - type: web
    name: macfo-backend
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "gunicorn autobooks.wsgi:application"
    
  - type: worker
    name: macfo-celery
    env: python
    buildCommand: "pip install -r requirements.txt"
    startCommand: "celery -A autobooks worker"
```

### Docker Production

```bash
# Build production image
docker build -f Dockerfile -t macfo-backend:latest .

# Run with environment file
docker run -p 8000:8000 --env-file .env macfo-backend:latest
```

### Environment-Specific Settings

- **Development**: `ENV=local` - Uses `DATABASE_URL`
- **Production**: `ENV=production` - Uses separate DB credentials
- SSL/TLS enforced for Redis in production (`rediss://`)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **IFRS Foundation** - International Financial Reporting Standards
- **Google Cloud Platform** - Gemini AI and Text-to-Speech
- **Django Software Foundation** - Web framework
- **Twilio** - WhatsApp integration

---

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub or contact the development team.

---

## 🗺️ Roadmap

- [ ] Multi-currency support
- [ ] Consolidated financial statements
- [ ] Advanced tax calculations
- [ ] Budget vs. Actual reporting
- [ ] Cash flow forecasting
- [ ] Integration with banking APIs
- [ ] Mobile application
- [ ] Real-time collaboration
- [ ] Blockchain audit trail
- [ ] Advanced analytics dashboard

---

**Built with ❤️ for accountants, by developers who care about financial accuracy.**

### Document
- Stores uploaded documents (images/PDFs)
- AI-extracted metadata (type, amounts, dates, parties)
- Line-item details stored as JSON
- Entity verification flags
- Human review workflow support
- Auto-posts to ledger when validated

### Transaction
- Groups related journal entries
- Links to source document
- Transaction status tracking (DRAFT, POSTED, PENDING_REVIEW, REJECTED)
- Date and description
- Atomic posting with validation

### JournalEntry
- Individual debit/credit line items
- Links to Account and Transaction
- Amount and entry type (debit/credit)
- Immutable audit trail

### FixedAsset (Sub-Ledger)
- Tracks depreciable assets
- Purchase cost, useful life, residual value
- Depreciation method (straight-line, reducing balance)
- Accumulated depreciation tracking
- Links to IFRS property/plant/equipment accounts
- Rolls net profit into retained earnings

### Transaction & JournalEntry
- Enforces double-entry accounting
- Atomic posting with database transactions
- Generates immutable journal entries

### Document
- Represents uploaded financial documents
- Automatically posts accounting entries on creation
- Supports invoices, receipts, payroll, assets, loans, and more

---

## 📝 Usage Examples

### 1. User Registration

```bash
POST /signup/
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "secure_password_123"
}

Response (201 Created):
{
  "id": 1,
  "username": "john_doe",
  "email": "john@example.com"
}
```

### 2. Obtain JWT Tokens

```bash
POST /token/
Content-Type: application/json

{
  "username": "john_doe",
  "password": "secure_password_123"
}

Response (200 OK):
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user_id": 1,
  "username": "john_doe"
}
```

### 3. Create Business Profile

```bash
POST /create-profile/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "business_name": "Acme Manufacturing Ltd",
  "address": "123 Industrial Way, NY",
  "phone": "+1 (212) 555-0123",
  "email": "accounting@acme.com",
  "financial_year_start": "2024-01-01",
  "financial_year_end": "2024-12-31"
}

Response (201 Created):
{
  "id": 1,
  "business_name": "Acme Manufacturing Ltd",
  "account_count": 60,
  "accounts_initialized": true
}
```

### 4. Upload & Process Document

```bash
POST /api/documents/
Authorization: Bearer <access_token>
Content-Type: multipart/form-data

file: <invoice.pdf>
business: 1

Response (201 Created):
{
  "id": 1,
  "document_type": "invoice",
  "amount": "5000.00",
  "status": "POSTED",
  "requires_human_review": false,
  "transaction": {
    "id": 1,
    "status": "POSTED",
    "journal_entries_count": 2
  } 
}
```

### 5. Get Balance Sheet

```bash
GET /balance-sheet/?period_id=1
Authorization: Bearer <access_token>

Response (200 OK):
{
  "business": "Acme Manufacturing Ltd",
  "assets": {
    "total_assets": "1050000.00"
  },
  "liabilities": {
    "total_liabilities": "550000.00"
  },
  "equity": {
    "total_equity": "500000.00"
  },
  "validation": {
    "balanced": true,
    "equation": "Assets = Liabilities + Equity ✓"
  }
}
```

### 6. Manual Journal Entry

```bash
POST /manual-adjustment/
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "date": "2024-03-04",
  "description": "Accrued interest expense",
  "entries": [
    {
      "ifrs_account": "finance_costs",
      "amount": "500.00",
      "type": "debit"
    },
    {
      "ifrs_account": "trade_and_other_payables",
      "amount": "500.00",
      "type": "credit"
    }
  ]
}

Response (201 Created):
{
  "validation": {
    "balanced": true,
    "total_debit": "500.00",
    "total_credit": "500.00"
  }
}
```

---

## 🔒 IFRS Rules Engine

### Accounting Principles Enforced

#### 1. Double-Entry Bookkeeping
Every transaction has equal debits and credits, validated to 2 decimal places, with atomic database commits.

#### 2. Depreciation & Amortization (IAS 16, IAS 38)
- Straight-line: (Cost - Residual) / Useful Life
- Reducing balance: Net Book Value × (1.5 / Useful Life)
- Automatic accrual on period close

#### 3. Impairment (Section 27)
Net Realizable Value (NRV) testing with automatic loss recognition.

#### 4. Balance Sheet Equation
Assets = Liabilities + Equity (validated on every report).

#### 5. Period Management
- OPEN → CLOSED → Roll Forward → Next Period OPEN
- Depreciation, accruals, and retained earnings roll-forward on close
- Prevents posting to closed periods

#### 6. Account Class Semantics
Assets/Expenses carry debit balances; Liabilities/Equity/Income carry credit balances.

---

## 🧪 Testing

```bash
# Run all tests
python manage.py test

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

---

## 📦 Deployment

### Docker Production

```bash
docker build -f Dockerfile -t fintech-backend:latest .
docker run -p 8000:8000 --env-file .env fintech-backend:latest
```

### Render.com

Push to GitHub; Render auto-detects `render.yaml` and deploys services.

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push and open Pull Request

---

## 📄 License

MIT License 
