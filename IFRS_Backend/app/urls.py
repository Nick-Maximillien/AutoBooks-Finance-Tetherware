from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from .views import (
    BusinessProfileView, DocumentListCreateAPIView, SignupView, 
    CreateProfileView, MyProfileView, BalanceSheetAPIView, CashFlowView, 
    PnLView, ManualAdjustmentAPIView, LiveAgentStreamView, FinancialPeriodListView, JournalEntryListView, CloseFinancialPeriodView,
    create_superuser_view, health_check, RevokeDocumentView, WhatsAppWebhookView, WebChatView, ExportYearEndFinancialsView, Web3ReconciliationView,
    ActivateWeb3View, EmployeeManagementView, ShareholderManagementView, TaxMonitoringView, BusinessWalletManagementView, Web3ChallengeView, Web3LoginView
)
from rest_framework_simplejwt.views import TokenRefreshView, TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer

#  Custom JWT view to return username + email
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('create-superuser/', create_superuser_view),
    path("health", health_check),

        #Token endpoints
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

        # Profiles
    path('create-profile/', CreateProfileView.as_view(), name='create-profile'),
    path('business/', MyProfileView.as_view(), name='business'),
    path('business/profile/', BusinessProfileView.as_view(), name='business-profile'),
        # Agentic Live Stream Endpoint
    path('live-agent-stream/', LiveAgentStreamView.as_view(), name='live-agent-stream'),
        # Financial Periods
    path('financial-periods/', FinancialPeriodListView.as_view(), name='financial-periods'),
    path('financial-period/close/', CloseFinancialPeriodView.as_view(), name='close-financial-period'),
        # Journal Entries  
    path('journal-entries/', JournalEntryListView.as_view(), name='journal-entries'),
    path("api/documents/<int:pk>/revoke/", RevokeDocumentView.as_view(), name="document-revoke"),
        # Export financials
    path('export-financials/', ExportYearEndFinancialsView.as_view(), name='export-financials'),
        # Documents endpoint
    path("api/documents/", DocumentListCreateAPIView.as_view(), name="document-list-create"),

        # Accounting endpoints
    path('balance-sheet/', BalanceSheetAPIView.as_view(), name="balance-sheet"),
    path('pnl/', PnLView.as_view(), name="pnl"),
    path('cashflow/', CashFlowView.as_view(), name="cashflow"),
    path('manual-adjustment/', ManualAdjustmentAPIView.as_view(), name="manual-adjustment"),

        # Wallet Management Endpoints
    path('web3/activate/', ActivateWeb3View.as_view(), name='activate-web3'),
    path('management/wallet/', BusinessWalletManagementView.as_view(), name='wallet-management'),
    # Web3 SIWE Endpoints
    path('web3/challenge/', Web3ChallengeView.as_view(), name='web3-challenge'),
    path('web3/login/', Web3LoginView.as_view(), name='web3-login'),
    path('web3/reconcile/', Web3ReconciliationView.as_view(), name='web3-login'),

        # WhatsApp Agent Endpoint
    path('whatsapp-webhook/', WhatsAppWebhookView.as_view(), name='whatsapp-webhook'),
        # Admin endpoints
    path('management/employee/', EmployeeManagementView.as_view(), name='employee-management'),
    path('management/shareholder/', ShareholderManagementView.as_view(), name='shareholder-management'),
    path('management/tax-monitoring/', TaxMonitoringView.as_view(), name='tax-monitoring'),
        # Web Chat Endpoint
    path('api/chat/', WebChatView.as_view(), name='web-chat'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
