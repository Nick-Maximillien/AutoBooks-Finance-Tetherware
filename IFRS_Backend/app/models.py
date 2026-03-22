import logging
from django.db import models, transaction as db_transaction
from django.contrib.auth.models import User
from django.utils.timezone import now
from django.core.exceptions import ValidationError
from decimal import Decimal
from datetime import date

logger = logging.getLogger(__name__)

# ==================== Helper Functions ====================
def get_financial_year_start():
    """Callable for DateField default - returns Jan 1 of current year"""
    today = date.today()
    return date(today.year, 1, 1)

def get_financial_year_end():
    """Callable for DateField default - returns Dec 31 of current year"""
    today = date.today()
    return date(today.year, 12, 31)

# -------------------------------------------------------------
# IFRS for SMEs Rules Engine (Based on 2025 Third Edition)
# -------------------------------------------------------------

class IFRSAccountRules:
    """Computable Accounting Law for IFRS for SMEs (Third Edition 2025)"""
    
    @staticmethod
    def calculate_depreciation_amortisation(cost, accumulated_dep, residual_value, useful_life_years, method="straight_line"):
        """
        Pure computational rule for subsequent measurement of sub-ledger assets.
        Preserves rounding discipline until final ledger posting.
        """
        if useful_life_years is None or useful_life_years <= Decimal("0.00"):
            return Decimal("0.00")
            
        if method == "straight_line":
            depreciable_amount = Decimal(str(cost)) - Decimal(str(residual_value))
            if depreciable_amount <= Decimal("0.00"):
                return Decimal("0.00")
            return depreciable_amount / Decimal(str(useful_life_years))
            
        elif method == "reducing_balance":
            net_book_value = Decimal(str(cost)) - Decimal(str(accumulated_dep))
            if net_book_value <= Decimal(str(residual_value)):
                return Decimal("0.00")
            rate = Decimal("1.5") / Decimal(str(useful_life_years))
            return net_book_value * rate
            
        return Decimal("0.00")

    @staticmethod
    def calculate_impairment(balance, estimated_selling_price, costs_to_sell):
        """
        Section 13 (Inventories) / Section 27 (Impairment)
        Calculates Net Realisable Value (NRV). Returns impairment loss amount.
        """
        if estimated_selling_price is None or costs_to_sell is None:
            return Decimal("0.00")
            
        nrv = Decimal(str(estimated_selling_price)) - Decimal(str(costs_to_sell))
        if nrv < balance:
            return balance - nrv
        return Decimal("0.00")

    @staticmethod
    def calculate_fair_value_adjustment(carrying_amount, new_fair_value):
        """
        Section 16 (Investment Property) & Section 34 (Agriculture)
        Calculates the delta. Returns positive for Appreciation, negative for Devaluation.
        """
        if new_fair_value is None:
            return Decimal("0.00")
        return Decimal(str(new_fair_value)) - Decimal(str(carrying_amount))

    @staticmethod
    def validate_balance(account):
        """
        Validate account balances comply with IFRS SFP Equation.
        Contra-assets natively carry negative balances (credit balance on an asset class).
        """
        contra_accounts = [
            "accumulated_depreciation_ppe", 
            "accumulated_depreciation_inv_prop", 
            "accumulated_amortisation_intangibles"
        ]
        
        if account.account_class in ["ASSET", "EXPENSE"] and account.balance < Decimal("0.00"):
            if account.ifrs_account not in contra_accounts:
                # Hook for future CFO Auditor Warning System for unnatural negative balances
                logger.warning(f"Unnatural negative balance detected on {account.ifrs_account}: {account.balance}")
        return True

class IFRSTransactionRules:
    """Apply IFRS rules at transaction level"""
    @staticmethod
    def validate_transaction(entries):
        """Validate structural integrity of the ledger"""
        total_debit = sum(Decimal(str(e["amount"])) for e in entries if e["type"] == "debit")
        total_credit = sum(Decimal(str(e["amount"])) for e in entries if e["type"] == "credit")

        # Due to floating point math, ensure rounding to 2 decimal places matches
        if round(total_debit, 2) != round(total_credit, 2):
            raise ValueError(f"Deterministic Rule Failed: Debits ({total_debit}) must equal credits ({total_credit})")

        for e in entries:
            if Decimal(str(e["amount"])) < Decimal("0.00"):
                raise ValueError("Transaction amount cannot be negative. IFRS requires a reverse entry (Credit/Debit flip) instead.") 
        return True        

# -----------------------------------------
# IFRS for SMEs standard chart of accounts
# Derived strictly from Sections 4.2 and 5.5
# ------------------------------------------
ACCOUNT_CLASSES = [
        ("ASSET", "Asset"),
        ("LIABILITY", "Liability"),
        ("EQUITY", "Equity"),
        ("INCOME", "Income"),
        ("EXPENSE", "Expense"),
    ]

