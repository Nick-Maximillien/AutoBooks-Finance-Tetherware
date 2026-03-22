# IFRS_Backend: Deterministic Accounting Engine

A production-grade Django application implementing IFRS for SMEs accounting rules as a deterministic, auditable ledger system. The IFRS_Backend serves as the financial truth layer for the AutoBooks Finance system, enforcing double-entry bookkeeping invariants and generating IFRS-compliant financial statements.

## Overview

The IFRS_Backend provides:

- **IFRS-Compliant Chart of Accounts**: 60+ predefined accounts mapped to IFRS for SMEs (2025 Third Edition)
- **Double-Entry Enforcement**: Atomic transaction validation ensuring debits always equal credits
- **Multi-Document Auto-Classification**: Intelligent document type identification using LLM analysis
- **Deterministic Audit Gates**: Validation rules that produce identical results across system instances
- **Comprehensive Financial Reporting**: Balance sheet, P&L, cash flow, and journal entry APIs
- **Immutable Audit Trail**: All transactions permanently recorded with user identity and timestamp
- **REST API**: Full HTTP interface for transaction posting and report generation

## Architecture

### System Components

```
┌─────────────────────────────────────────┐
│     Frontend-UI (Document Upload)       │
└──────────────────┬──────────────────────┘
                   │
          REST API POST /transactions
                   │
                   ▼
        ┌──────────────────────┐
        │  Transaction Parser  │  Validates request format
        └──────────────┬───────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │ Document Classification  │  LLM-based type detection
        │ (Google Gemini AI)       │  Entity verification
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Account Mapping Engine  │  Map transaction to IFRS codes
        │  (Deterministic)         │  Validate account semantics
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Double-Entry Validator  │  Verify debits = credits
        │  (Atomic Invariant)      │  Check amount constraints
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Ledger Postings         │  PostgreSQL transaction
        │  (Immutable)             │  Journal entry creation
        └──────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────┐
        │  Response to Frontend    │  Status confirmation
        │  (Ledger Balance Update) │  Posting acknowledgment
        └──────────────────────────┘
```

### Data Model Hierarchy

**Chart of Accounts (60+ Accounts)**

```
ASSETS
├── Current Assets
│   ├── 1110 Cash and Cash Equivalents
│   ├── 1120 Short-term Investments
│   ├── 1130 Accounts Receivable
│   ├── 1140 Less: Allowance for Doubtful Accounts (Contra)
│   ├── 1210 Inventories
│   └── 1290 Other Current Assets
└── Non-Current Assets
    ├── 1310 Property, Plant & Equipment
    ├── 1311 Less: Accumulated Depreciation (Contra)
    ├── 1410 Intangible Assets
    ├── 1411 Less: Accumulated Amortization (Contra)
    └── 1510 Investment Property

LIABILITIES
├── Current Liabilities
│   ├── 2110 Accounts Payable
│   ├── 2120 Short-term Borrowings
│   ├── 2130 Current Portion of Long-term Debt
│   └── 2210 Other Current Liabilities
└── Non-Current Liabilities
    ├── 2310 Long-term Borrowings
    ├── 2320 Deferred Tax Liabilities
    └── 2330 Long-term Provisions

EQUITY
├── 3110 Share Capital
├── 3120 Share Premium
├── 3210 Retained Earnings
└── 3220 Other Reserves

INCOME
├── 4110 Revenue from Sales
├── 4120 Revenue from Services
├── 4210 Cost of Sales
├── 4220 Cost of Services
└── 4300 Other Income

EXPENSES
├── 5110 Employee Salaries and Benefits
├── 5120 Depreciation and Amortization
├── 5130 Rent and Utilities
├── 5140 Professional Fees
├── 6110 Finance Costs
└── 6210 Income Tax Expense
```

## Key Features

### 1. Deterministic Double-Entry Validation

Every transaction undergoes atomic validation:

- **Structural Integrity**: Sum of debits equals sum of credits (to 2 decimal places)
- **Amount Constraints**: No negative amounts permitted; reversals only via debit/credit swap
- **Account Class Semantics**: Assets can only be debited; liabilities can only be credited
- **Period Validation**: Transactions posted only to open periods
- **Entity Verification**: Counterparty matches business entity configuration

Example validation ruleset:

