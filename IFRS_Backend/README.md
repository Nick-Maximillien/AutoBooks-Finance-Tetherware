# IFRS_Backend - Financial Ledger Engine

Django 5.2 REST API implementing IFRS-compliant double-entry accounting with AI document extraction, Web3 settlement, and multimodal finance agents.

## Overview

IFRS_Backend is the core financial ledger engine powering AutoBooks:
- **IFRS Compliance**: 60+ standardized chart of accounts with GL balance verification
- **Double-Entry Enforcement**: PostgreSQL constraints ensure debits = credits
- **AI Document Processing**: Vertex AI extracts invoices → automatic J/E posting
- **Real-Time Reporting**: Balance sheet, P&L, cash flow generation
- **Web3 Orchestration**: Transaction intent generation for multi-chain settlement
- **Conversational Agents**: Vertex AI chat + Twilio WhatsApp integration
- **Period Management**: Automatic depreciation, accruals, and closing rituals

## Technology Stack

**Framework & API**:
- Django 5.2.x - Web framework
- Django REST Framework 3.14 - REST API toolkit
- Celery 5.3 - Async task queue
- drf-spectacular - OpenAPI documentation

**Database & Cache**:
- PostgreSQL 15+ - Relational database
- psycopg2 - PostgreSQL adapter
- Redis 7+ - Caching and session store
- django-redis - Django cache backend

**External Services**:
- Google Vertex AI (genai 0.5.0+) - Document extraction, Chat agent
- Twilio SDK - WhatsApp messaging
- Web3.py 6.x - Blockchain interaction
- requests 2.31 - HTTP client

**Authentication & Security**:
- djangorestframework-simplejwt - JWT tokens
- django-cors-headers - CORS configuration
- cryptography - Encryption utilities

## Project Structure

```
IFRS_Backend/
├── autobooks/                  # Django project settings
│   ├── settings.py            # Configuration (DEBUG, DATABASES, etc.)
│   ├── urls.py                # Root URL routing
│   ├── wsgi.py                # WSGI application
│   ├── asgi.py                # ASGI for async
│   └── celery.py              # Celery configuration
├── app/                        # Main application
│   ├── models.py              # Database models
│   ├── views.py               # API views & business logic
│   ├── serializers.py         # DRF serializers
│   ├── urls.py                # App URL routing
│   ├── utils.py               # Utility functions
│   ├── web3_integration.py    # Web3 agent for blockchain
│   ├── schemas.py             # Pydantic schemas (validation)
│   ├── signals.py             # Django signals
│   ├── migrations/            # Database migrations
│   └── management/
│       └── commands/          # Custom manage.py commands
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Container image
├── celery_worker.Dockerfile   # Celery worker image
├── manage.py                  # Django CLI
└── entrypoint.sh              # Docker entrypoint

```

## Core Data Models

### Business Context
- **BusinessProfile**: Multi-tenant business entity with wallet, network preferences
- **FinancialPeriod**: Monthly/quarterly/annual reporting periods with closing dates
- **User**: Django user model (owner, accountant, accountant_viewer roles)
- **Shareholder**: Equity holders for dividend distribution

### Accounting
- **Account**: Chart of accounts (GL code, name, balance, IFRS classification)
- **Transaction**: Atomic record of economic event (date, description, status)
- **JournalEntry**: Individual debit/credit lines (account, amount, type)
- **Document**: Uploaded invoices/receipts with AI extraction metadata

### Assets & Adjustments
- **FixedAsset**: Configurable depreciation (purchase price, useful life, residual value)
- **TransactionStatus**: Enum (DRAFT, POSTED, PENDING_SIGNATURE, IRREVERSIBLE)