IFRS_ACCOUNTS = [
        # ASSETS (Section 4.2 & 23 & Contra-Assets)
        ("cash_and_cash_equivalents", "Cash and Cash Equivalents"),
        ("trade_and_other_receivables", "Trade and Other Receivables"),
        ("contract_assets", "Contract Assets"), 
        ("financial_assets", "Financial Assets"),
        ("inventories", "Inventories"), 
        ("property_plant_equipment", "Property, Plant and Equipment"), 
        ("accumulated_depreciation_ppe", "Accumulated Depreciation - PPE"), # Contra
        ("investment_property_cost", "Investment Property (Cost)"), 
        ("accumulated_depreciation_inv_prop", "Accumulated Depreciation - Investment Property"), # Contra
        ("investment_property_fv", "Investment Property (Fair Value)"), 
        ("intangible_assets", "Intangible Assets"), 
        ("accumulated_amortisation_intangibles", "Accumulated Amortisation - Intangibles"), # Contra
        ("biological_assets_cost", "Biological Assets (Cost)"), 
        ("biological_assets_fv", "Biological Assets (Fair Value)"), 
        ("investments_in_associates", "Investments in Associates"), 
        ("investments_in_jointly_controlled_entities", "Investments in Jointly Controlled Entities"), 
        ("current_tax_assets", "Current Tax Assets"),
        ("deferred_tax_assets", "Deferred Tax Assets"),
        ("prepayments", "Prepayments"),
        ("other_current_assets", "Other Current Assets"),
        ("other_non_current_assets", "Other Non-Current Assets"), 
        # LIABILITIES (Section 4.2 & 20 & 23)
        ("trade_and_other_payables", "Trade and Other Payables"),
        ("contract_liabilities", "Contract Liabilities"), 
        ("financial_liabilities", "Financial Liabilities"),
        ("current_tax_liabilities", "Current Tax Liabilities"),
        ("deferred_tax_liabilities", "Deferred Tax Liabilities"),
        ("provisions", "Provisions"), 
        ("short_term_borrowings", "Short-Term Borrowings"),
        ("long_term_borrowings", "Long-Term Borrowings"),
        ("lease_liabilities", "Lease Liabilities"), 
        ("other_current_liabilities", "Other Current Liabilities"),
        ("other_non_current_liabilities", "Other Non-Current Liabilities"),
        # EQUITY (Section 4.2)
        ("share_capital", "Share Capital"),
        ("retained_earnings", "Retained Earnings"),
        ("reserves", "Reserves"),
        ("non_controlling_interest", "Non-Controlling Interest"), 
        ("other_equity_components", "Other Equity Components"),
        # INCOME (Section 5.5)
        ("revenue", "Revenue"), 
        ("gains", "Gains"),
        ("share_of_profit_associates_jv", "Share of Profit of Associates and JVs"), 
        ("other_income", "Other Income"),
        # EXPENSES (Section 5.5)
        ("cost_of_sales", "Cost of Sales"),
        ("operating_expenses", "Operating Expenses"),
        ("depreciation_and_amortisation", "Depreciation and Amortisation"),
        ("finance_costs", "Finance Costs"),
        ("employee_benefits_expense", "Employee Benefits Expense"), 
        ("tax_expense", "Tax Expense"),
        ("impairment_loss", "Impairment Loss"), 
        ("expenses", "Expenses"),
    ]

class TransactionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft (AI Proposed)"
    PENDING_REVIEW = "PENDING", "Anomaly - Pending Human Review"
    PENDING_SIGNATURE = "PENDING_SIGNATURE", "Awaiting Local OpenClaw Signature" 
    POSTED = "POSTED", "Auto-Posted (Cleared IFRS Rules)"
    REJECTED = "REJECTED", "Rejected by Deterministic Accounting Gate"

class BusinessProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="business_profile")
    business_name = models.CharField(max_length=255)
    address = models.TextField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    image = models.ImageField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    financial_year_start = models.DateField(default=get_financial_year_start)
    financial_year_end = models.DateField(default=get_financial_year_end)
    current_period_opened = models.BooleanField(default=True)
    employee_wallets = models.JSONField(null=True, blank=True, default=list, help_text="List of employee wallet dicts for payroll: [{\"wallet\": \"0x...\", \"name\": \"John\", \"salary_per_period\": 5000}, ...]")
    # Web3 Onboarding Fields
    wallet_address = models.CharField(max_length=255, null=True, blank=True)
    public_key = models.TextField(null=True, blank=True)
    primary_network = models.CharField(max_length=50, default="celo-sepolia", help_text="The default EVM chain for this business")

    def __str__(self):
        return self.business_name or f"{self.user.username}'s Business"
    
    def get_current_period(self):
        # Gracefully grab the first one if multiples accidentally exist
        period = FinancialPeriod.objects.filter(
            business=self,
            start_date=self.financial_year_start,
            end_date=self.financial_year_end,
            is_closed=False,
        ).first()
        
        # If none exist, create it safely
        if not period:
            period = FinancialPeriod.objects.create(
                business=self,
                start_date=self.financial_year_start,
                end_date=self.financial_year_end,
                is_closed=False,
            )
        
        return period
    
    def start_new_period(self):
        current_period = self.get_current_period()
        current_period.close_period()
        
        # Leap-year safe roll-forward
        try:
            self.financial_year_start = self.financial_year_start.replace(year=self.financial_year_start.year + 1)
        except ValueError:
            self.financial_year_start = self.financial_year_start.replace(year=self.financial_year_start.year + 1, day=28)
            
        try:
            self.financial_year_end = self.financial_year_end.replace(year=self.financial_year_end.year + 1)
        except ValueError:
            self.financial_year_end = self.financial_year_end.replace(year=self.financial_year_end.year + 1, day=28)
            
        self.save()
    
    def get_cap_table(self):
        """Calculates real-time equity percentages based on total investments."""
        shareholders = self.shareholders.all()
        total_capital = sum([s.total_investment for s in shareholders])
        
        if total_capital <= 0:
            return []
            
        cap_table = []
        for s in shareholders:
            pct = s.total_investment / total_capital
            cap_table.append({
                "name": s.name,
                "wallet": s.wallet_address,
                "equity_percentage": float(pct),
                "total_investment": float(s.total_investment)
            })
        return cap_table

    def initialize_ifrs_accounts(self):
        class_map = {
            "ASSET": [
                "cash_and_cash_equivalents", "trade_and_other_receivables", "contract_assets", "financial_assets", 
                "inventories", "property_plant_equipment", "accumulated_depreciation_ppe", "investment_property_cost", 
                "accumulated_depreciation_inv_prop", "investment_property_fv", "intangible_assets", 
                "accumulated_amortisation_intangibles", "biological_assets_cost", "biological_assets_fv", 
                "investments_in_associates", "investments_in_jointly_controlled_entities", "current_tax_assets", 
                "deferred_tax_assets", "prepayments", "other_current_assets", "other_non_current_assets"
            ],
            "LIABILITY": [
                "trade_and_other_payables", "contract_liabilities", "financial_liabilities", "current_tax_liabilities", 
                "deferred_tax_liabilities", "provisions", "short_term_borrowings", "long_term_borrowings", "lease_liabilities",
                "other_current_liabilities", "other_non_current_liabilities"
            ],
            "EQUITY": [
                "share_capital", "retained_earnings", "reserves", "non_controlling_interest", "other_equity_components"
            ],
            "INCOME": ["revenue", "gains", "share_of_profit_associates_jv", "other_income"],
            "EXPENSE": ["cost_of_sales", "operating_expenses", "depreciation_and_amortisation", "finance_costs", "employee_benefits_expense", "tax_expense", "impairment_loss", "expenses"]
        }

        for code, name in IFRS_ACCOUNTS:
            if not self.accounts.filter(ifrs_account=code).exists():
                account_class = None 
                for cls, codes in class_map.items():
                    if code in codes:
                        account_class = cls
                        break
                
                # Strict fallback enforcement
                if not account_class:
                    logger.error(f"IFRS Account Configuration Error: '{code}' missing from class mapping. Defaulting to EXPENSE.")
                    account_class = "EXPENSE"
                
                self.accounts.create(
                    code=code,
                    name=name,
                    account_class=account_class,
                    ifrs_account=code,
                    balance=Decimal("0.00")
                )

    def get_balance_sheet(self):
        sections = {
            "Current Assets": ["cash_and_cash_equivalents", "trade_and_other_receivables", "contract_assets", "inventories", "current_tax_assets", "prepayments", "other_current_assets"],
            "Non-Current Assets": [
                "property_plant_equipment", "accumulated_depreciation_ppe", 
                "investment_property_cost", "accumulated_depreciation_inv_prop", "investment_property_fv", 
                "intangible_assets", "accumulated_amortisation_intangibles", 
                "biological_assets_cost", "biological_assets_fv", "investments_in_associates", 
                "investments_in_jointly_controlled_entities", "financial_assets", "deferred_tax_assets", "other_non_current_assets"
            ],
            "Current Liabilities": ["trade_and_other_payables", "contract_liabilities", "short_term_borrowings", "current_tax_liabilities", "provisions", "other_current_liabilities"],
            "Non-Current Liabilities": ["long_term_borrowings", "lease_liabilities", "financial_liabilities", "deferred_tax_liabilities", "other_non_current_liabilities"],
            "Equity": ["share_capital", "retained_earnings", "reserves", "non_controlling_interest", "other_equity_components"],
        }

        grouped = {"ASSET": {}, "LIABILITY": {}, "EQUITY": {}}
        totals = {"ASSET": Decimal("0.00"), "LIABILITY": Decimal("0.00"), "EQUITY": Decimal("0.00")}

        for section, ifrs_codes in sections.items():
            accounts_qs = self.accounts.filter(ifrs_account__in=ifrs_codes)
            accounts_list = [{"code": a.code, "name": a.name, "balance": a.balance} for a in accounts_qs]
            # Contra-assets natively carry negative balances here, implicitly calculating Net Book Value.
            subtotal = sum((a.balance for a in accounts_qs), Decimal("0.00"))

            if "Assets" in section:
                grouped["ASSET"][section] = {"accounts": accounts_list, "subtotal": subtotal}
                totals["ASSET"] += subtotal
            elif "Liabilities" in section:
                grouped["LIABILITY"][section] = {"accounts": accounts_list, "subtotal": subtotal}
                totals["LIABILITY"] += subtotal
            elif "Equity" in section:
                grouped["EQUITY"][section] = {"accounts": accounts_list, "subtotal": subtotal}
                totals["EQUITY"] += subtotal

        # --- CORE ACCOUNTING FIX: Inject Current Year Profit into Equity ---
        pnl = self.get_pnl()
        current_profit = pnl["net_profit"]
        
        grouped["EQUITY"]["Equity"]["accounts"].append({
            "code": "current_profit", 
            "name": "Current Period Earnings", 
            "balance": current_profit
        })
        grouped["EQUITY"]["Equity"]["subtotal"] += current_profit
        totals["EQUITY"] += current_profit
        # -------------------------------------------------------------------
        
        warning = None
        if totals["ASSET"] != (totals["LIABILITY"] + totals["EQUITY"]):
            warning = f"Assets ({totals['ASSET']}) != Liabilities + Equity ({totals['LIABILITY'] + totals['EQUITY']})"

        current_period = self.get_current_period()
        return {
            "grouped": grouped, "totals": totals, "warning": warning, 
            "assets": totals["ASSET"], "liabilities": totals["LIABILITY"], "equity": totals["EQUITY"], 
            "period_data": {"start_date": current_period.start_date, "end_date": current_period.end_date}
        }

    def get_pnl(self):
        grouped = {"INCOME": {}, "EXPENSE": {}}
        totals = {"INCOME": Decimal("0.00"), "EXPENSE": Decimal("0.00")}
        for acc in self.accounts.all():
            if acc.account_class in grouped:
                sg = acc.subgroup or "Other"
                grouped[acc.account_class].setdefault(sg, {"accounts": [], "subtotal": Decimal("0.00")})
                grouped[acc.account_class][sg]["accounts"].append({"code": acc.code, "name": acc.name, "balance": acc.balance})
                grouped[acc.account_class][sg]["subtotal"] += acc.balance
                totals[acc.account_class] += acc.balance
        return {"grouped": grouped, "totals": totals, "net_profit": totals["INCOME"] - totals["EXPENSE"]}
    
    def get_cash_flow(self, period=None):
        if not period:
            period = self.get_current_period()

        operating = investing = financing = Decimal("0.00")
        txns = Transaction.objects.filter(period=period, status=TransactionStatus.POSTED).prefetch_related('entries__account')
        
        for txn in txns:
            entries = list(txn.entries.all())
            cash_entries = [e for e in entries if e.account.ifrs_account == "cash_and_cash_equivalents"]
            
            if not cash_entries:
                continue
                
            net_cash_change = sum(e.amount if e.entry_type == 'debit' else -e.amount for e in cash_entries)
            if net_cash_change == 0:
                continue
                
            non_cash_accounts = [e.account.ifrs_account for e in entries if e.account.ifrs_account != "cash_and_cash_equivalents"]
            
            is_investing = any(acc in ["property_plant_equipment", "intangible_assets", "investment_property_cost", "biological_assets_cost", "financial_assets", "investments_in_associates"] for acc in non_cash_accounts)
            is_financing = any(acc in ["share_capital", "long_term_borrowings", "short_term_borrowings", "lease_liabilities", "other_equity_components"] for acc in non_cash_accounts)
            
            if is_investing:
                investing += net_cash_change
            elif is_financing:
                financing += net_cash_change
            else:
                operating += net_cash_change
                
        return {"operating": operating, "investing": investing, "financing": financing, "net_change": operating + investing + financing}