```
Transaction: Invoice receipt from customer
Rule 1: Verify document_type = "INVOICE" (LLM classification)
Rule 2: Verify currency_code matches entity base currency
Rule 3: Map to accounts: 1130 (DR) Revenue Entity, 4110 (CR) Revenue
Rule 4: Validate debits = credits (1130 amount = 4110 amount)
Rule 5: Check 1130 is asset (debit side valid)
Rule 6: Check 4110 is income (credit side valid)
Rule 7: Verify entity_id matches invoice recipient
Rule 8: Confirm accounting_period is open
Result: POSTED to ledger if all rules pass; REJECTED if any rule fails
```

### 2. Multi-Document Auto-Classification

Uploaded documents are processed through an intelligent pipeline:

**Processing Pipeline**:

1. **OCR Extraction**: Images/PDFs converted to text using computer vision
2. **LLM Analysis**: Google Gemini AI analyzes content to determine document type
3. **Field Extraction**: Structured extraction of amounts, dates, entities, line items
4. **Entity Verification**: Confirms document recipient matches business entity
5. **Mismatch Detection**: Flags entity mismatches for human review
6. **Auto-Correction**: Invoice → Bill reclassification if entity mismatch detected
7. **Auto-Posting**: Valid documents post to ledger with zero manual intervention

**Supported Document Types** (22+ types):

| Category    | Document Types                                    | Primary Accounts                        |
|-------------|---------------------------------------------------|-----------------------------------------|
| Revenue    | Invoice, Contract, Quotation, Delivery Note      | 1130 (Receivable), 4110 (Revenue)      |
| Expenses   | Bill, Expense Claim, Purchase Order              | 2110 (Payable), 5110+ (Expenses)       |
| Adjustments| Credit Note, Debit Note                          | 1130/2110 (Receivable/Payable), 4300   |
| Cash       | Receipt, Payment Voucher, Bank Statement         | 1110 (Cash), 1130/2110                 |
| Assets     | Asset Purchase, Lease Agreement                  | 1310/1410 (PPE/Intangible), 1110       |
| Capital    | Equity Injection, Borrowing Agreement            | 3110/3120 (Equity), 2310 (LT Debt)    |
| Other      | Tax Filing, Journal Entry, Unknown               | Various depending on content            |

### 3. Audit Gates and Validation

Deterministic rules applied at transaction posting:

**Audit Gate 1: Document Authenticity**
- Verifies document format is recognized (PDF, JPG, PNG, XLSX)
- Confirms file size is within acceptable limits
- Checks for incomplete data extraction (e.g., missing amount)

**Audit Gate 2: Business Logic**
- Ensures transaction counterparty is valid
- Validates amounts fall within entity risk tolerance
- Checks transaction does not violate period lock constraints

**Audit Gate 3: Accounting Rules**
- Applies IFRS measurement rules (e.g., no negative inventory)
- Enforces account class constraints (debit/credit appropriateness)
- Validates revenue recognition criteria are met

**Audit Gate 4: Ledger Integrity**
- Confirms transaction maintains double-entry invariant
- Verifies posting does not create orphaned entries
- Validates sequential posting preserves audit trail order

### 4. Financial Statement Generation

REST API endpoints generate IFRS-compliant statements:

**Balance Sheet (Statement of Financial Position)**
- Segregates assets into current and non-current
- Segregates liabilities into current and non-current
- Shows equity breakdown with retained earnings reconciliation
- Validates equation: Assets = Liabilities + Equity
- Supports as-of date queries and period comparisons

**Profit & Loss (Income Statement)**
- Aggregates revenue line items
- Deducts cost of sales (gross profit)
- Shows operating expenses and operating profit
- Displays finance costs and tax adjustments
- Final profit for period calculation

**Cash Flow Statement**
- Organizes activities into operating, investing, financing
- Reconciles net income to operating cash flow
- Tracks investing cash outflows (asset purchases)
- Tracks financing cash flows (borrowings, equity)

**Journal Entry Audit Trail**
- Lists all transactions posted to a specific account
- Shows transaction date, description, debit/credit amount, running balance
- Includes reversal entries and correction entries
- Permanently immutable; entries cannot be deleted

### 5. Immutable Audit Trail

Every transaction creates an immutable record:

```sql
CREATE TABLE JournalEntry (
    id UUID PRIMARY KEY,
    transaction_id UUID,
    account_code VARCHAR(10),
    debit_amount DECIMAL(19,2),
    credit_amount DECIMAL(19,2),
    posting_date DATE,
    created_at TIMESTAMP,
    created_by VARCHAR(255),
    description TEXT,
    document_reference VARCHAR(255),
    status ENUM('POSTED', 'REVERSED'),
    reversal_of_id UUID  -- Reference to original if reversed
);
```

