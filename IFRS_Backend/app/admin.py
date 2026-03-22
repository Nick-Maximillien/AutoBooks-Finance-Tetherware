from django.contrib import admin
from .models import BusinessProfile, FinancialPeriod, Document, Account, Transaction, JournalEntry



@admin.register(BusinessProfile)
class BusinessProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'business_name', 'phone', 'address')
    search_fields = ('user__username', 'business_name', 'phone')
    list_filter = ('user__is_active',)

@admin.register(FinancialPeriod)
class FinancialPeriodAdmin(admin.ModelAdmin):
    list_display = ('id', 'business', 'start_date', 'end_date', 'is_closed', 'closed_at')
    list_filter = ('is_closed',)    

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = (
        "business_user",
        "document_type",
        "business_name",
        "vendor",
        "invoice_number",
        "quotation_number",
        "total",
        "date",
        "created_at",
    )
    list_filter = ("document_type", "date", "created_at")
    search_fields = (
        "business",
        "business_name",
        "vendor",
        "invoice_number",
        "quotation_number",
    )
    ordering = ("-created_at",)

    fieldsets = (
        ("Document Classification", {
            "fields": ("document_type", "raw_text")
        }),
        ("Business Link", {
            "fields": ("business",),
        }),
        ("Business Info", {
            "fields": ("business_name", "vendor")
        }),
        ("Invoice / Billing", {
            "fields": ("invoice_number", "total", "date")
        }),
        ("Quotations", {
            "fields": ("quotation_number",)
        }),
        ("Payroll", {
            "fields": ("payroll_month",)
        }),
        ("Delivery Notes", {
            "fields": ("delivery_date",)
        }),
        ("Timestamps", {
            "fields": ("created_at",),
            "classes": ("collapse",),
        }),
    )

    readonly_fields = ("created_at",)
   
    # Custom method to show linked user name/email
    def business_user(self, obj):
        if obj.business and obj.business.user:
            return f"{obj.business.user.username} ({obj.business.user.email})"
        return "-"
    business_user.short_description = "Linked User"

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ( "id", "name", "business", "code", "balance", "ifrs_account", "business_user")
    list_filter = ("ifrs_account", "business")
    search_fields = ("name", "code", "business__business_name")

    # Custom method to show linked user name/email
    def business_user(self, obj):
        if obj.business and obj.business.user:
            return f"{obj.business.user.username} ({obj.business.user.email})"
        return "-"
    business_user.short_description = "Linked User"

class JournalEntryInline(admin.TabularInline):
    model = JournalEntry
    extra = 0
    readonly_fields = ("entry_type", "amount")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("id", "business_user", "description", "date", "period")
    inlines = [JournalEntryInline]
    list_filter = ("business",)
    search_fields = ("description", "business__business_name")
    date_hierarchy = "date"
    ordering = ("-date",)

    # Custom method to show linked user name/email
    def business_user(self, obj):
        if obj.business and obj.business.user:
            return f"{obj.business.user.username} ({obj.business.user.email})"
        return "-"
    business_user.short_description = "Linked User"


@admin.register(JournalEntry)
class JournalEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "transaction", "account", "entry_type", "amount")
    list_filter = ("entry_type", "account__ifrs_account")
    search_fields = ("account__name", "transaction__description")                