class Shareholder(models.Model):
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name="shareholders")
    name = models.CharField(max_length=255)
    wallet_address = models.CharField(max_length=255, null=True, blank=True, help_text="Web3 wallet for dividend airdrops")
    total_investment = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    
    class Meta:
        unique_together = ("business", "name")

    def __str__(self):
        return f"{self.name} - KSH {self.total_investment}"

class FixedAsset(models.Model):
    """Sub-Ledger tracking asset-granular parameters for compliant depreciation & appreciation"""
    ASSET_CLASSES = [
        ("property_plant_equipment", "Property, Plant and Equipment"),
        ("intangible_assets", "Intangible Assets"),
        ("investment_property_cost", "Investment Property (Cost)"),
        ("investment_property_fv", "Investment Property (Fair Value)"), # Added for Appreciation
        ("biological_assets_fv", "Biological Assets (Fair Value)")      # Added for Appreciation
    ]
    MEASUREMENT_MODELS = [
        ("cost", "Cost Model (Depreciates)"),
        ("fair_value", "Fair Value Model (Appreciates/Devaluates)")
    ]
    
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name="fixed_assets")
    name = models.CharField(max_length=255)
    asset_class = models.CharField(max_length=50, choices=ASSET_CLASSES)
    measurement_model = models.CharField(max_length=20, choices=MEASUREMENT_MODELS, default="cost")
    
    purchase_cost = models.DecimalField(max_digits=14, decimal_places=2)
    
    # COST MODEL FIELDS
    accumulated_depreciation = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    useful_life_years = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("10.00"))
    residual_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    depreciation_method = models.CharField(max_length=50, choices=[("straight_line", "Straight Line"), ("reducing_balance", "Reducing Balance")], default="straight_line")
    
    # FAIR VALUE MODEL FIELDS
    current_fair_value = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    accumulated_fair_value_adjustment = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    
    date_acquired = models.DateField(default=date.today)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.get_measurement_model_display()})"