Records include:
- User identity and timestamp
- Source document reference
- Complete transaction context
- Original and reversal entries for corrections

## Tech Stack

| Component         | Technology              | Purpose                              |
|-------------------|-------------------------|--------------------------------------|
| Framework         | Django 5.2.7            | Core application framework           |
| REST API          | Django REST Framework   | HTTP API implementation              |
| ORM               | Django ORM              | Database abstraction                 |
| Database          | PostgreSQL 15           | Relational ledger storage            |
| Task Queue        | Celery 5.5.3            | Async document processing           |
| Message Broker    | Redis 5.3.0             | Task queue backend                  |
| Password Hashing  | argon2-cffi             | User authentication                 |
| Authentication    | djangorestframework-simplejwt | JWT token management          |
| Document Process  | Google Gemini AI        | Document classification & extraction|
| Media Storage     | Cloudinary              | Document file storage               |
| Web Server        | Gunicorn 23.0.0         | WSGI HTTP server                    |
| Containerization  | Docker                  | Application deployment              |

## Installation & Setup

### Prerequisites

- Python 3.11 or higher
- PostgreSQL 15 or higher
- Redis 7 or higher
- Git

### Environment Setup

1. **Clone and navigate to backend directory**:
   ```bash
   cd IFRS_Backend
   ```

2. **Create Python virtual environment**:
   ```bash
   python3.11 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Create environment file**:
   Create a `.env` file in the `IFRS_Backend` directory:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://user:password@localhost:5432/autobooks_db
   
   # Redis Configuration
   REDIS_URL=redis://localhost:6379/0
   
   # Django Settings
   SECRET_KEY=your_django_secret_key_here
   DEBUG=False
   ALLOWED_HOSTS=localhost,127.0.0.1,your_domain.com
   
   # AI Configuration
   GOOGLE_API_KEY=your_google_genai_api_key
   
   # Media Storage (Cloudinary)
   CLOUDINARY_URL=cloudinary://key:secret@cloud
   
   # CORS Configuration
   CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your_frontend_domain
   
   # Authentication
   JWT_SIGNING_KEY=your_jwt_signing_key
   JWT_ALGORITHM=HS256
   ```

5. **Run database migrations**:
   ```bash
   python manage.py migrate
   ```

6. **Create superuser**:
   ```bash
   python manage.py createsuperuser
   ```

7. **Start development server**:
   ```bash
   python manage.py runserver
   ```

8. **Start Celery worker** (in separate terminal):
   ```bash
   celery -A autobooks worker -l info
   ```

### Docker Setup

For containerized deployment:

```bash
# Build Docker image
docker build -t autobooks-backend:latest .

# Run with docker-compose
docker-compose up

# Access the application
curl http://localhost:8000/api/health
```

## API Documentation

### Authentication

All API endpoints require JWT authentication:

```bash
# Login and get token
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com", "password":"secure_password"}'

# Response includes access_token and refresh_token
# Include token in subsequent requests:
curl -X GET http://localhost:8000/api/accounts \
  -H "Authorization: Bearer {access_token}"
```

### Transaction Posting

**Endpoint**: `POST /api/transactions`

```bash
curl -X POST http://localhost:8000/api/transactions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Equipment Purchase",
    "transaction_date": "2026-03-15",
    "document_reference": "INV-2026-0515",
    "entries": [
      {"account_code": "1510", "debit": 5000.00, "credit": 0.00},
      {"account_code": "1110", "debit": 0.00, "credit": 5000.00}
    ]
  }'
```

### Balance Sheet API

**Endpoint**: `GET /api/reports/balance-sheet?as_of_date=2026-03-15`

```json
{
  "as_of_date": "2026-03-15",
  "period": "Q1 2026",
  "assets": {
    "current_assets": {
      "cash": 50000.00,
      "receivables": 25000.00,
      "inventory": 15000.00,
      "total": 90000.00
    },
    "non_current_assets": {
      "property_plant_equipment": 100000.00,
      "accumulated_depreciation": -20000.00,
      "intangibles": 10000.00,
      "total": 90000.00
    },
    "total_assets": 180000.00
  },
  "liabilities": {
    "current_liabilities": {
      "payables": 20000.00,
      "short_term_debt": 10000.00,
      "total": 30000.00
    },
    "non_current_liabilities": {
      "long_term_debt": 40000.00,
      "total": 40000.00
    },
    "total_liabilities": 70000.00
  },
  "equity": {
    "share_capital": 80000.00,
    "retained_earnings": 30000.00,
    "total_equity": 110000.00
  },
  "validation": {
    "assets_equal_liab_plus_equity": true
  }
}
```