### Ledger Structure (60+ Accounts)
```
Assets (1000-1999)
  1110 - Cash and Cash Equivalents
  1200 - Accounts Receivable
  1300 - Inventory
  1400 - Prepaid Expenses
  1500 - Property, Plant & Equipment
  1600 - Accumulated Depreciation
  
Liabilities (2000-2999)
  2110 - Accounts Payable
  2200 - Short-Term Borrowings
  2300 - Interest Payable
  2400 - Income Tax Payable
  
Equity (3000-3999)
  3100 - Contributed Capital
  3200 - Retained Earnings
  3300 - Current Period Income
  
Income (4000-4999)
  4110 - Product Sales
  4120 - Service Revenue
  4200 - Other Income
  
Expense (5000-5999)
  5110 - Cost of Goods Sold
  5210 - Salaries & Wages
  5220 - Rent Expense
  5230 - Utilities
  5240 - Depreciation Expense
```

## API Endpoints

### Authentication (30+ endpoints total)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/signup` | Register new business |
| POST | `/api/auth/login` | JWT token issuance |
| POST | `/api/auth/refresh` | Refresh expired token |
| POST | `/api/auth/logout` | Token revocation |

### Business Profile
| POST | `/api/business/profile` | Create/update profile |
| GET | `/api/business/profile` | Get current profile |
| GET | `/api/business/accounts` | List chart of accounts |

### Documents
| POST | `/api/documents/upload` | Upload + AI extraction |
| GET | `/api/documents` | List documents |
| POST | `/api/documents/{id}/post` | Post to ledger |
| POST | `/api/documents/{id}/revoke` | Reverse transaction |

### Financial Statements
| GET | `/api/statements/balance-sheet` | Current BS |
| GET | `/api/statements/pnl` | P&L statement |
| GET | `/api/statements/cash-flow` | Cash flow |

### Transactions & Ledger
| GET | `/api/journal/entries` | All journal entries |
| GET | `/api/accounts/{code}` | Account balance |
| POST | `/api/transactions/post-manual` | Manual J/E |
| POST | `/api/transactions/close-period` | Period closing |

### Web3 & Payments
| POST | `/api/payments/settle-bill` | Queue vendor payment |
| POST | `/api/payroll/execute` | Execute payroll |
| POST | `/api/treasury/deploy-yield` | Yield farming |
| POST | `/api/liquidity/request` | Request USDT loan |
| POST | `/api/dividends/distribute` | Shareholder distribution |

### Chat Agents
| POST | `/api/live-agent/stream` | Voice + image (WhatsApp UI) |
| POST | `/api/whatsapp/webhook` | Twilio webhook |
| POST | `/api/web-chat` | Web chat messages |

## Key Business Logic

### Autonomous Document Ingestion

```
User uploads invoice
        ↓
Google Vertex AI extracts: vendor, amount, date, line items, tax
        ↓
DETERMINISTIC AUDIT GATE checks ownership
  └─ Normalize vendor name & business name
  └─ Find if business name appears ANYWHERE in document
  └─ If mismatch → flag for human review
        ↓
FINAL BOSS OVERRIDE logic:
  └─ If document not addressed to business Accounts, cannot be invoice (revenue)
  └─ Force to "bill" (inbound expense from external party) if mismatched
        ↓
Classify as: invoice, bill, asset_purchase, or equity_injection
        ↓
If human review required: Queue for UI review (type="unknown")
If high confidence: Auto-post to correct IFRS accounts
        ↓
Post transaction atomically:
  └─ Create Transaction record
  └─ Create JournalEntry debit/credit pair
  └─ Update Account balances
  └─ Link back to Document for audit trail
```

### Double-Entry Ledger Posting

```python
# Example: Invoice for $100 from customer ABC
post_transaction([
    {"account": "1200", "type": "debit", "amount": 100},    # A/R ↑
    {"account": "4110", "type": "credit", "amount": 100}    # Revenue ↑
])

# Validates:
# 1. Total debits == total credits
# 2. Accounts exist in chart of accounts
# 3. Debit/credit is valid for account class
# 4. Period is open (not locked)
# 5. Business context matches
```

### Financial Statement Generation