class FinancialPeriod(models.Model):
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name="periods")
    start_date = models.DateField()
    end_date = models.DateField()
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.business.business_name}: {self.start_date} → {self.end_date} ({'Closed' if self.is_closed else 'Open'})"

    def close_period(self):
        """
        Strict Double-Entry Close. 
        Calculates Cost Depreciation OR Fair Value Appreciation,
        then zeros out P&L into Retained Earnings.
        """
        if self.is_closed: return
        
        with db_transaction.atomic():
            # 1. Post Adjusting Entries (Depreciation & Appreciation)
            adj_txn = Transaction.objects.create(
                business=self.business, period=self, status=TransactionStatus.POSTED,
                description=f"Period End Adjustments: Depreciation & Fair Value Adjustments for {self.end_date}"
            )
            adj_entries = []
            
            for asset in self.business.fixed_assets.filter(is_active=True):
                
                # === A. FAIR VALUE MODEL (Appreciation/Devaluation) ===
                if asset.measurement_model == "fair_value":
                    if asset.current_fair_value is not None:
                        carrying_amount = asset.purchase_cost + asset.accumulated_fair_value_adjustment
                        adjustment = IFRSAccountRules.calculate_fair_value_adjustment(carrying_amount, asset.current_fair_value)
                        
                        if adjustment > Decimal("0.00"):
                            # Appreciation: Debit Asset, Credit Gains (Income)
                            adj_entries.extend([
                                {"ifrs_account": asset.asset_class, "amount": adjustment, "type": "debit"},
                                {"ifrs_account": "gains", "amount": adjustment, "type": "credit"} 
                            ])
                        elif adjustment < Decimal("0.00"):
                            # Devaluation/Impairment: Debit Impairment Loss (Expense), Credit Asset
                            deval = abs(adjustment)
                            adj_entries.extend([
                                {"ifrs_account": "impairment_loss", "amount": deval, "type": "debit"},
                                {"ifrs_account": asset.asset_class, "amount": deval, "type": "credit"} 
                            ])
                            
                        # Save the new accumulated adjustment
                        asset.accumulated_fair_value_adjustment += adjustment
                        asset.save()

                # === B. COST MODEL (Depreciation) ===
                else:
                    dep_amount = IFRSAccountRules.calculate_depreciation_amortisation(
                        cost=asset.purchase_cost,
                        accumulated_dep=asset.accumulated_depreciation,
                        residual_value=asset.residual_value,
                        useful_life_years=asset.useful_life_years,
                        method=asset.depreciation_method
                    )
                    
                    # Enforce Book Value Ceiling
                    max_depreciable = asset.purchase_cost - asset.residual_value - asset.accumulated_depreciation
                    if dep_amount > max_depreciable:
                        dep_amount = max_depreciable
                        
                    if dep_amount > Decimal("0.00"):
                        asset.accumulated_depreciation += dep_amount
                        asset.save()
                        
                        contra_account = "accumulated_depreciation_ppe"
                        if asset.asset_class == "intangible_assets":
                            contra_account = "accumulated_amortisation_intangibles"
                        elif asset.asset_class == "investment_property_cost":
                            contra_account = "accumulated_depreciation_inv_prop"

                        adj_entries.extend([
                            {"ifrs_account": "depreciation_and_amortisation", "amount": dep_amount, "type": "debit"},
                            {"ifrs_account": contra_account, "amount": dep_amount, "type": "credit"} 
                        ])
            
            if adj_entries:
                adj_txn.post_transaction(adj_entries)
            else:
                adj_txn.delete() 

            # 2. Post Closing Entries (Zeroing out Income/Expense into Retained Earnings)
            closing_txn = Transaction.objects.create(
                business=self.business, period=self, status=TransactionStatus.POSTED,
                description=f"Closing Entries: P&L to Retained Earnings for {self.end_date}"
            )
            closing_entries = []
            
            for account in self.business.accounts.all():
                if account.account_class not in ["INCOME", "EXPENSE"]:
                    continue

                if account.balance == Decimal("0.00"):
                    continue

                amount = abs(account.balance)

                if account.account_class == "INCOME":
                    if account.balance > 0:
                        closing_entries.extend([
                            {"ifrs_account": account.ifrs_account, "amount": amount, "type": "debit"},
                            {"ifrs_account": "retained_earnings", "amount": amount, "type": "credit"},
                        ])
                    else:
                        closing_entries.extend([
                            {"ifrs_account": account.ifrs_account, "amount": amount, "type": "credit"},
                            {"ifrs_account": "retained_earnings", "amount": amount, "type": "debit"},
                        ])

                elif account.account_class == "EXPENSE":
                    if account.balance > 0:
                        closing_entries.extend([
                            {"ifrs_account": "retained_earnings", "amount": amount, "type": "debit"},
                            {"ifrs_account": account.ifrs_account, "amount": amount, "type": "credit"},
                        ])
                    else:
                        closing_entries.extend([
                            {"ifrs_account": "retained_earnings", "amount": amount, "type": "credit"},
                            {"ifrs_account": account.ifrs_account, "amount": amount, "type": "debit"},
                        ])
                        
            if closing_entries:
                closing_txn.post_transaction(closing_entries)
            else:
                closing_txn.delete()

            self.is_closed = True
            self.closed_at = now()
            self.save()                              