### Document Upload for Auto-Classification

**Endpoint**: `POST /api/documents/classify`

```bash
curl -X POST http://localhost:8000/api/documents/classify \
  -H "Authorization: Bearer {token}" \
  -F "document=@invoice.pdf"

# Response includes detected type, extracted fields, and posting data
```

## Transaction Posting Workflow

### Complete End-to-End Flow

```
1. User uploads invoice PDF via Frontend-UI
   ↓
2. PDF sent to /api/documents/classify
   ↓
3. Google Gemini AI analyzes document:
   - Detects type: "INVOICE"
   - Extracts: amount=$5,000, date=2026-03-15, vendor="ABC Corp"
   - Verifies entity matches: ✓
   ↓
4. Frontend displays extracted data for user confirmation
   ↓
5. User confirms and clicks "Post to Ledger"
   ↓
6. Frontend sends to POST /api/transactions:
   - Description: "Invoice from ABC Corp"
   - Entries: [1130 (DR) $5,000, 4110 (CR) $5,000]
   ↓
7. Backend validates:
   - Document authenticity: ✓
   - Business logic: ✓
   - IFRS rules: ✓
   - Double-entry invariant: $5,000 = $5,000 ✓
   ↓
8. Transaction posted to PostgreSQL
   ↓
9. Journal entry created with:
   - User ID, timestamp
   - Document reference
   - Immutable status: POSTED
   ↓
10. Response sent to Frontend with:
    - Posting confirmation
    - Updated ledger balance
    - Journal entry ID
```

## Monitoring and Operations

### Celery Task Monitoring

```bash
# Monitor Celery tasks in real-time
flower -A autobooks --port=5555

# Access at http://localhost:5555
```

### Database Monitoring

```bash
# Connect to PostgreSQL
psql postgresql://user:password@localhost:5432/autobooks_db

# Check journal entry counts
SELECT COUNT(*) FROM app_journalentry WHERE status = 'POSTED';

# Check balance of specific account
SELECT SUM(CASE WHEN debit_amount > 0 THEN debit_amount ELSE -credit_amount END)
FROM app_journalentry
WHERE account_code = '1110' AND status = 'POSTED';
```

### Health Check Endpoint

```bash
curl http://localhost:8000/api/health

# Response confirms database and cache connectivity
```

## Performance Characteristics

| Operation                    | Expected Time     | Notes                              |
|------------------------------|-------------------|-------------------------------------|
| Transaction Posting          | 50-200ms          | Includes validation and DB write  |
| Balance Sheet Generation     | 100-500ms         | Depends on number of accounts     |
| Document Classification      | 2-5 seconds       | Includes LLM API call             |
| Journal Entry Query          | 10-50ms           | Database index on transaction_id  |

## Security Considerations

### Data Protection
- All passwords hashed with Argon2
- Database connections encrypted via SSL/TLS
- Sensitive configuration in environment variables (not committed)
- User audit trail includes identity and timestamp

### API Security
- JWT tokens signed with rotating keys
- CSRF protection on all state-changing operations
- Rate limiting on authentication endpoints
- Input validation and sanitization on all endpoints

### Transaction Integrity
- Database transactions are ACID-compliant
- All ledger writes are atomic
- Concurrent posting requests are serialized
- Reversals maintain complete audit trail

## Testing

### Running Tests

```bash
# Run all tests
python manage.py test

# Run specific test class
python manage.py test app.tests.TransactionValidationTests

# Run with coverage
coverage run --source='.' manage.py test
coverage report
```

### Test Categories

- **Unit Tests**: Individual validation functions
- **Integration Tests**: Full transaction posting workflow
- **API Tests**: HTTP endpoint behavior
- **Database Tests**: Account balance calculations

## Version Information

- **IFRS_Backend Version**: 1.0.0
- **Django Version**: 5.2.7
- **Python Minimum**: 3.11
- **PostgreSQL Minimum**: 15
- **Last Updated**: March 2026

## Related Documentation

- [AutoBooks Finance Main README](../README.md)
- [Frontend-UI Documentation](../Frontend-UI/README.md)
- [Local_Tetherware Documentation](../Local_Tetherware/README.md)
- [Node_Web3_Server Documentation](../Node_Web3_Server/README.md)