**Balance Sheet** (Assets = Liabilities + Equity):
```
Assets
  Cash                           $50,000
  A/R                            $80,000
  Fixed Assets (net)            $200,000
Total Assets                    $330,000

Liabilities
  A/P                            $50,000
  Short-term Debt               $30,000
  Taxes Payable                 $20,000
Total Liabilities               $100,000

Equity
  Retained Earnings            $150,000
  Current Period Income         $80,000
Total Equity                   $230,000

Total Liab + Equity            $330,000 ✓
```

**P&L Statement** (Income - Expenses = Net Profit):
```
Revenue
  Product Sales               $500,000
  Service Revenue             $150,000
Total Revenue                 $650,000

Expenses
  COGS                       ($300,000)
  Salaries                   ($150,000)
  Rent                        ($40,000)
  Utilities                   ($10,000)
  Depreciation                ($20,000)
Total Expenses              ($520,000)

Net Income                    $130,000
```

**Cash Flow** (Operating + Investing + Financing):
```
Operating Activities
  Net Income                  $130,000
  Depreciation (add back)      $20,000
  Change in A/R               ($30,000)
  Change in A/P                $10,000
Net Operating CF             $130,000

Investing Activities
  Fixed Asset Purchase       ($100,000)
Net Investing CF            ($100,000)

Financing Activities
  Debt Repayment              ($20,000)
  Dividend Payment             ($5,000)
Net Financing CF             ($25,000)

Net Cash Change              ($5,000)
Opening Cash                 $55,000
Ending Cash                  $50,000
```

### Period Closing Ritual

1. **Calculate Depreciation**: For all fixed assets
   - Depreciation Expense = (Cost - Residual) / Useful Life
   - Post: [Dr. 5240] [Cr. 1600]

2. **Record Accruals**: Interest, taxes, payroll
   - Post accrual entries

3. **Zero Out P&L**: Move all income/expense to Retained Earnings
   - Credit 4000-4999 accounts to 3200
   - Debit 5000-5999 accounts to 3200

4. **Lock Period**: Set is_closed=True (no more posting)

5. **Create New Period**: Start next reporting period

6. **Generate Audit Trail**: Immutable record of close process

### AI Document Extraction Pipeline

```
1. Receive file (PDF or image)
2. Convert to bytes if needed
3. Send to Vertex AI Flash model with schema
   └─ Extract: vendor, customer, amount, date, items, tax
   └─ Confidence score (0-1)
   └─ Narration (what was seen)
4. Validate extracted data:
   └─ Amount must be positive decimal
   └─ Date must be valid
   └─ Items array must be valid
   └─ Line items sum ≤ total (no overages)
5. Create Document record:
   └─ Store extracted JSON
   └─ Mark requires_human_review if low confidence
   └─ Generate audit reason if override applied
6. Return to UI for preview/confirmation
```

## Environment Variables

```bash
# Django Settings
DEBUG=False
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=localhost,127.0.0.1,api.autobooks.finance

# Database
DATABASE_URL=postgresql://user:password@postgres:5432/autobooks
POSTGRES_PASSWORD=secure_password

# Cache & Queue
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1

# Google Cloud (AI)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GCP_PROJECT_ID=autobooks-ai-project
GCP_LOCATION=us-central1

# Twilio (WhatsApp)
TWILIO_ACCOUNT_SID=ACxxx...
TWILIO_AUTH_TOKEN=xxx...
TWILIO_WHATSAPP_NUMBER=+1234567890

# External APIs
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
CLOUDINARY_URL=cloudinary://key:secret@cloud/

# Web3
INFURA_API_KEY=xxx
ALCHEMY_API_KEY=xxx
SUPPORTED_CHAINS=1,8453,42161,137,10,43114,42220
```

## Installation & Setup

### Prerequisites
- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Google Cloud account with Vertex AI API enabled
- Twilio account

### Local Development

```bash
# Clone and enter directory
git clone https://github.com/zico/AutoBooks-Finance-Tetherware
cd IFRS_Backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup local PostgreSQL
createdb autobooks

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Start development server
python manage.py runserver

# In another terminal, start Celery
celery -A autobooks worker -l info

# In a third terminal, start Flower (task monitoring)
celery -A autobooks flower
```

