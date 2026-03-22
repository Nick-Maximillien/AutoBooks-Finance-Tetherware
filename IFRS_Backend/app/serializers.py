from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import BusinessProfile, FinancialPeriod, Document, Account, Transaction, JournalEntry, FixedAsset
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from decimal import Decimal
import json


# -------------- Auth Serializers --------------

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['email'] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['username'] = self.user.username
        data['email'] = self.user.email
        return data


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )


# ================== Model Serializers ==================
class FinancialPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialPeriod
        fields = ['id', 'start_date', 'end_date', 'is_closed', 'closed_at']


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ["id", "code", "name", "ifrs_account", "account_class", "business", "balance", "subgroup"]


class BusinessProfileSerializer(serializers.ModelSerializer):
    reporting_periods = FinancialPeriodSerializer(source="periods", many=True, read_only=True)
    accounts = AccountSerializer(many=True, read_only=True)
    class Meta:
        model = BusinessProfile
        fields = ['id', 'business_name', "created_at", "financial_year_start", "financial_year_end", "current_period_opened", "reporting_periods", "accounts", 'phone', 'image', 'address', 'email',]


class FixedAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = FixedAsset
        fields = [
            'id', 
            'name', 
            'asset_class', 
            'measurement_model',
            'purchase_cost', 
            'accumulated_depreciation', 
            'useful_life_years', 
            'residual_value', 
            'depreciation_method',
            'current_fair_value', 
            'accumulated_fair_value_adjustment', 
            'date_acquired', 
            'is_active'
        ]
        # Protect the math fields from being overwritten by a rogue API call
        read_only_fields = [
            'purchase_cost', 
            'accumulated_depreciation', 
            'accumulated_fair_value_adjustment'
        ]

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = "__all__"
        extra_kwargs = {
            "business": {"required": True},
            "business_name": {"required": False, "allow_null": True, "allow_blank":True},
            "document_type": {"required": False, "allow_null": True, "allow_blank":True},
            "invoice_number": {"required": False, "allow_null": True, "allow_blank":True},
            "vendor": {"required": False, "allow_null": True, "allow_blank":True},
            "date": {"required": False, "allow_null": True},
            "total": {"required": False},
            "tax": {"required": False},
            "customer": {"required": False, "allow_null": True, "allow_blank":True},
            "items": {"required": False},
            "receipt_number": {"required": False, "allow_null": True, "allow_blank":True},
            "payment_method": {"required": False, "allow_null": True, "allow_blank":True},
            "balance": {"required": False},
            "billed_to": {"required": False, "allow_null": True, "allow_blank":True},
            "quotation_number": {"required": False, "allow_null": True, "allow_blank":True},
            "credit_note_number": {"required": False, "allow_null": True, "allow_blank":True},
            "debit_note_number": {"required": False, "allow_null": True, "allow_blank":True},
            "issued_to": {"required": False, "allow_null": True, "allow_blank":True},
            "payroll_month": {"required": False, "allow_null": True, "allow_blank":True},
            "employee_salaries": {"required": False},
            "subtotal": {"required": False},
            "asset_value": {"required": False},
            "asset_description": {"required": False, "allow_null": True, "allow_blank":True},
            "equity_investor": {"required": False, "allow_null": True, "allow_blank":True},
            "equity_terms": {"required": False, "allow_null": True, "allow_blank":True},
            "loan_lender": {"required": False, "allow_null": True, "allow_blank":True},
            "loan_terms": {"required": False, "allow_null": True, "allow_blank":True},
            "interest_rate": {"required": False},
            "delivery_date": {"required": False, "allow_null": True, "allow_blank":True},
            "delivered_to": {"required": False, "allow_null": True, "allow_blank":True},
            "received_by": {"required": False, "allow_null": True, "allow_blank":True},
            "raw_text": {"required": False, "allow_null": True, "allow_blank":True},      
            "asset_class": {"required": False, "allow_null": True, "allow_blank":True},
            "expense_category": {"required": False, "allow_null": True, "allow_blank":True},
        }

class TransactionNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'date', 'created_at', 'description'] 


class JournalEntrySerializer(serializers.ModelSerializer):
    account = AccountSerializer(read_only=True)
    transaction = TransactionNestedSerializer(read_only=True) 
    
    account_id = serializers.PrimaryKeyRelatedField(
        queryset=Account.objects.all(), source="account", write_only=True
    )

    class Meta:
        model = JournalEntry
        fields = ["id", "transaction", "account", "account_id", "entry_type", "amount"]


class TransactionSerializer(serializers.ModelSerializer):
    entries = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    journal_entries = JournalEntrySerializer(source="entries", many=True, read_only=True)

    class Meta:
        model = Transaction
        fields = ["id", "document", "description", "date", "period", "entries", "journal_entries"]

    def create(self, validated_data):
        entries = validated_data.pop("entries", [])
        request = self.context.get("request", None)
        business = None
        if request and hasattr(request.user, "business_profile"):
            business = request.user.business_profile
        transaction = Transaction.objects.create(business=business, **validated_data)

        normalized = []
        for e in entries:
            amount = Decimal(str(e.get("amount", 0.00)))
            normalized.append({
                "ifrs_account": e.get("ifrs_account"),
                "amount": amount,
                "type": e.get("type")
            })
        if normalized:
            transaction.post_transaction(normalized) 
        return transaction       

class BalanceSheetSerializer(serializers.Serializer):
    grouped = serializers.DictField()
    totals = serializers.DictField()

    def to_representation(self, instance):
        grouped = instance.get("grouped", {})
        totals = instance.get("totals", {})
        warning = instance.get("warning")
        assets = instance.get("assets")
        liabilities = instance.get("liabilities")
        equity = instance.get("equity")
        period_data = instance.get("period_data")
        return {
            "grouped": grouped,
            "total": totals,
            "warning": warning,
            "assets": assets,
            "liabilities": liabilities,
            "equity": equity,
            "period_data": period_data
        }


class PnLAccountSerializer(serializers.Serializer):
    code = serializers.CharField()
    name = serializers.CharField()
    balance = serializers.DecimalField(max_digits=14, decimal_places=2)

class PnLSubgroupSerializer(serializers.Serializer):
    accounts = PnLAccountSerializer(many=True)
    subtotal = serializers.DecimalField(max_digits=14, decimal_places=2)

class PnLSerializer(serializers.Serializer):
    grouped = serializers.DictField(child=serializers.DictField(child=PnLSubgroupSerializer()))
    totals = serializers.DictField()
    net_profit = serializers.DecimalField(max_digits=14, decimal_places=2)


class CashFlowSerializer(serializers.Serializer):
    operating = serializers.DecimalField(max_digits=14, decimal_places=2)
    investing = serializers.DecimalField(max_digits=14, decimal_places=2)
    financing = serializers.DecimalField(max_digits=14, decimal_places=2)
    net_change = serializers.DecimalField(max_digits=14, decimal_places=2)


class ManualAdjustmentSerializer(serializers.Serializer):
    debit_account = serializers.CharField()
    credit_account = serializers.CharField()
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)

    def create(self, validated_data):
        request = self.context.get("request")
        business = request.user.business_profile

        debit_acc = business.accounts.filter(ifrs_account=validated_data["debit_account"]).first()
        credit_acc = business.accounts.filter(ifrs_account=validated_data["credit_account"]).first()
        if not debit_acc or not credit_acc:
            raise ValidationError("One or both accounts not found.")
        
        amount = validated_data["amount"]
        if amount <= 0:
            raise ValidationError("Amount must be positive.")
        
        txn = Transaction.objects.create(
            business=business,
            description=f"Manual Adjustment: {debit_acc.name} ↔ {credit_acc.name}",
            is_manual_adjustment=True,
        )
        txn.post_transaction([
            {"ifrs_account": debit_acc.ifrs_account, "type": "debit", "amount": amount},
            {"ifrs_account": credit_acc.ifrs_account, "type": "credit", "amount": amount}
        ])
        return txn