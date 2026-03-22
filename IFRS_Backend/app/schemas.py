from pydantic import BaseModel, Field, model_validator
from typing import List, Optional
from datetime import date as datetime_date
from decimal import Decimal
from enum import Enum

# ---------------------------------
# 1:1 Mapped Enums from models.py
# ---------------------------------
class DocumentType(str, Enum):
    INVOICE = "invoice"
    CUSTOMER_CONTRACT = "customer_contract"
    REVENUE_RECOGNITION = "revenue_recognition"
    PURCHASE_ORDER = "purchase_order"
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"
    RECEIPT = "receipt"
    PAYMENT_VOUCHER = "payment_voucher"
    EXPENSE_CLAIM = "expense_claim"
    BANK_STATEMENT = "bank_statement"
    BILL = "bill"
    ASSET_PURCHASE = "asset_purchase"
    JOURNAL_ENTRY = "journal_entry"
    SHORT_TERM_BORROWING = "short_term_borrowing"
    LONG_TERM_BORROWING = "long_term_borrowing"
    TAX_FILING = "tax_filing"
    QUOTATION = "quotation"
    DELIVERY_NOTE = "delivery_note"
    PAYROLL = "payroll"
    EQUITY_INJECTION = "equity_injection"
    LEASE_AGREEMENT = "lease_agreement"
    UNKNOWN = "unknown"

class AssetClass(str, Enum):
    PROPERTY_PLANT_EQUIPMENT = "property_plant_equipment"
    INTANGIBLE_ASSETS = "intangible_assets"
    INVESTMENT_PROPERTY_COST = "investment_property_cost"
    # --- Fair Value Classes ---
    INVESTMENT_PROPERTY_FV = "investment_property_fv"
    BIOLOGICAL_ASSETS_FV = "biological_assets_fv"

class ExpenseCategory(str, Enum):
    OPERATING_EXPENSES = "operating_expenses"
    COST_OF_SALES = "cost_of_sales"
    EMPLOYEE_BENEFITS_EXPENSE = "employee_benefits_expense"
    FINANCE_COSTS = "finance_costs"
    DEPRECIATION_AND_AMORTISATION = "depreciation_and_amortisation"

# ------------
# Sub-Schemas for JSONFields
# -------------
class LineItem(BaseModel):
    description: str = Field(..., description="Description of the item, service, or payroll line.")
    quantity: Decimal = Field(Decimal("1.0"), description="Quantity of the item. Defaults to 1 if not stated.")
    unit_price: Optional[Decimal] = Field(None, description="Price per unit.")
    amount: Decimal = Field(..., description="Total amount for this specific line item.")

class EmployeeSalaryLine(BaseModel):
    employee_name: str = Field(..., description="Name of the employee.")
    gross_pay: Decimal = Field(Decimal("0.00"), description="Gross salary before deductions.")
    tax_deducted: Decimal = Field(Decimal("0.00"), description="Taxes or benefits deducted.")
    net_pay: Decimal = Field(..., description="Final amount paid to employee.")

class BankStatementLine(BaseModel):
    date: datetime_date = Field(..., description="Date of the bank transaction.")
    description: str = Field(..., description="Bank transaction description.")
    withdrawal: Decimal = Field(Decimal("0.00"), description="Money out.")
    deposit: Decimal = Field(Decimal("0.00"), description="Money in.")
    balance: Decimal = Field(Decimal("0.00"), description="Running balance.")