class Account(models.Model):
    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name="accounts")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    subgroup = models.CharField(max_length=50, blank=True, null=True)
    account_class = models.CharField(max_length=20, choices=ACCOUNT_CLASSES)
    ifrs_account = models.CharField(max_length=100, choices=IFRS_ACCOUNTS)
    balance = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("business", "code")

    def __str__(self):
        return f"{self.code} - {self.name} ({self.ifrs_account})"    

class Transaction(models.Model):
    business = models.ForeignKey("BusinessProfile", on_delete=models.CASCADE, related_name="transactions")
    document = models.ForeignKey("Document", on_delete=models.CASCADE, related_name="transactions", null=True, blank=True)
    period = models.ForeignKey(FinancialPeriod, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions")
    date = models.DateField(default=date.today)
    description = models.TextField()
    is_manual_adjustment = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=TransactionStatus.choices, default=TransactionStatus.DRAFT)
    blockchain_tx_hash = models.CharField(max_length=255, null=True, blank=True, help_text="Celo blockchain transaction hash for Web3 operations")
    created_at = models.DateTimeField(auto_now_add=True)

    def post_transaction(self, entries, transaction_date=None):
        # Use provided date or default to today
        if transaction_date:
            self.date = transaction_date
        elif not self.date:
            self.date = date.today()
        
        IFRSTransactionRules.validate_transaction(entries)

        if not self.period:
            # Bind the transaction to the strictly correct historical period
            covering_period = FinancialPeriod.objects.filter(
                business=self.business,
                start_date__lte=self.date,
                end_date__gte=self.date
            ).first()
            
            if covering_period:
                self.period = covering_period
            else:
                self.period = self.business.get_current_period()
            self.save()

        try:
            with db_transaction.atomic():
                for entry in entries:
                    account = Account.objects.filter(
                        business=self.business,
                        ifrs_account=entry["ifrs_account"]
                    ).first()
                    
                    if not account:
                        self.business.initialize_ifrs_accounts()
                        account = Account.objects.filter(
                            business=self.business,
                            ifrs_account=entry["ifrs_account"]
                        ).first()
                        if not account:
                            raise ValidationError(f"Account {entry['ifrs_account']} not found for this business.")
                    
                    amount = Decimal(str(entry["amount"]))
                    entry_type = entry["type"]

                    # Update Balances 
                    # Note: For contra-assets (Asset class), credits will correctly reduce balance into negatives
                    if account.account_class in ["ASSET", "EXPENSE"]:
                        account.balance += amount if entry_type == "debit" else -amount
                    elif account.account_class in ["LIABILITY", "EQUITY", "INCOME"]:
                        account.balance += amount if entry_type == "credit" else -amount
                    
                    IFRSAccountRules.validate_balance(account)
                    account.save()
                    
                    JournalEntry.objects.create(
                        transaction=self,
                        account=account,
                        entry_type=entry_type,
                        amount=amount
                    )
                self.status = TransactionStatus.POSTED
                self.save()
        except Exception as e:
            self.status = TransactionStatus.REJECTED
            self.description += f" | AI AUDIT REJECTED: {str(e)}"
            self.save()
            raise

    def __str__(self):
        return f"{self.date} - {self.description}"                

class JournalEntry(models.Model):
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, related_name="entries")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="journal_entries")
    entry_type = models.CharField(max_length=10, choices=[("debit", "Debit"), ("credit", "Credit")])
    amount = models.DecimalField(max_digits=14, decimal_places=2)

    def __str__(self):
        return f"{self.entry_type.title()} {self.amount} -> {self.account}"