Navigate to:
- API: `http://localhost:8000/api/`
- Admin: `http://localhost:8000/admin/`
- Flower: `http://localhost:5555`

### Docker Deployment

```bash
docker-compose up -d

# Create superuser in container
docker exec autobooks-backend python manage.py createsuperuser

# Run migrations
docker exec autobooks-backend python manage.py migrate
```

## Testing

```bash
# Run all tests
python manage.py test

# Run specific test file
python manage.py test app.tests.test_ledger

# Run with coverage
coverage run --source='app' manage.py test
coverage report
coverage html  # Open htmlcov/index.html
```

## API Documentation

Interactive API docs available after starting server:
- Swagger UI: `http://localhost:8000/api/swagger/`
- ReDoc: `http://localhost:8000/api/redoc/`
- OpenAPI Schema: `http://localhost:8000/api/schema/`

## Key Flows

### User Registration Flow
```
POST /api/auth/signup with { username, email, password, business_name }
    ↓
Create User + BusinessProfile
    ↓
Generate JWT tokens
    ↓
Return { access, refresh, user_info }
```

### Document Upload → Ledger Posting
```
POST /api/documents/upload with file
    ↓
Extract with Vertex AI
    ↓
Create Document record (status=pending_review)
    ↓
If human review needed: Return for UI confirmation
If auto-posting: POST /api/documents/{id}/post
    ↓
Create Transaction + JournalEntry records
    ↓
Update Account balances
    ↓
Return audit trace with ledger impact
```

### Payment Settlement
```
POST /api/payments/settle-bill with { document_id, vendor_wallet, amount }
    ↓
Build Web3 transaction intent
    ↓
Return unsigned payload to frontend
    ↓
Frontend sends to Local_Tetherware for signing
    ↓
Signed transaction sent to Node_Web3_Server
    ↓
Broadcast to blockchain
    ↓
Record to ledger: Dr. A/P, Cr. Cash
```

## Monitoring & Debugging

### Logs
```bash
# Application logs
tail -f /var/log/autobooks/django.log

# Database queries
# Set DEBUG=True and check console during dev

# Celery tasks
# Monitor at http://localhost:5555 (Flower)
```

### Django Admin
Access at `http://localhost:8000/admin/` with superuser:
- View all transactions
- Manage users and permissions  
- Debug database state
- Monitor background jobs

### Common Issues

| Issue | Fix |
|-------|-----|
| "No such column" error | Run `python manage.py migrate` |
| 401 Unauthorized | Verify JWT token in Authorization header |
| "CORS error" | Check ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS |
| "Connection refused" to Redis | Ensure Redis is running on port 6379 |
| "Google API error" | Verify GOOGLE_APPLICATION_CREDENTIALS path |

## Performance Optimization

- Database indexes on transaction queries
- Celery async for long-running tasks (PDF processing, period closing)
- Redis caching for balance sheet calculations
- Query optimization with select_related/prefetch_related
- Pagination for large result sets

## Security Best Practices

- All passwords hashed with PBKDF2
- JWT tokens with 24-hour expiration
- HTTPS enforced in production
- SQL injection prevention via ORM
- CSRF tokens for state-changing operations
- Rate limiting on auth endpoints

## Deployment

### AWS ElasticBeanstalk
```bash
eb create autobooks-env
eb deploy
eb logs
```

### Google Cloud Run
```bash
gcloud run deploy autobooks-backend --source . \
  --set-env-vars DATABASE_URL=$DB_URL,REDIS_URL=$REDIS_URL
```

### Heroku
```bash
git push heroku main
heroku run python manage.py migrate
```

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Follow PEP 8 style guide
3. Add tests for new features
4. Run tests: `python manage.py test`
5. Submit PR to main branch

## License

Copyright 2026 AutoBooks Finance

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