# ----------------------
# The Master 1:1 Schema
# ----------------------
class AgenticPayload(BaseModel):
    """The structured intent extracted by Gemini via ADK. Mapped 1:1 to the Django Document Model."""
    
    # 1. Routing & Core Financial Data
    document_type: DocumentType = Field(..., description="Classify the visual document into an exact IFRS type.")
    date: Optional[datetime_date] = Field(None, description="Transaction or document date. Format: YYYY-MM-DD.")
    total: Decimal = Field(..., description="Total transaction amount. Must not be negative.")
    subtotal: Optional[Decimal] = Field(Decimal("0.00"), description="Extracted subtotal amount before tax.")
    tax: Optional[Decimal] = Field(Decimal("0.00"), description="Extracted tax amount.")
    balance: Optional[Decimal] = Field(Decimal("0.00"), description="Remaining balance due, if stated on the document.")
    
    # 2. Counterparties
    vendor: Optional[str] = Field(None, description="Name of the vendor or supplier.")
    customer: Optional[str] = Field(None, description="Name of the customer or client.")
    billed_to: Optional[str] = Field(None, description="Name of the entity being billed (e.g., Ithoka Microsystems).")
    payment_from: Optional[str] = Field(None, description="Entity the payment is originating from.")
    
    # 3. Dynamic Accounting Categorization
    asset_class: Optional[AssetClass] = Field(
        None, 
        description="If document_type is asset_purchase, select the exact IFRS class. Use BIOLOGICAL_ASSETS_FV for living animals/plants, and INVESTMENT_PROPERTY_FV for real estate held for capital appreciation."
    )
    expense_category: Optional[ExpenseCategory] = Field(None, description="If document_type is bill or expense_claim, classify the expense type.")
    
    # 4. Granular Document Numbers
    invoice_number: Optional[str] = None
    receipt_number: Optional[str] = None
    po_number: Optional[str] = None
    bill_number: Optional[str] = None
    credit_note_number: Optional[str] = None
    debit_note_number: Optional[str] = None
    quotation_number: Optional[str] = None
    delivery_note_number: Optional[str] = None
    invoice_reference: Optional[str] = Field(None, description="Linked invoice reference for payments/receipts.")
    
    # 5. Domain-Specific Details
    asset_description: Optional[str] = Field(None, description="Description of the asset purchased.")
    asset_value: Optional[Decimal] = Field(Decimal("0.00"), description="Value of the asset.")
    interest_rate: Optional[Decimal] = Field(Decimal("0.00"), description="Interest rate if the document is a loan/borrowing. MUST be a pure number. DO NOT include the '%' symbol (e.g., return 10.00 instead of 10%).")
    loan_terms: Optional[str] = Field(None, description="Terms of the loan.")
    loan_lender: Optional[str] = Field(None, description="Name of the lender.")
    equity_investor: Optional[str] = Field(None, description="Name of the equity investor.")
    equity_terms: Optional[str] = Field(None, description="Terms of the equity injection.")
    payroll_month: Optional[str] = Field(None, description="Month of the payroll run (e.g., 'March 2026').")
    
    # 6. Embedded Arrays (JSONFields in Django)
    items: List[LineItem] = Field(default_factory=list, description="Extracted line items from the invoice, bill, or receipt.")
    employee_salaries: List[EmployeeSalaryLine] = Field(default_factory=list, description="Extracted payroll lines.")
    bank_statement_lines: List[BankStatementLine] = Field(default_factory=list, description="Extracted bank transactions.")
    
    # 7. THE CLIMAX TRIGGERS (Agentic Self-Awareness)
    agent_narration: str = Field(
        ...,
        description="A brief 1-2 sentence first-person inner monologue of what the AI CFO is looking at and deducing."
    )
    confidence_score: float = Field(
        ..., 
        description="Score from 0.0 to 1.0 based on visual clarity and accounting certainty."
    )
    requires_human_review: bool = Field(
        ..., 
        description="Set to TRUE if confidence < 0.85, amount > $10,000, or visual data is ambiguous."
    )
    human_review_reason: Optional[str] = Field(
        None, 
        description="If requires_human_review is True, explain exactly what the human needs to look at."
    )

    # -------------------------------------------------------------------------
    # Pydantic Validators: Enforcing IFRS structural completeness before Django
    # -------------------------------------------------------------------------
    @model_validator(mode='after')
    def validate_document_logic(self) -> 'AgenticPayload':
        
        # 1. Enforce Asset Classification
        if self.document_type == DocumentType.ASSET_PURCHASE and not self.asset_class:
            self.requires_human_review = True
            self.human_review_reason = "Asset class missing. Human CFO must classify this asset purchase (e.g., PPE vs Intangible)."
            
        # 2. Default Expense Routing
        if self.document_type in [DocumentType.BILL, DocumentType.EXPENSE_CLAIM] and not self.expense_category:
            # Default to Operating Expenses safely, but log it implicitly for the model
            self.expense_category = ExpenseCategory.OPERATING_EXPENSES

        # 3. Validation math (Subtotals + Tax = Total)
        if self.subtotal and self.tax and self.total:
            calculated_total = self.subtotal + self.tax
            # Allowing a tiny float margin of error for OCR rounding, but flagging if major discrepancy
            if abs(calculated_total - self.total) > Decimal("0.10"):
                self.requires_human_review = True
                self.human_review_reason = f"Math Error Detected: Subtotal ({self.subtotal}) + Tax ({self.tax}) does not equal Total ({self.total})."

        return self