class Document(models.Model):
    DOCUMENT_TYPES = [
        ("invoice", "Invoice (Point-in-time)"), ("customer_contract", "Customer Contract (Over-time)"),
        ("revenue_recognition", "Revenue Recognition (Unearned Drain)"),
        ("purchase_order", "Purchase Order"),
        ("credit_note", "Credit Note"), ("debit_note", "Debit Note"), 
        ("receipt", "Receipt"), ("payment_voucher", "Payment Voucher"),
        ("expense_claim", "Expense Claim"), ("bank_statement", "Bank Statement"), 
        ("bill", "Bill"), ("asset_purchase", "Asset Purchase"),
        ("journal_entry", "Journal Entry Upload"), ("short_term_borrowing", "Loan Borrowing(short-term)"),
        ("long_term_borrowing", "Loan Borrowing(long-term)"), ("tax_filing", "Tax Filing"),
        ("quotation", "Quotation"), ("delivery_note", "Delivery Note"),
        ("payroll", "Payroll Journal"), ("equity_injection", "Equity Injection"),
        ("lease_agreement", "Lease Agreement"), 
        ("unknown", "Unknown"),
    ]

    business = models.ForeignKey(BusinessProfile, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES, default="unknown")
    ai_detected_type = models.CharField(max_length=50, null=True, blank=True, help_text="Original AI-detected document type before human review gate")
    transaction = models.ForeignKey(Transaction, on_delete=models.SET_NULL, null=True, blank=True, related_name="documents")
    
    # Common fields
    business_name = models.CharField(max_length=255, null=True, blank=True)
    vendor = models.CharField(max_length=255, null=True, blank=True)
    date = models.DateField(null=True, blank=True)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), null=True, blank=True)
    raw_text = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    items = models.JSONField(blank=True, null=True, default=list)
    
    # Asset and Expense Classification
    asset_class = models.CharField(
        max_length=50, 
        choices=[("property_plant_equipment", "Property, Plant and Equipment"), 
                 ("intangible_assets", "Intangible Assets"), 
                 ("investment_property_cost", "Investment Property (Cost)")], 
        null=True, 
        blank=True
    )
    expense_category = models.CharField(
        max_length=100, 
        choices=[("operating_expenses", "Operating Expenses"),
                 ("cost_of_sales", "Cost of Sales"),
                 ("employee_benefits_expense", "Employee Benefits"),
                 ("finance_costs", "Finance Costs"),
                 ("depreciation_and_amortisation", "Depreciation and Amortisation")],
        default="operating_expenses",
        null=True,
        blank=True
    )

    # Specific Fields
    invoice_number = models.CharField(max_length=100, null=True, blank=True)
    credit_note_number = models.CharField(max_length=100, null=True, blank=True)
    debit_note_number = models.CharField(max_length=100, null=True, blank=True)
    customer = models.CharField(max_length=255, null=True, blank=True)
    tax = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), null=True, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), null=True, blank=True)
    receipt_number = models.CharField(max_length=100, null=True, blank=True)
    payment_from = models.CharField(max_length=255, null=True, blank=True)
    payment_method = models.CharField(max_length=100, null=True, blank=True)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), null=True, blank=True) # Fixed Type Mismatch
    invoice_reference = models.CharField(max_length=100, null=True, blank=True)
    bank_account = models.CharField(max_length=100, null=True, blank=True)
    bank_statement = models.CharField(max_length=100, null=True, blank=True)
    bank_statement_lines = models.JSONField(blank=True, null=True, default=list)
    bill_number = models.CharField(max_length=100, null=True, blank=True)
    po_number = models.CharField(max_length=100, null=True, blank=True)
    billed_to = models.CharField(max_length=255, null=True, blank=True)
    approved_by = models.CharField(max_length=100, null=True, blank=True)
    expected_delivery_date = models.CharField(max_length=100, null=True, blank=True)
    expense_items = models.JSONField(blank=True, null=True, default=list)
    quotation_number = models.CharField(max_length=100, null=True, blank=True)
    issued_to = models.CharField(max_length=255, null=True, blank=True)
    payroll_month = models.CharField(max_length=50, null=True, blank=True)
    employee_salaries = models.JSONField(blank=True, null=True, default=list)
    delivery_note_number = models.CharField(max_length=100, null=True, blank=True)
    delivery_date = models.CharField(max_length=100, null=True, blank=True)
    delivered_to = models.CharField(max_length=255, null=True, blank=True)
    received_by = models.CharField(max_length=255, null=True, blank=True)
    asset_description = models.CharField(max_length=255, null=True, blank=True)
    asset_value = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"), null=True, blank=True)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"), null=True, blank=True)
    equity_investor = models.CharField(max_length=255, null=True, blank=True)
    equity_terms = models.CharField(max_length=255, null=True, blank=True)
    loan_terms = models.CharField(max_length=255, null=True, blank=True)
    loan_lender = models.CharField(max_length=255, null=True, blank=True)
    blockchain_tx_hash = models.CharField(max_length=255, null=True, blank=True, help_text="Web3 blockchain transaction hash for autonomous Web3 operations (settle_bill, payroll, yield)")
    unsigned_payload = models.JSONField(null=True, blank=True, help_text="Raw intent data queued for OpenClaw to sign locally")
    vendor_wallet = models.CharField(max_length=255, null=True, blank=True, help_text="Web3 wallet address extracted for the vendor")

    def __str__(self):
        return f"{self.document_type} - {self.total}"
    
    def save(self, *args, **kwargs):
        is_new = self._state.adding
        self.business.initialize_ifrs_accounts()
        
        # Enforce normalization BEFORE persisting to DB
        if self.document_type:
            self.document_type = self.document_type.strip().lower()
            valid_types = [dt[0] for dt in self.DOCUMENT_TYPES]
            if self.document_type not in valid_types:
                self.document_type = "unknown"

        super().save(*args, **kwargs)

        # Auto-post documents that are NOT flagged for review
        # Only "unknown" documents await human classification
        if is_new and self.document_type != "unknown":
            self.post_transaction()

    def post_transaction(self):
        with db_transaction.atomic():
            # Use Document date if available, otherwise use today
            txn_date = self.date if self.date else date.today()
            
            txn = Transaction.objects.create(
                business=self.business,
                document=self,
                date=txn_date,
                status=TransactionStatus.DRAFT, 
                description=f"Auto-posted transaction for {self.document_type} #{self.pk}"
            )

            amount = self.total or Decimal("0.00")
            entries = []

            if self.document_type == "invoice": 
                entries = [
                    {"ifrs_account": "trade_and_other_receivables", "amount": amount, "type": "debit" },
                    {"ifrs_account": "revenue", "amount": amount, "type": "credit" }, 
                ]
            elif self.document_type == "customer_contract": 
                entries = [
                    {"ifrs_account": "trade_and_other_receivables", "amount": amount, "type": "debit" },
                    {"ifrs_account": "contract_liabilities", "amount": amount, "type": "credit" }, 
                ]
            elif self.document_type == "revenue_recognition": 
                entries = [
                    {"ifrs_account": "contract_liabilities", "amount": amount, "type": "debit" },
                    {"ifrs_account": "revenue", "amount": amount, "type": "credit" }, 
                ]
            elif self.document_type == "receipt":
                entries = [
                    {"ifrs_account": "cash_and_cash_equivalents", "amount": amount, "type": "debit" },
                    {"ifrs_account": "trade_and_other_receivables", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "bill":
                # Use document's expense_category if specified, otherwise default to operating_expenses
                expense_account = self.expense_category or "operating_expenses"
                entries = [
                    {"ifrs_account": expense_account, "amount": amount, "type": "debit" },
                    {"ifrs_account": "trade_and_other_payables", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "payroll":
                entries = [
                    {"ifrs_account": "employee_benefits_expense", "amount": amount, "type": "debit" },
                    {"ifrs_account": "cash_and_cash_equivalents", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "credit_note":
                entries = [
                    {"ifrs_account": "revenue", "amount": amount, "type": "debit" },
                    {"ifrs_account": "trade_and_other_receivables", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "debit_note":
                # Fixed: Issued to supplier (e.g., purchase return/overcharge adjustment)
                entries = [
                    {"ifrs_account": "trade_and_other_payables", "amount": amount, "type": "debit" },
                    {"ifrs_account": "operating_expenses", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "payment_voucher":
                entries = [
                    {"ifrs_account": "trade_and_other_payables", "amount": amount, "type": "debit" },
                    {"ifrs_account": "cash_and_cash_equivalents", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "short_term_borrowing":
                entries = [
                    {"ifrs_account": "cash_and_cash_equivalents", "amount": amount, "type": "debit" },
                    {"ifrs_account": "short_term_borrowings", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "long_term_borrowing":
                entries = [
                    {"ifrs_account": "cash_and_cash_equivalents", "amount": amount, "type": "debit" },
                    {"ifrs_account": "long_term_borrowings", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "tax_filing":
                entries = [
                    {"ifrs_account": "current_tax_liabilities", "amount": amount, "type": "debit" },
                    {"ifrs_account": "cash_and_cash_equivalents", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "asset_purchase":
                # Use document's asset_class if specified, otherwise default to property_plant_equipment
                asset_account = self.asset_class or "property_plant_equipment"
                entries = [
                    {"ifrs_account": asset_account, "amount": amount, "type": "debit" }, 
                    {"ifrs_account": "cash_and_cash_equivalents", "amount": amount, "type": "credit" },
                ]
                
                FixedAsset.objects.create(
                    business=self.business,
                    name=self.asset_description or f"Asset from Document #{self.pk}",
                    asset_class=asset_account,
                    purchase_cost=amount,
                    useful_life_years=Decimal("10.00"), 
                    residual_value=Decimal("0.00")
                )
                
            elif self.document_type == "equity_injection":
                entries = [
                    {"ifrs_account": "cash_and_cash_equivalents", "amount": amount, "type": "debit" },
                    {"ifrs_account": "share_capital", "amount": amount, "type": "credit" },
                ]
                
                investor_name = self.equity_investor or "Anonymous Investor"
                shareholder, created = Shareholder.objects.get_or_create(
                    business=self.business,
                    name=investor_name
                )
                shareholder.total_investment += amount
                shareholder.save()

            elif self.document_type == "lease_agreement":
                entries = [
                    {"ifrs_account": "property_plant_equipment", "amount": amount, "type": "debit" }, 
                    {"ifrs_account": "lease_liabilities", "amount": amount, "type": "credit" },
                ]
            elif self.document_type == "purchase_order":
                # Purchase orders create a contract asset (pending fulfillment)
                entries = [
                    {"ifrs_account": "contract_assets", "amount": amount, "type": "debit" },
                    {"ifrs_account": "trade_and_other_payables", "amount": amount, "type": "credit" },
                ]

            if entries:
                txn.post_transaction(entries, transaction_date=txn_date)
            else:
                # No entries generated for this document type - delete the empty transaction
                txn.delete()
                logger.warning(f"No journal entries generated for {self.document_type} document #{self.pk}")