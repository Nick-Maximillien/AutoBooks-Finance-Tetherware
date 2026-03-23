import os
import re
import json
import base64
import hashlib
import logging
from io import BytesIO
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from datetime import date
import requests
import pandas as pd
from twilio.rest import Client
import secrets
from eth_account import Account as EthAccount
from eth_account.messages import encode_defunct
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.cache import cache
from django.db import models, transaction as db_transaction
from django.db.models import Sum
from django.shortcuts import get_list_or_404
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser

# Google SDKs & AI Layer
from google import genai
from google.genai import types
from google.cloud import texttospeech
from pydantic import ValidationError

from .models import BusinessProfile, FinancialPeriod, Document, Account, Transaction, JournalEntry, TransactionStatus, IFRS_ACCOUNTS, FixedAsset, Shareholder
from app.schemas import AgenticPayload, LineItem, EmployeeSalaryLine, BankStatementLine, ExpenseCategory, AssetClass
from .serializers import (
    BusinessProfileSerializer, DocumentSerializer, FinancialPeriodSerializer, 
    SignupSerializer, CustomTokenObtainPairSerializer, AccountSerializer, 
    TransactionSerializer, JournalEntrySerializer, BalanceSheetSerializer, 
    PnLSerializer, CashFlowSerializer, ManualAdjustmentSerializer, FixedAssetSerializer
)
from .utils import get_or_create_business
from .web3_integration import Web3Agent, Web3Automation, Web3Error
from django.conf import settings

logger = logging.getLogger(__name__)


# Configuration settings and external service credentials
# Twillio credentials should be set in your environment variables for security. The WhatsApp number is typically the Twilio Sandbox number unless you have a dedicated one.
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
TWILIO_WHATSAPP_NUMBER = os.environ.get("TWILIO_WHATSAPP_NUMBER")  # Twilio Sandbox number
# Vertex AI uses the Service Account JSON. Explicit project/location variables are optional 
# but good practice. If GCP_PROJECT_ID is None, the SDK auto-discovers it from the JSON.
# Setup GCP Credentials and initialize Vertex AI and Text-to-Speech clients
# We import vertexai lazily inside the functions to prevent Server Boot Timeouts
# We import vertexai lazily inside the functions to prevent Server Boot Timeouts
# and Gunicorn Worker Deadlocks (gRPC fork safety).

if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = os.environ["GOOGLE_APPLICATION_CREDENTIALS"].replace("\\", "/")

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_LOCATION = os.environ.get("GCP_LOCATION", "us-central1")

_VERTEX_INITIALIZED = False
_VERTEX_CLIENT = None

def _get_vertex_client():
    """
    Lazy loader for Vertex AI connections.
    Returns the initialized genai.Client() safely.
    """
    global _VERTEX_INITIALIZED, _VERTEX_CLIENT
    
    if _VERTEX_INITIALIZED and _VERTEX_CLIENT:
        return _VERTEX_CLIENT
    
    try:
        logger.info(f"Connecting to Vertex AI (Project: {GCP_PROJECT_ID})...")
        
        # In Cloud Run, it automatically uses the container's service account.
        # No JSON file required!
        _VERTEX_CLIENT = genai.Client(vertexai=True, project=GCP_PROJECT_ID, location=GCP_LOCATION)
        
        _VERTEX_INITIALIZED = True
        logger.info("Vertex AI Renderer Online.")
        return _VERTEX_CLIENT
    except Exception as e:
        logger.error(f"Vertex AI Lazy Init failed: {e}")
        return None

# Real-time FX Rates
def get_realtime_usdt_kes_rate():
    """Fetches the live USDT to KES exchange rate directly from CoinGecko."""
    try:
        resp = requests.get("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=kes", timeout=5)
        if resp.status_code == 200:
            rate = resp.json().get("tether", {}).get("kes")
            if rate:
                logger.info(f"Live USDT/KES Market Rate Fetched: 1 USDT = {rate} KES")
                return Decimal(str(rate)).quantize(Decimal("0.01"))
    except Exception as e:
        logger.warning(f"Crypto API Failed: {e}. Using fallback rate 130.00.")
    return Decimal("130.00")


# Robust Agentic Ingestor with Safety Layer
# Surgically maps Pydantic Payload to Django Document Model with strict validation
def ingest_agentic_payload(business, payload: AgenticPayload):
    """
    Surgically maps Pydantic Payload to Django Document Model.
    Ensures JSONFields are strictly validated and Decimals are rounded.
    """
    
    # Deterministic Audit Gate: Normalized Ownership Check
    # Verifies that documents belong to the correct business entity
    def normalize_name(name):
        """Helper to strip punctuation, extra spaces, and common business suffixes."""
        if not name: return ""
        name = name.lower()
        # Remove common suffixes that cause false mismatches
        name = re.sub(r'\b(ltd|llc|inc|limited|corporation|co|enterprise)\b', '', name)
        # Remove punctuation and ALL spaces for a super-strict, foolproof match
        name = re.sub(r'[^\w]', '', name) 
        return name

    # 1. Define the valid owners of this ledger
    valid_owners = []
    if business.business_name:
        valid_owners.append(normalize_name(business.business_name))
    if business.user and business.user.username:
        valid_owners.append(normalize_name(business.user.username))
    
    valid_owners = [owner for owner in valid_owners if owner] # Clean empty strings

    # 2. Pool all extracted data to create the "Document Universe"
    # We check every possible place the AI might have written the business name
    doc_universe = " ".join(filter(None, [
        payload.vendor,
        payload.customer,
        payload.billed_to,
        payload.loan_lender,
        payload.equity_investor,
        payload.agent_narration,
        payload.human_review_reason,
        payload.asset_description
    ]))
    
    normalized_doc_universe = normalize_name(doc_universe)

    # 3. Verify Ownership
    # If the business name or username exists ANYWHERE in the extracted document, it belongs to us.
    ownership_verified = False
    for owner in valid_owners:
        if owner in normalized_doc_universe:
            ownership_verified = True
            break

    # Halt if we are trying to post someone else's document
    if not ownership_verified and valid_owners:
        payload.requires_human_review = True
        primary_owner = business.business_name or business.user.username
        payload.human_review_reason = f"Ownership Mismatch detected: This document does not appear to belong to '{primary_owner}'."

    # Capture original AI detection before any overrides
    original_ai_detection = payload.document_type.value
    
    # Determine if entity mismatch override logic should trigger when AI detected an invoice
    final_boss_will_trigger = (
        payload.requires_human_review and 
        "Ownership Mismatch" in payload.human_review_reason and 
        original_ai_detection == "invoice"
    )
    
    # Entity Mismatch Override Logic
    # Accountant's Rule: If a document is not addressed to our business,
    # it cannot be an invoice (revenue) we issued. It can only be an 
    # inbound bill (expense) from an external party.
    if final_boss_will_trigger:
        logger.warning(
            f"Document classification override: Document classified as '{payload.document_type.value}' "
            f"but entity mismatch detected. Reclassifying as 'bill' (inbound expense). "
            f"Original AI detection was: {original_ai_detection}"
        )
        # Override document_type to bill using proper Enum syntax
        payload.document_type = payload.document_type.__class__("bill")

    # 1. Strict rounding utility for financial ledger consistency
    def fmt(val): 
        if val is None: return Decimal("0.00")
        return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # 2. JSONField Hardening: USE the imported sub-schemas to validate AI arrays
    try:
        # Re-verify each item in the list against its specific sub-schema before dumping to DB
        clean_items = [LineItem(**i.model_dump()).model_dump(mode='json') for i in payload.items] if payload.items else []
        clean_salaries = [EmployeeSalaryLine(**s.model_dump()).model_dump(mode='json') for s in payload.employee_salaries] if payload.employee_salaries else []
        clean_banks = [BankStatementLine(**b.model_dump()).model_dump(mode='json') for b in payload.bank_statement_lines] if payload.bank_statement_lines else []
    except Exception as e:
        logger.error(f"Agentic Ingestion - Nested JSON validation failed: {e}")
        # Fallback to direct dump if validation logic hits a snag
        clean_items = [i.model_dump(mode='json') for i in payload.items]
        clean_salaries = [s.model_dump(mode='json') for s in payload.employee_salaries]
        clean_banks = [b.model_dump(mode='json') for b in payload.bank_statement_lines]

    # 3. Handle Status for Human-in-the-Loop
    doc_type = payload.document_type.value if isinstance(payload.document_type.value, str) else payload.document_type.value
    ai_detected = original_ai_detection  # PRESERVE original AI detection BEFORE any Final Boss override
    
    # If human review required BUT Final Boss override was applied, keep the override (not "unknown")
    # Otherwise, mark as unknown for human review
    if payload.requires_human_review and not final_boss_will_trigger:
        doc_type = "unknown"  # Only set to unknown if no deterministic override 

    # 4. Atomic Database Commital
    with db_transaction.atomic():
        document = Document.objects.create(
            business=business,
            document_type=doc_type,
            ai_detected_type=ai_detected,  # Store original type for recovery when posting
            date=payload.date,
            total=fmt(payload.total),
            subtotal=fmt(payload.subtotal),
            tax=fmt(payload.tax),
            balance=fmt(payload.balance),
            vendor=payload.vendor,
            customer=payload.customer,
            billed_to=payload.billed_to,
            invoice_number=payload.invoice_number,
            receipt_number=payload.receipt_number,
            po_number=payload.po_number,
            credit_note_number=payload.credit_note_number,
            debit_note_number=payload.debit_note_number,
            quotation_number=payload.quotation_number,
            delivery_note_number=payload.delivery_note_number,
            asset_class=payload.asset_class.value if payload.asset_class else None,
            expense_category=payload.expense_category.value if payload.expense_category else None,
            items=clean_items,
            employee_salaries=clean_salaries,
            bank_statement_lines=clean_banks,
            asset_description=payload.asset_description,
            asset_value=fmt(payload.asset_value),
            interest_rate=fmt(payload.interest_rate),
            loan_lender=payload.loan_lender,
            loan_terms=payload.loan_terms,
            equity_investor=payload.equity_investor,
            equity_terms=payload.equity_terms,
            payroll_month=payload.payroll_month,
            # Saves the AI's inner monologue right into the audit trace UI
            raw_text=f"{payload.agent_narration}\n\nAI CAPTURE [Conf: {payload.confidence_score}]: {payload.human_review_reason or 'Validated'}"
        )
    return document


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()

            # Also create farmer profile
            get_or_create_business(user)

            # Get tokens using custom serializer
            token_serializer = CustomTokenObtainPairSerializer(data={
                'username': request.data['username'],
                'password': request.data['password']
            })
            token_serializer.is_valid(raise_exception=True)
            tokens = token_serializer.validated_data

            return Response({
                'message': 'Signup successful.',
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'username': user.username,
                'email': user.email,
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Business Profile Views
class BusinessProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = get_or_create_business(request.user)
        serializer = BusinessProfileSerializer(profile)
        return Response(serializer.data)

    def post(self, request):
        profile = get_or_create_business(request.user)
        serializer = BusinessProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)


class CreateProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = get_or_create_business(request.user)
        profile.phone = request.data.get('phone', profile.phone)
        profile.address = request.data.get('address', profile.address)
        if 'image' in request.FILES:
            profile.image = request.FILES['image']
        profile.save()
        return Response({'detail': 'Profile updated'}, status=201)
    
class MyProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = get_or_create_business(request.user)
        data = {
            'name': profile.name,
            'email': profile.email,
            'phone': profile.phone,
            'address': profile.address,
            'image': profile.image.url if profile.image else '',
        }
        return Response(data)
            

class DocumentListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        documents = Document.objects.filter(business__user=request.user)
        serializer = DocumentSerializer(documents, many=True)
        return Response(serializer.data)

    def post(self, request):
        data = request.data.copy()
        user_id = data.get("user_id")

        if user_id:
            try:
                business = BusinessProfile.objects.get(user_id=user_id)
                data["business"] = business.pk
            except BusinessProfile.DoesNotExist:
                return Response(
                    {"business": ["No BusinessProfile found for this user"]},
                    status=status.HTTP_400_BAD_REQUEST,
                )    
        serializer = DocumentSerializer(data=data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RevokeDocumentView(APIView):
    """
    Creates strict IFRS reversing entries for a document's transactions,
    unlinks the audit trail to preserve ledger immutability, 
    and removes the document from the UI.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        business = request.user.business_profile
        try:
            document = Document.objects.get(pk=pk, business=business)
        except Document.DoesNotExist:
            return Response({"error": "Document not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            with db_transaction.atomic():
                # 1. Find the original transactions tied to this document
                transactions = Transaction.objects.filter(document=document)
                
                for txn in transactions:
                    # Cannot reverse if the period is locked
                    if txn.period and txn.period.is_closed:
                        return Response(
                            {"error": "Cannot revoke. The financial period is already closed."}, 
                            status=status.HTTP_400_BAD_REQUEST
                        )
                    
                    # 2. Build the Reversing Journal Entries
                    reversal_entries = []
                    for je in txn.entries.all():
                        # Strict IFRS: Flip debit to credit and vice versa
                        rev_type = "credit" if je.entry_type == "debit" else "debit"
                        reversal_entries.append({
                            "ifrs_account": je.account.ifrs_account,
                            "amount": je.amount,
                            "type": rev_type
                        })
                        
                    # 3. Post the Reversal Transaction
                    if reversal_entries:
                        rev_txn = Transaction.objects.create(
                            business=business,
                            date=date.today(),
                            status=TransactionStatus.DRAFT,
                            description=f"REVERSAL of Document #{document.pk} ({txn.description})"
                        )
                        # This safely updates the Account balances in reverse
                        rev_txn.post_transaction(reversal_entries)
                    
                    # 4. Unlink original transaction to prevent CASCADE deletion
                    # This preserves the immutable double-entry audit trail
                    txn.document = None
                    txn.description = f"[REVOKED] {txn.description}"
                    txn.save()

                # 5. Delete the parsed document so it leaves the Overwatch Queue
                document.delete()

            return Response({"status": "success", "message": "Transaction revoked and ledger reversed."})

        except Exception as e:
            logger.error(f"Revoke Failure: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Live Agent Stream Handler for Multimodal Input Processing
# Handles unified processing of visual documents (images/PDFs) and voice commands
class LiveAgentStreamView(APIView):
    """
    Unified Multimodal Pipeline.
    If only image is sent: Runs autonomous background extraction.
    If audio + image are sent: Enters 'Command Mode', executing user voice commands 
    and autonomously firing ledger tools.
    """
    permission_classes = [IsAuthenticated]

    def generate_tts_base64(self, text):
        try:
            client = texttospeech.TextToSpeechClient()
            synthesis_input = texttospeech.SynthesisInput(text=text)
            voice = texttospeech.VoiceSelectionParams(language_code="en-US", name="en-US-Journey-F")
            audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
            response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
            return base64.b64encode(response.audio_content).decode('utf-8')
        except Exception as e:
            logger.error(f"TTS Engine Failure: {e}")
            return ""

    def post(self, request):
        business = request.user.business_profile
        image_data_b64 = request.data.get('image_data')
        audio_data_b64 = request.data.get('audio_data') 
        
        if not image_data_b64:
            return Response({"error": "No image provided"}, status=400)

        # 1. Prepare visual data (Dynamically supports Uploader PDFs & UI Navigator JPEGs)
        if ',' in image_data_b64:
            header, encoded_data = image_data_b64.split(',', 1)
            mime_type = header.replace('data:', '').split(';')[0]
            image_bytes = base64.b64decode(encoded_data)
        else:
            image_bytes = base64.b64decode(image_data_b64)
            mime_type = 'image/jpeg' # Safe fallback for UI Navigator screen frames
            
        valid_mimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
        if mime_type not in valid_mimes: 
            mime_type = 'image/jpeg'

        visual_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

        client = _get_vertex_client()
        if not client:
            return Response({"error": "AI Engine unavailable."}, status=500)

        # DYNAMIC IDENTITY & AUDIT PROMPT
        # We ensure it falls back to username so it never defaults to "this company"
        biz_name = business.business_name or request.user.username or "your company"
        
        dynamic_extraction_prompt = (
            f"Extract transaction details strictly matching the JSON schema. "
            f"IDENTITY: You are the AI CFO for '{biz_name}'. "
            f"AGENT NARRATION: Write a brief, professional 1-2 sentence first-person monologue in the 'agent_narration' field describing what you see. "
            f"MANDATORY extraction: You MUST find and extract the recipient name into the 'billed_to' or 'customer' field. "
            f"CLASSIFICATION LOGIC (CRITICAL):\n"
            f"  1. IGNORE document text labels like 'INVOICE' or 'BILL'.\n"
            f"  2. If '{biz_name}' is the SELLER (money incoming) → 'invoice'.\n"
            f"  3. If '{biz_name}' is the BUYER of Services/Consumables/Rent → 'bill'.\n"
            f"  4. If '{biz_name}' is the BUYER of Hardware/Laptops/Servers/Furniture → 'asset_purchase'.\n"
            f"  5. If the document acknowledges incoming investment money → 'equity_injection'."
        )

        # Voice Command Mode - Immersive Command Processing
        # Executes user voice commands autonomously with access to ledger tools
        if audio_data_b64:
            audio_bytes = base64.b64decode(audio_data_b64.split(',')[1] if ',' in audio_data_b64 else audio_data_b64)
            audio_part = types.Part.from_bytes(data=audio_bytes, mime_type='audio/webm')

            # Extract valid codes directly from your DB schema to prevent AI hallucinations
            valid_accs = ", ".join([a[0] for a in IFRS_ACCOUNTS])

            # Define the tools the AI is allowed to use autonomously
            agent_tools = types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name="post_manual_adjustment",
                        description="Post a double-entry manual adjustment to the ledger.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "debit_account": {"type": "STRING", "description": f"Exact IFRS account code from: {valid_accs}"},
                                "credit_account": {"type": "STRING", "description": f"Exact IFRS account code from: {valid_accs}"},
                                "amount": {"type": "NUMBER", "description": "Transaction amount"},
                                "description": {"type": "STRING", "description": "Extract the exact reason or intent the user provided for this adjustment."}
                            },
                            "required": ["debit_account", "credit_account", "amount", "description"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="close_financial_period",
                        description="Close the current financial period. This calculates all depreciation/appreciation, zeroes out the P&L into Retained Earnings, and rolls the ledger forward to the next year. ONLY execute this if the user explicitly asks to close the period or year.",
                        parameters={"type": "OBJECT", "properties": {}, "required": []}
                    ),
                    types.FunctionDeclaration(
                        name="resolve_pending_document",
                        description="Approve (post) or Reject (revoke/discard) a document on screen that was halted for review.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "action": {"type": "STRING", "description": "'POST' to approve/proceed, 'REVOKE' to discard/reverse"},
                                "document_type": {"type": "STRING", "description": "Correct IFRS document type (e.g., 'equity_injection', 'bill', 'invoice', 'asset_purchase', 'receipt') - optional if action is clear from context"},
                                "expense_category": {
                                    "type": "STRING", 
                                    "description": f"Only if bill. MUST be exact: {', '.join([e.value for e in ExpenseCategory])}"
                                },
                                "asset_class": {
                                    "type": "STRING", 
                                    "description": f"Only if asset_purchase. MUST be exact: {', '.join([a.value for a in AssetClass])}"
                                }
                            },
                            "required": ["action"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="settle_vendor_bill",
                        description="Prepare and queue a vendor bill payment for the user to securely sign locally via OpenClaw.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "document_id": {"type": "NUMBER", "description": "The ID of the bill to pay."},
                                "amount": {"type": "NUMBER", "description": "Amount to pay."},
                                "vendor_wallet": {"type": "STRING", "description": "Web3 address of vendor."},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'celo-sepolia'."
                                }
                            },
                            "required": ["document_id", "amount", "vendor_wallet"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="execute_micro_payroll",
                        description="Calculate and queue a batch payroll transaction for the user to securely sign locally via OpenClaw.",
                        parameters={
                            "type": "OBJECT", 
                            "properties": {
                                "confirm": {"type": "BOOLEAN"},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'celo-sepolia'."
                                }
                            }, 
                            "required": ["confirm"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="optimize_treasury_yield",
                        description="Prepare a transaction to deploy excess cash into DeFi protocols, queuing it for the user to sign locally.",
                        parameters={
                            "type": "OBJECT", 
                            "properties": {
                                "amount_to_deploy": {"type": "NUMBER"},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'celo-sepolia'."
                                }
                            }, 
                            "required": ["amount_to_deploy"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="fund_tax_escrow",
                        description="Prepare a transaction to lock USDT funds into a Web3 tax escrow vault, queuing it for the user to sign locally.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "tax_amount": {"type": "NUMBER", "description": "Amount of USDT to lock in escrow."},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Default is 'celo-sepolia'."
                                }
                            },
                            "required": ["tax_amount"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="distribute_dividends",
                        description="Calculate and queue quarterly profit distributions to shareholders for the user to sign locally via OpenClaw.",
                        parameters={
                            "type": "OBJECT", 
                            "properties": {
                                "total_amount": {"type": "NUMBER", "description": "Total amount of USDT to split among shareholders."},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'celo-sepolia'."
                                }
                            }, 
                            "required": ["total_amount"]
                        }
                    )
                ]
            )

            prompt = f"""You are AutoBooks, a highly competent CFO Copilot. Listen to my command and look at the screen.
            1. CONVERSATION RULE: If the user is just making casual conversation (like saying "thank you", "hello", or "got it"), respond politely and briefly without calling any tools. DO NOT attempt to extract or read the document on the screen again.
            2. If asked to proceed, approve, or post a halted document, MUST use 'resolve_pending_document' tool with action='POST'. Deduce the 'document_type' from the screen.
            3. If asked to revoke, discard, or cancel, use 'resolve_pending_document' with action='REVOKE'.
            4. If asked to manually adjust accounts, use 'post_manual_adjustment'.
            Keep voice responses professional, authoritative, and extremely brief.
            {dynamic_extraction_prompt}"""

            try:
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[prompt, visual_part, audio_part],
                    config=types.GenerateContentConfig(tools=[agent_tools], temperature=0.1)
                )

                if response.function_calls:
                    for call in response.function_calls:
                        
                        # Tool 1: Resolve Halted Document
                        # Approve or reject a document pending review
                        if call.name == "resolve_pending_document":
                            args = call.args
                            action = args["action"].upper()
                            
                            # Safely grab the exact document that triggered the halt
                            # Find pending documents: either type="unknown" OR type differs from ai_detected (Final Boss override)
                            from django.db.models import Q
                            doc = Document.objects.filter(
                                business=business
                            ).filter(
                                Q(document_type="unknown") |  # Standard human review
                                Q(ai_detected_type__isnull=False) & ~Q(document_type=models.F('ai_detected_type'))  # Final Boss override
                            ).order_by('-created_at').first()
                            
                            if not doc:
                                fail_audio = self.generate_tts_base64("I could not find a pending document to resolve.")
                                return Response({"status": "failed", "log_message": "Doc not found.", "audio_base64": fail_audio})

                            if action == "POST":
                                # Three-Layer Classification System for Document Type Resolution
                                # Layer 1 (Smart): Improved prompt helps AI classify semantically
                                # Layer 2 (Legal): Final Boss override forces bill if entity mismatch
                                # Layer 3 (Recovery): ai_detected_type preserves the original logic chain
                                # Priority: User override → AI override → Original AI detection → Default
                                provided_type = args.get("document_type")
                                detected_type = provided_type or doc.ai_detected_type or "bill"
                                doc.document_type = detected_type
                                
                                # Enforce IFRS Compliance dynamically via schemas
                                valid_expenses = [e.value for e in ExpenseCategory]
                                valid_assets = [a.value for a in AssetClass]
                                
                                if args.get("expense_category") in valid_expenses: 
                                    doc.expense_category = args.get("expense_category")
                                elif doc.document_type == "bill":
                                    doc.expense_category = ExpenseCategory.OPERATING_EXPENSES.value # Safe default

                                if args.get("asset_class") in valid_assets: 
                                    doc.asset_class = args.get("asset_class")
                                elif doc.document_type == "asset_purchase":
                                    doc.asset_class = AssetClass.PROPERTY_PLANT_EQUIPMENT.value # Safe default
                                    
                                doc.save()
                                
                                # Explicitly fire the double entry logic now that the type is known
                                doc.post_transaction()
                                
                                # Autonomous Economic Actor Trigger
                                # If document is a bill with vendor wallet, execute autonomous settlement
                                if doc.document_type == "bill" and doc.vendor and doc.total > 0:
                                    vendor_wallet = request.data.get("vendor_wallet_address")
                                    if vendor_wallet:
                                        try:
                                            wallet_address = business.wallet_address
                                            if not wallet_address:
                                                logger.warning(f"Business wallet not configured for autonomous settlement of bill #{doc.id}")
                                            else:
                                                agent = Web3Agent(wallet_address)
                                                intent = agent.build_settle_bill_intent(
                                                    vendor_wallet=vendor_wallet,
                                                    amount=float(doc.total),
                                                    currency="USDT",
                                                    network=business.primary_network
                                                )
                                                
                                                doc.unsigned_payload = intent
                                                doc.save()
                                                
                                                # Halt the transaction for local signing 
                                                txn = doc.transactions.first()
                                                if txn:
                                                    txn.status = TransactionStatus.PENDING_SIGNATURE
                                                    txn.save()
                                                    
                                                logger.info(f"Autonomous settlement queued for bill #{doc.id}")
                                        except Exception as e:
                                            logger.warning(f"Autonomous settlement intent generation failed (non-blocking): {e}")
                                
                                # CFO TRACE NARRATION (Voice Override)
                                txn = doc.transactions.first()
                                trace_narration = ""
                                if txn and txn.entries.exists():
                                    dr_entry = txn.entries.filter(entry_type="debit").first()
                                    cr_entry = txn.entries.filter(entry_type="credit").first()
                                    if dr_entry and cr_entry:
                                        dr_acc = dr_entry.account.ifrs_account.replace('_', ' ')
                                        cr_acc = cr_entry.account.ifrs_account.replace('_', ' ')
                                        trace_narration = f" I have debited {dr_acc}, and credited {cr_acc} for {dr_entry.amount} shillings."

                                success_audio = self.generate_tts_base64(f"Understood. The {doc.document_type.replace('_', ' ')} is posted.{trace_narration} Please check your financial statements to confirm. Is there anything else I can do for you?")
                                return Response({"status": "success", "log_message": f"Agent posted doc #{doc.id}", "audio_base64": success_audio})
                            
                            elif action == "REVOKE":
                                # Pending documents have no ledger entries yet, so we just shred the draft
                                doc.delete()
                                success_audio = self.generate_tts_base64("Got it. The pending document has been securely discarded.")
                                # Return 'ignored' so the frontend clears the green success box and shows the blue info box instead
                                return Response({"status": "ignored", "log_message": "Agent securely discarded the document.", "audio_base64": success_audio})

                        # Tool 2: Manual Adjustment
                        # Post double-entry manual adjustments to the ledger
                        elif call.name == "post_manual_adjustment":
                            args = call.args
                            debit_acc = Account.objects.filter(business=business, ifrs_account=args["debit_account"]).first()
                            credit_acc = Account.objects.filter(business=business, ifrs_account=args["credit_account"]).first()
                            
                            if debit_acc and credit_acc:
                                with db_transaction.atomic():
                                    txn = Transaction.objects.create(
                                        business=business, description=args.get("description", "Agentic Voice Override"),
                                        is_manual_adjustment=True, status=TransactionStatus.POSTED
                                    )
                                    txn.post_transaction([
                                        {"ifrs_account": debit_acc.ifrs_account, "type": "debit", "amount": args["amount"]},
                                        {"ifrs_account": credit_acc.ifrs_account, "type": "credit", "amount": args["amount"]}
                                    ])
                                success_audio = self.generate_tts_base64(f"Done. I have posted {args['amount']} to {debit_acc.name}.")
                                return Response({"status": "success", "log_message": "Agent executed adjustment.", "audio_base64": success_audio})
                            else:
                                return Response({"status": "failed", "log_message": "Invalid accounts", "audio_base64": self.generate_tts_base64("I couldn't find those specific IFRS accounts.")})

                        # Tool 3: Close Financial Period
                        # Archive the current period and prepare for the next reporting cycle
                        elif call.name == "close_financial_period":
                            current_period = business.get_current_period()
                            if current_period.is_closed:
                                audio = self.generate_tts_base64("The current financial period is already closed.")
                                return Response({"status": "ignored", "log_message": "Already closed", "audio_base64": audio})
                            else:
                                try:
                                    with db_transaction.atomic():
                                        current_period.close_period()
                                        business.start_new_period()
                                    audio = self.generate_tts_base64("The financial year has been closed successfully. All depreciation and fair value adjustments have been processed, and the ledger is locked.")
                                    return Response({"status": "success", "log_message": "Year Closed.", "audio_base64": audio})
                                except Exception as e:
                                    logger.error(f"Voice Close Period Failed: {e}")
                                    audio = self.generate_tts_base64("I encountered an error while trying to close the period.")
                                    return Response({"status": "failed", "log_message": str(e), "audio_base64": audio})

                        # Tool 4: Settle Vendor Bill (Queued for Secure Signing)
                        # Prepare a vendor payment transaction for user approval and blockchain execution
                        elif call.name == "settle_vendor_bill":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                doc = Document.objects.get(id=args["document_id"], business=business)
                                
                                if not business.wallet_address:
                                    fail_audio = self.generate_tts_base64("Business treasury address not configured.")
                                    return Response({"status": "failed", "log_message": "No wallet", "audio_base64": fail_audio})
                                
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_settle_bill_intent(vendor_wallet=args["vendor_wallet"], amount=float(args["amount"]), currency="USDT", network=network)
                                
                                doc.unsigned_payload = intent
                                doc.save()

                                usdt_amount = Decimal(str(args["amount"]))
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Settlement - {usdt_amount} USDT @ {live_fx_rate} KES/USDT to {args['vendor_wallet']}", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                success_msg = f"Payment Queued. Please authorize {usdt_amount} USDT to the vendor using your local OpenClaw client."
                                success_audio = self.generate_tts_base64(success_msg)
                                return Response({"status": "success", "log_message": "Intent queued.", "audio_base64": success_audio})
                            except Document.DoesNotExist:
                                fail_audio = self.generate_tts_base64(f"Document {args['document_id']} not found.")
                                return Response({"status": "failed", "log_message": "Doc not found", "audio_base64": fail_audio})
                            except Exception as e:
                                logger.error(f"Voice Bill Settlement Error: {e}")
                                fail_audio = self.generate_tts_base64("Error generating bill payment intent.")
                                return Response({"status": "failed", "log_message": str(e), "audio_base64": fail_audio})

                        elif call.name == "execute_micro_payroll":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                pnl_data = business.get_pnl()
                                net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                                if net_profit <= 0:
                                    fail_audio = self.generate_tts_base64("Cannot run payroll. Net profit is zero or negative.")
                                    return Response({"status": "failed", "log_message": "No profit", "audio_base64": fail_audio})
                                    
                                if not business.wallet_address:
                                    fail_audio = self.generate_tts_base64("Business wallet not configured.")
                                    return Response({"status": "failed", "log_message": "No wallet", "audio_base64": fail_audio})
                                    
                                employees = business.employee_wallets or []
                                if not employees:
                                    fail_audio = self.generate_tts_base64("No employees configured. Add employee wallet addresses first.")
                                    return Response({"status": "failed", "log_message": "No employees", "audio_base64": fail_audio})
                                    
                                payroll_array = Web3Automation.get_payroll_distribution_strategy(employees, Decimal(str(net_profit)))
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_batch_payroll_intent(payroll_array, f"Autonomous Payroll - {date.today()}", network=network)
                                
                                total_payroll = sum([Decimal(str(emp.get("amount", 0))) for emp in payroll_array])
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                doc = Document.objects.create(
                                    business=business, document_type="payroll", date=date.today(),
                                    total=total_payroll, unsigned_payload=intent,
                                    raw_text="Payroll batch generated by AI. Awaiting local signature."
                                )
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Payroll ({len(employees)} employees, {total_payroll} USDT @ {live_fx_rate} KES/USDT)", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                success_msg = f"Payroll calculated. {len(employees)} employees will be paid {total_payroll:,.2f} USDT total. Please authorize via OpenClaw."
                                success_audio = self.generate_tts_base64(success_msg)
                                return Response({"status": "success", "log_message": "Payroll queued.", "audio_base64": success_audio})
                            except Exception as e:
                                logger.error(f"Voice Payroll Error: {e}")
                                fail_audio = self.generate_tts_base64(f"Payroll intent generation failed.")
                                return Response({"status": "failed", "log_message": str(e), "audio_base64": fail_audio})

                        elif call.name == "optimize_treasury_yield":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                amount_to_deploy = Decimal(str(args.get("amount_to_deploy", 0)))
                                if amount_to_deploy <= 0:
                                    fail_audio = self.generate_tts_base64("Invalid amount specified.")
                                    return Response({"status": "failed", "log_message": "Invalid amount", "audio_base64": fail_audio})
                                    
                                if not business.wallet_address:
                                    fail_audio = self.generate_tts_base64("Business wallet not configured.")
                                    return Response({"status": "failed", "log_message": "No wallet", "audio_base64": fail_audio})
                                    
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_yield_deployment_intent(float(amount_to_deploy), network=network)
                                
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                doc = Document.objects.create(
                                    business=business, document_type="journal_entry", date=date.today(),
                                    total=amount_to_deploy, unsigned_payload=intent,
                                    raw_text="Yield deployment intent generated. Awaiting local signature."
                                )
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Yield Deployment ({amount_to_deploy} USDT @ {live_fx_rate} KES/USDT)", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                success_msg = f"Yield deployment of {amount_to_deploy:,.2f} USDT is ready. Please authorize via OpenClaw."
                                success_audio = self.generate_tts_base64(success_msg)
                                return Response({"status": "success", "log_message": "Yield queued.", "audio_base64": success_audio})
                            except Exception as e:
                                logger.error(f"Voice Yield Optimization Error: {e}")
                                fail_audio = self.generate_tts_base64("Yield intent generation failed.")
                                return Response({"status": "failed", "log_message": str(e), "audio_base64": fail_audio})

                        elif call.name == "distribute_dividends":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                total_dividend = Decimal(str(args.get("total_amount", 0)))
                                if total_dividend <= 0:
                                    fail_audio = self.generate_tts_base64("Please specify a valid amount to distribute.")
                                    return Response({"status": "ignored", "log_message": "Invalid amount", "audio_base64": fail_audio})
                                
                                if not business.wallet_address:
                                    fail_audio = self.generate_tts_base64("Wallet not configured.")
                                    return Response({"status": "failed", "log_message": "No wallet", "audio_base64": fail_audio})
                                
                                cap_table = business.get_cap_table()
                                valid_cap_table = [s for s in cap_table if s.get("wallet")]
                                
                                if not valid_cap_table:
                                    fail_audio = self.generate_tts_base64("Shareholders exist on the ledger, but none have Web3 wallets configured.")
                                    return Response({"status": "ignored", "log_message": "No wallets", "audio_base64": fail_audio})
                                    
                                distribution_array = Web3Automation.calculate_dividend_distribution(valid_cap_table, total_dividend)
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_dividend_distribution_intent(distribution_array, f"Dividend Distribution - {date.today()}", network=network)
                                
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                doc = Document.objects.create(
                                    business=business, document_type="journal_entry", date=date.today(),
                                    total=total_dividend, unsigned_payload=intent,
                                    raw_text="Dividend intent generated. Awaiting local signature."
                                )
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Dividend Distribution ({total_dividend} USDT @ {live_fx_rate} KES/USDT)", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                success_msg = f"Dividends queued. {total_dividend:,.2f} USDT ready for {len(distribution_array)} shareholders. Please authorize via OpenClaw."
                                success_audio = self.generate_tts_base64(success_msg)
                                return Response({"status": "success", "log_message": "Dividends queued.", "audio_base64": success_audio})
                            except Exception as e:
                                logger.error(f"Voice Dividend Error: {e}")
                                fail_audio = self.generate_tts_base64("Dividend intent generation failed.")
                                return Response({"status": "failed", "log_message": str(e), "audio_base64": fail_audio})

                        elif call.name == "fund_tax_escrow":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                amount_usdt = Decimal(str(args.get("tax_amount", 0)))
                                if amount_usdt <= 0:
                                    fail_audio = self.generate_tts_base64("Invalid tax amount specified.")
                                    return Response({"status": "failed", "log_message": "Invalid amount", "audio_base64": fail_audio})
                                    
                                if not business.wallet_address:
                                    fail_audio = self.generate_tts_base64("Business wallet not configured.")
                                    return Response({"status": "failed", "log_message": "No wallet", "audio_base64": fail_audio})
                                    
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_tax_escrow_intent(float(amount_usdt), network=network)
                                
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                doc = Document.objects.create(
                                    business=business, document_type="tax_filing", date=date.today(),
                                    total=amount_usdt, unsigned_payload=intent,
                                    raw_text="Tax escrow intent generated. Awaiting local signature."
                                )
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Tax Escrow ({amount_usdt} USDT @ {live_fx_rate} KES/USDT)", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                success_msg = f"Tax Escrow intent generated. {amount_usdt:,.2f} USDT ready to be locked. Please authorize in OpenClaw."
                                success_audio = self.generate_tts_base64(success_msg)
                                return Response({"status": "success", "log_message": "Escrow queued.", "audio_base64": success_audio})
                            except Exception as e:
                                logger.error(f"AI Tax Escrow Error: {e}")
                                fail_audio = self.generate_tts_base64("Tax escrow intent generation failed.")
                                return Response({"status": "failed", "log_message": str(e), "audio_base64": fail_audio})

                # If no tool was called, just reply verbally to the user
                reply_audio = self.generate_tts_base64(response.text)
                # Return 'ignored' so casual chats don't trigger the green trace box
                return Response({"status": "ignored", "log_message": "Agent replied.", "audio_base64": reply_audio})

            except Exception as e:
                logger.error(f"Voice Command Failure: {e}")
                return Response({"error": "Voice failure"}, status=500)

        # Background Watcher Mode - Automatic Document Detection
        # Continuously monitors for financial documents and extracts relevant information
        img_hash = hashlib.md5(image_bytes).hexdigest()
        if cache.get(img_hash) in ['irrelevant', 'processed']:
            logger.info(f"LiveAgentStreamView: Image hash cached, skipping processing")
            return Response({"status": "ignored", "log_message": "Screen cached. Skipping."})

        try:
            logger.info(f"LiveAgentStreamView MODE B: Calling Gemini flash for financial info check")
            flash_response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=["Does this contain financial info? YES or NO", visual_part],
                config=types.GenerateContentConfig(temperature=0.0)
            )
            logger.info(f"LiveAgentStreamView MODE B: Flash response received: {flash_response.text[:100]}")
            if 'YES' not in flash_response.text.upper():
                logger.info(f"LiveAgentStreamView MODE B: No financial context detected")
                cache.set(img_hash, 'irrelevant', 120)
                return Response({"status": "ignored", "log_message": "No financial context detected."})

            logger.info(f"LiveAgentStreamView MODE B: Calling Gemini for detailed extraction")
            pro_response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[dynamic_extraction_prompt, visual_part],
                config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=AgenticPayload, temperature=0.0)
            )
            logger.info(f"LiveAgentStreamView MODE B: Extraction response received, validating JSON")

            payload = AgenticPayload.model_validate_json(pro_response.text)
            logger.info(f"LiveAgentStreamView MODE B: Payload validated, requires_human_review={payload.requires_human_review}")
            
            # (Logical deduplication: Ignore AI document_type in case of prior human overrides)
            formatted_total = Decimal(str(payload.total or "0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            is_duplicate = Document.objects.filter(
                business=business, 
                date=payload.date, 
                total=formatted_total, 
                vendor=payload.vendor
            ).exists()

            if is_duplicate:
                logger.info(f"LiveAgentStreamView MODE B: Duplicate document detected, skipping")
                cache.set(img_hash, 'processed', 300)
                
                # Force the CFO to speak the rejection out loud
                block_audio = self.generate_tts_base64("Halt. I have blocked this document because it is a duplicate and is already recorded in the ledger.")
                
                # Switch status to 'failed' so the frontend UI renders the red block and plays the audio
                return Response({
                    "status": "failed", 
                    "log_message": "Duplicate blocked. This document is already in the ledger.",
                    "audio_base64": block_audio
                })

            logger.info(f"LiveAgentStreamView MODE B: Ingesting document from payload")
            document = ingest_agentic_payload(business, payload)
            logger.info(f"LiveAgentStreamView MODE B: Document created with ID {document.id}")

            if payload.requires_human_review:
                logger.info(f"LiveAgentStreamView MODE B: Document {document.id} requires human review: {payload.human_review_reason}")
                speech_text = f"{payload.agent_narration} However, I must halt. {payload.human_review_reason}"
                audio_b64 = self.generate_tts_base64(speech_text)

                return Response({
                    "status": "requires_human_review",
                    "reason": payload.human_review_reason,
                    "document": {
                        "id": document.id,
                        "document_type": document.document_type,
                        "vendor": document.vendor,
                        "total": float(document.total),
                        "date": str(document.date),
                        "ai_detected_type": document.ai_detected_type,
                    },
                    "audio_base64": audio_b64
                })

            # Successful Post: Return comprehensive audit trace to user
            cache.set(img_hash, 'processed', 300)
            
            try:
                # Get transaction details
                txn = document.transactions.first() if document.transactions.exists() else None
                
                # 1. Build audit trace
                audit_trace = {}
                if document.ai_detected_type and document.ai_detected_type != document.document_type:
                    audit_trace["detected_type"] = document.ai_detected_type
                    audit_trace["system_override"] = f"{document.ai_detected_type} → {document.document_type}"
                elif document.ai_detected_type:
                    audit_trace["detected_type"] = document.ai_detected_type
                
                # 2. Get ledger entries
                ledger_entries = {"debits": [], "credits": []}
                if txn and txn.entries.exists():
                    for entry in txn.entries.filter(entry_type="debit"):
                        ledger_entries["debits"].append({
                            "account": entry.account.ifrs_account,
                            "amount": float(entry.amount)
                        })
                    for entry in txn.entries.filter(entry_type="credit"):
                        ledger_entries["credits"].append({
                            "account": entry.account.ifrs_account,
                            "amount": float(entry.amount)
                        })
                
                # 3. Get balance sheet impact
                bs_data = business.get_balance_sheet()
                balance_sheet_impact = {
                    "assets": float(bs_data.get("assets", Decimal("0.00"))),
                    "liabilities": float(bs_data.get("liabilities", Decimal("0.00"))),
                    "equity": float(bs_data.get("equity", Decimal("0.00")))
                }
                
                entity_name = document.vendor or document.customer or document.billed_to or "the counterparty"
                
                # NARRATION: Read the actual double-entry impact
                trace_narration = ""
                if ledger_entries["debits"] and ledger_entries["credits"]:
                    dr_acc = ledger_entries["debits"][0]["account"].replace('_', ' ')
                    cr_acc = ledger_entries["credits"][0]["account"].replace('_', ' ')
                    amount = ledger_entries["debits"][0]["amount"]
                    trace_narration = f" I have debited {dr_acc} for {amount} shillings, and credited {cr_acc}."

                audio_text = f"{payload.agent_narration} The {document.document_type.replace('_', ' ')} from {entity_name} has been validated.{trace_narration} Please review the financial statements to confirm. What would you like to do next?"
                audio_b64 = self.generate_tts_base64(audio_text)
                
                return Response({
                    "status": "success",
                    "document": {
                        "id": document.id,
                        "document_type": document.document_type,
                        "vendor": document.vendor,
                        "total": float(document.total),
                        "date": str(document.date),
                        "ai_detected_type": document.ai_detected_type,
                    },
                    "audit_trace": audit_trace,
                    "ledger_entries": ledger_entries,
                    "balance_sheet_impact": balance_sheet_impact,
                    "audio_base64": audio_b64
                })
            except Exception as e:
                logger.error(f"Audit trace construction failed: {e}")
                audio_b64 = self.generate_tts_base64(f"Document posted successfully.")
                return Response({
                    "status": "success",
                    "document": {
                        "id": document.id,
                        "document_type": document.document_type,
                        "vendor": document.vendor,
                        "total": float(document.total),
                        "date": str(document.date),
                    },
                    "audio_base64": audio_b64
                })

        except Exception as e:
            logger.error(f"LiveAgentStreamView MODE B Exception: {str(e)}", exc_info=True)
            return Response({"error": str(e)}, status=400)


# CFO Insight Generator - Personality and Language Engine
# Transforms raw financial data into articulate, strategic insights
def generate_cfo_insight(client, biz_name, query, data_context):
    """Feeds raw data back to Gemini for an empathetic, conversational response."""
    if not query: return "Here is the financial breakdown you requested:"
    
    prompt = f"""You are the highly eloquent, empathetic, and strategic CFO for '{biz_name or 'this company'}'. 
    Your boss/client just asked you: "{query}"
    
    Here is the exact financial data you pulled from the ledger: {data_context}
    
    CRITICAL INSTRUCTIONS:
    1. Write exactly 2 to 3 warm, conversational, professional sentences answering the question using the data.
    2. Provide strategic insight or advice based on the numbers.
    3. STRICT RULE: DO NOT output any lists, bullet points, tables, or restate the raw numbers.
    4. STRICT RULE: DO NOT use emojis in your response.
    5. STOP generating text immediately after your conversational sentences."""
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash', 
            contents=prompt, 
            config=types.GenerateContentConfig(temperature=0.7) 
        )
        # Physically strip out any rogue markdown or asterisks the AI might still try to sneak in
        clean_text = response.text.replace('*', '').strip()
        return clean_text
    except Exception as e:
        logger.error(f"CFO Insight Generator Failed: {e}")
        return "Here is the financial data you requested:"


# WhatsApp Agent Handler via Twilio Webhook
# Receives WhatsApp messages with attachments and processes using the same neurosymbolic pipeline
class WhatsAppWebhookView(APIView):
    """
    Receives WhatsApp messages (Text + PDFs/Images) via Twilio.
    Uses the EXACT same neurosymbolic pipeline as the web agent.
    """
    permission_classes = [AllowAny] # Twilio doesn't use JWT, we auth by phone number

    def post(self, request):
        incoming_msg = request.data.get('Body', '').strip()
        sender_phone = request.data.get('From', '') 
        media_url = request.data.get('MediaUrl0')
        media_type = request.data.get('MediaContentType0')

        # 1. Authenticate via Phone Number
        clean_phone = sender_phone.replace('whatsapp:', '').replace('+', '')
        business = BusinessProfile.objects.filter(phone__icontains=clean_phone[-9:]).first()

        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

        def send_whatsapp(text):
            try:
                twilio_client.messages.create(
                    from_=TWILIO_WHATSAPP_NUMBER,
                    body=text,
                    to=sender_phone
                )
            except Exception as e:
                logger.error(f"Twilio Send Error: {e}")

        if not business:
            send_whatsapp("ERROR: Unrecognized phone number. Please update your AutoBooks profile to include this number.")
            return HttpResponse(status=200)

        document_part = None
        if media_url:
            # Download the PDF or Image from Twilio
            media_response = requests.get(media_url, auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN))
            if media_response.status_code == 200:
                mime_type = media_type if media_type in ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] else 'image/jpeg'
                document_part = types.Part.from_bytes(data=media_response.content, mime_type=mime_type)
            else:
                send_whatsapp("ERROR: Could not securely download the attached document from WhatsApp.")
                return HttpResponse(status=200)
        
        if not document_part and not incoming_msg:
            send_whatsapp("Hi! Send me a command or a financial document (PDF/Image) to process.")
            return HttpResponse(status=200)

        client = _get_vertex_client()
        if not client:
            return Response({"error": "AI Engine unavailable."}, status=500)

        # DYNAMIC IDENTITY & AUDIT PROMPT
        # We ensure it falls back to username so it never defaults to "this company"
        biz_name = business.business_name or request.user.username or "your company"
        
        dynamic_extraction_prompt = (
            f"Extract transaction details strictly matching the JSON schema. "
            f"IDENTITY: You are the AI CFO for '{biz_name}'. "
            f"AGENT NARRATION: Write a brief, professional 1-2 sentence first-person monologue in the 'agent_narration' field describing what you see. "
            f"MANDATORY extraction: You MUST find and extract the recipient name into the 'billed_to' or 'customer' field. "
            f"CLASSIFICATION LOGIC (CRITICAL):\n"
            f"  1. IGNORE document text labels like 'INVOICE' or 'BILL'.\n"
            f"  2. If '{biz_name}' is the SELLER (money incoming) → 'invoice'.\n"
            f"  3. If '{biz_name}' is the BUYER of Services/Consumables/Rent → 'bill'.\n"
            f"  4. If '{biz_name}' is the BUYER of Hardware/Laptops/Servers/Furniture → 'asset_purchase'.\n"
            f"  5. If the document acknowledges incoming investment money → 'equity_injection'."
        )

        # Autonomous Extraction Mode
        # Processes document extraction when image or PDF is sent
        if document_part:
            guidance = f"\nUser specifically commanded: '{incoming_msg}'. Obey this instruction." if incoming_msg else ""
            prompt = f"{dynamic_extraction_prompt}{guidance}"
            
            try:
                pro_response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[prompt, document_part],
                    config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=AgenticPayload, temperature=0.0)
                )
                payload = AgenticPayload.model_validate_json(pro_response.text)
                
                # Logical Deduplication: Ignore AI document_type in case of prior human overrides
                formatted_total = Decimal(str(payload.total or "0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                is_duplicate = Document.objects.filter(
                    business=business, 
                    date=payload.date, 
                    total=formatted_total, 
                    vendor=payload.vendor
                ).exists()

                if is_duplicate:
                    send_whatsapp("WARNING: Duplicate document detected. This document is already in the ledger.")
                    return HttpResponse(status=200)

                document = ingest_agentic_payload(business, payload)

                if payload.requires_human_review:
                    msg = (f"REVIEW NEEDED\n\n"
                           f"Type: {payload.document_type.value.replace('_', ' ').title()}\n"
                           f"Total: KSH {payload.total:,.2f}\n"
                           f"Reason: {payload.human_review_reason}\n\n"
                           f"Reply with 'Proceed' to post, or 'Cancel' to discard.")
                    send_whatsapp(msg)
                else:
                    # 1. FETCH RICH AUDIT TRACE
                    txn = document.transactions.first() if document.transactions.exists() else None
                    decision = ""
                    if txn and txn.entries.exists():
                        for entry in txn.entries.filter(entry_type="debit"):
                            decision += f"[DEBIT] {entry.account.ifrs_account}: KSH {entry.amount:,.2f}\n"
                        for entry in txn.entries.filter(entry_type="credit"):
                            decision += f"[CREDIT] {entry.account.ifrs_account}: KSH {entry.amount:,.2f}\n"
                    else:
                        decision = "[AUTO] Ledger entries generated implicitly.\n"

                    # Current Financial Position
                    bs_data = business.get_balance_sheet()
                    position = f"\nBALANCE SHEET IMPACT\n"
                    position += f"Assets: KSH {bs_data.get('assets', Decimal('0.00')):,.2f}\n"
                    position += f"Liabilities: KSH {bs_data.get('liabilities', Decimal('0.00')):,.2f}\n"
                    position += f"Equity: KSH {bs_data.get('equity', Decimal('0.00')):,.2f}\n"

                    # Extract entity name from available fields for clarity
                    entity_name = payload.vendor or payload.customer or payload.loan_lender or payload.equity_investor or payload.billed_to or "Unknown"
                    
                    msg = (f"POSTED TO LEDGER\n"
                           f"ID #{document.id} ({payload.document_type.value.replace('_', ' ').title()}) from {entity_name}\n"
                           f"Total: KSH {payload.total:,.2f}\n\n"
                           f"LEDGER ENTRIES\n{decision}{position}")
                    send_whatsapp(msg)
                return HttpResponse(status=200)
                
            except Exception as e:
                logger.error(f"Extraction Failure: {e}")
                send_whatsapp("FAILED: Could not process document. Please ensure it is clear and legible.")
                return HttpResponse(status=200)

        # Chat and Command Mode
        # Processes text-only queries using context-aware financial insights
        else:
            # Fetch context before calling the AI model for proper grounding
            from django.db.models import Q
            pending = Document.objects.filter(
                business=business
            ).filter(
                Q(document_type="unknown") |  # Standard human review
                Q(ai_detected_type__isnull=False) & ~Q(document_type=models.F('ai_detected_type'))  # Final Boss override
            ).order_by('-created_at').first()
            
            doc_context = ""
            if pending:
                override_note = ""
                if pending.ai_detected_type and pending.ai_detected_type != pending.document_type:
                    override_note = f" (AI said {pending.ai_detected_type}, but overridden to {pending.document_type})"
                doc_context = f"CONTEXT: Document #{pending.id} for KSH {pending.total} from {pending.vendor or pending.loan_lender or pending.equity_investor or 'Unknown'} is currently HALTED for your review{override_note}."

            valid_accs = ", ".join([a[0] for a in IFRS_ACCOUNTS])
            agent_tools = types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name="get_balance_sheet",
                        description="Retrieve the Statement of Financial Position (Balance Sheet) as of today.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {},
                            "required": []
                        }
                    ),
                    types.FunctionDeclaration(
                        name="get_pnl_statement",
                        description="Retrieve the Statement of Profit or Loss (Income Statement) for the current period.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {},
                            "required": []
                        }
                    ),
                    types.FunctionDeclaration(
                        name="get_cash_flow_statement",
                        description="Retrieve the Statement of Cash Flows for the current period.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {},
                            "required": []
                        }
                    ),
                    types.FunctionDeclaration(
                        name="get_account_balance",
                        description="Get the current balance of a specific account.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "account_code": {"type": "STRING", "description": f"IFRS account code from: {valid_accs}"}
                            },
                            "required": ["account_code"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="get_recent_transactions",
                        description="Retrieve the latest 5 transactions posted to the ledger.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {},
                            "required": []
                        }
                    ),
                    types.FunctionDeclaration(
                        name="post_manual_adjustment",
                        description="Post a double-entry manual adjustment to the ledger.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "debit_account": {"type": "STRING", "description": f"Exact IFRS code from: {valid_accs}"},
                                "credit_account": {"type": "STRING", "description": f"Exact IFRS code from: {valid_accs}"},
                                "amount": {"type": "NUMBER"},
                                "description": {"type": "STRING", "description": "Extract the exact reason or intent the user provided for this adjustment."}
                            },
                            "required": ["debit_account", "credit_account", "amount", "description"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="close_financial_period",
                        description="Close the current financial period. This calculates all depreciation/appreciation, zeroes out the P&L into Retained Earnings, and rolls the ledger forward to the next year. ONLY execute this if the user explicitly asks to close the period or year.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {},
                            "required": []
                        }
                    ),
                    types.FunctionDeclaration(
                        name="resolve_pending_document",
                        description="Approve (post) or Reject (revoke/discard) the currently halted document.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "action": {"type": "STRING", "description": "'POST' to approve/proceed, 'REVOKE' to discard/reverse"},
                                "document_type": {"type": "STRING", "description": "Document type to classify as (e.g., 'invoice', 'bill') - optional if already clear from context"},
                                "expense_category": {
                                    "type": "STRING", 
                                    "description": f"Only if bill. MUST be exact: {', '.join([e.value for e in ExpenseCategory])}"
                                },
                                "asset_class": {
                                    "type": "STRING", 
                                    "description": f"Only if asset_purchase. MUST be exact: {', '.join([a.value for a in AssetClass])}"
                                }
                            },
                            "required": ["action"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="request_platform_liquidity",
                        description="Request a short-term USDT loan/liquidity advance from the DeFi protocol based on ledger health. Call this if the user asks for a loan, advance, or to borrow money.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "amount_to_borrow": {"type": "NUMBER", "description": "Amount of USDT to borrow."},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Default is 'celo-sepolia'."
                                }
                            },
                            "required": ["amount_to_borrow"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="settle_vendor_bill",
                        description="Prepare and queue a vendor bill payment for the user to securely sign locally via OpenClaw.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "document_id": {"type": "NUMBER", "description": "The ID of the bill to pay."},
                                "amount": {"type": "NUMBER", "description": "Amount to pay."},
                                "vendor_wallet": {"type": "STRING", "description": "Wallet address of vendor."},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'ethereum-sepolia'."
                                }
                            },
                            "required": ["document_id", "amount", "vendor_wallet"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="execute_micro_payroll",
                        description="Calculate and queue a batch payroll transaction for the user to securely sign locally via OpenClaw.",
                        parameters={
                            "type": "OBJECT", 
                            "properties": {
                                "confirm": {"type": "BOOLEAN"},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'ethereum-sepolia'."
                                }
                            }, 
                            "required": ["confirm"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="optimize_treasury_yield",
                        description="Prepare a transaction to deploy excess cash into DeFi protocols, queuing it for the user to sign locally.",
                        parameters={
                            "type": "OBJECT", 
                            "properties": {
                                "amount_to_deploy": {"type": "NUMBER"},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'ethereum-sepolia'."
                                }
                            }, 
                            "required": ["amount_to_deploy"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="fund_tax_escrow",
                        description="Prepare a transaction to lock USDT funds into a Web3 tax escrow vault, queuing it for the user to sign locally.",
                        parameters={
                            "type": "OBJECT",
                            "properties": {
                                "tax_amount": {"type": "NUMBER", "description": "Amount of USDT to lock in escrow."},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Default is 'ethereum-sepolia'."
                                }
                            },
                            "required": ["tax_amount"]
                        }
                    ),
                    types.FunctionDeclaration(
                        name="distribute_dividends",
                        description="Calculate and queue quarterly profit distributions to shareholders for the user to sign locally via OpenClaw.",
                        parameters={
                            "type": "OBJECT", 
                            "properties": {
                                "total_amount": {"type": "NUMBER", "description": "Total amount of USDT to split among shareholders."},
                                "network": {
                                    "type": "STRING", 
                                    "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'ethereum-sepolia'."
                                }
                            }, 
                            "required": ["total_amount"]
                        }
                    )
                ]
            )

            prompt_instructions = f"""You are AutoBooks CFO WhatsApp Copilot for {business.business_name or 'this business'}. {doc_context}

CAPABILITIES:
1. Access Financial Data: Use get_balance_sheet, get_pnl_statement, get_cash_flow_statement, get_account_balance, get_recent_transactions.
2. Document Management: Use resolve_pending_document to post/discard pending documents.
3. Ledger Adjustments: Use post_manual_adjustment for manual entries.

BEHAVIOR:
- CONVERSATION RULE: If the user is just making casual conversation (like saying "thank you", "hello", or "got it"), respond politely. DO NOT attempt to extract or read the document again.
- STRICT COMMAND: If there is a CONTEXT showing a document HALTED for review, and the user replies with exactly "Proceed", "Approve", "Yes", or "Post", you MUST immediately call the `resolve_pending_document` tool with action='POST'. 
- STRICT COMMAND: If the user replies with exactly "Cancel", "Discard", "No", or "Revoke", you MUST immediately call the `resolve_pending_document` tool with action='REVOKE'.
- User asks about financials? Call the appropriate financial query tool FIRST, then answer with the actual data.
- Always cite specific amounts and periods when discussing financials.
- Keep responses professional, authoritative, and concise."""
            
            try:
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[prompt_instructions, f"User Message: {incoming_msg}"],
                    config=types.GenerateContentConfig(tools=[agent_tools], temperature=0.1)
                )

                if response.function_calls:
                    for call in response.function_calls:
                        # Financial Query Tool Handlers
                        # Retrieve and present financial statements and account information
                        if call.name == "get_balance_sheet":
                            bs_data = business.get_balance_sheet()
                            total_assets = bs_data.get("assets", Decimal("0.00"))
                            total_liabilities = bs_data.get("liabilities", Decimal("0.00"))
                            total_equity = bs_data.get("equity", Decimal("0.00"))
                            
                            insight = generate_cfo_insight(client, business.business_name, incoming_msg, f"Assets: {total_assets}, Liabilities: {total_liabilities}, Equity: {total_equity}")
                            
                            response_text = f"""{insight}

Balance Sheet as at {date.today()}
Assets: KSH {total_assets:,.2f}
Liabilities: KSH {total_liabilities:,.2f}
Equity: KSH {total_equity:,.2f}"""
                            send_whatsapp(response_text)
                            continue

                        elif call.name == "get_pnl_statement":
                            pnl_data = business.get_pnl()
                            total_income = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00"))
                            total_expenses = pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                            net_profit = total_income - total_expenses
                            
                            insight = generate_cfo_insight(client, business.business_name, incoming_msg, f"Income: {total_income}, Expenses: {total_expenses}, Net Profit: {net_profit}")
                            
                            response_text = f"""{insight}

Profit & Loss for current period
Income: KSH {total_income:,.2f}
Expenses: KSH {total_expenses:,.2f}
Net Profit: KSH {net_profit:,.2f}"""
                            send_whatsapp(response_text)
                            continue

                        elif call.name == "get_cash_flow_statement":
                            cf_data = business.get_cash_flow()
                            operating = cf_data.get("operating", Decimal("0.00"))
                            investing = cf_data.get("investing", Decimal("0.00"))
                            financing = cf_data.get("financing", Decimal("0.00"))
                            net_change = cf_data.get("net_change", Decimal("0.00"))
                            
                            insight = generate_cfo_insight(client, business.business_name, incoming_msg, f"Operating: {operating}, Investing: {investing}, Financing: {financing}, Net Change: {net_change}")
                            
                            response_text = f"""{insight}

Cash Flow Statement for current period
Operating Activities: KSH {operating:,.2f}
Investing Activities: KSH {investing:,.2f}
Financing Activities: KSH {financing:,.2f}
Net Cash Change: KSH {net_change:,.2f}"""
                            send_whatsapp(response_text)
                            continue

                        elif call.name == "get_account_balance":
                            account_code = call.args.get("account_code")
                            account = Account.objects.filter(business=business, ifrs_account=account_code).first()
                            
                            if account:
                                insight = generate_cfo_insight(client, business.business_name, incoming_msg, f"Account {account.name} has a balance of KSH {account.balance}.")
                                response_text = f"""{insight}\n\nAccount: {account.name}\nBalance: KSH {account.balance:,.2f}"""
                                send_whatsapp(response_text)
                            else:
                                send_whatsapp(f"ERROR: Account '{account_code}' not found.")
                            continue

                        elif call.name == "get_recent_transactions":
                            txns = Transaction.objects.filter(business=business, status=TransactionStatus.POSTED).order_by('-date')[:5]
                            if txns.exists():
                                total_posted = sum([t.entries.filter(entry_type="debit").first().amount for t in txns if t.entries.filter(entry_type="debit").exists()])
                                insight = generate_cfo_insight(client, business.business_name, incoming_msg, f"Showing last 5 transactions totaling KSH {total_posted}.")
                                
                                response_text = f"""{insight}\n\nLatest 5 Transactions\n\n"""
                                for txn in txns:
                                    amount = txn.entries.filter(entry_type="debit").first()
                                    if amount:
                                        response_text += f"• {txn.date}: {txn.description}\n  KSH {amount.amount:,.2f}\n\n"
                                send_whatsapp(response_text)
                            else:
                                send_whatsapp("📭 No transactions posted yet. Start recording your first transaction!")
                            continue

                        # Document Management Tool Handlers
                        # Approve or reject pending documents awaiting review
                        if call.name == "resolve_pending_document":
                            if not pending:
                                send_whatsapp("ERROR: Could not find a pending document to resolve.")
                                return HttpResponse(status=200)

                            action = call.args["action"].upper()
                            if action == "POST":
                                provided_type = call.args.get("document_type")
                                detected_type = provided_type or pending.ai_detected_type or "bill"
                                pending.document_type = detected_type
                                
                                # Enforce IFRS Compliance dynamically via schemas
                                valid_expenses = [e.value for e in ExpenseCategory]
                                valid_assets = [a.value for a in AssetClass]
                                
                                if call.args.get("expense_category") in valid_expenses: 
                                    pending.expense_category = call.args.get("expense_category")
                                elif pending.document_type == "bill":
                                    pending.expense_category = ExpenseCategory.OPERATING_EXPENSES.value

                                if call.args.get("asset_class") in valid_assets: 
                                    pending.asset_class = call.args.get("asset_class")
                                elif pending.document_type == "asset_purchase":
                                    pending.asset_class = AssetClass.PROPERTY_PLANT_EQUIPMENT.value
                                    
                                pending.save()
                                pending.post_transaction()
                                
                                # Comprehensive Audit Message with all transaction details
                                try:
                                    txn = pending.transactions.first() if pending.transactions.exists() else None
                                    
                                    # Audit Trace: Include all overrides and detections
                                    audit_trace = f"AUDIT TRACE\n"
                                    if provided_type:
                                        audit_trace += f"• User Override: {provided_type}\n"
                                    if pending.ai_detected_type and pending.ai_detected_type != detected_type:
                                        audit_trace += f"• System Override: {pending.ai_detected_type} → {detected_type}\n"
                                    elif pending.ai_detected_type:
                                        audit_trace += f"• AI Detected: {pending.ai_detected_type}\n"
                                    
                                    # Decision and Ledger Entries
                                    decision = f"\nLEDGER ENTRIES\n"
                                    if txn and txn.entries.exists():
                                        debits = txn.entries.filter(entry_type="debit")
                                        credits = txn.entries.filter(entry_type="credit")
                                        for entry in debits:
                                            decision += f"[DEBIT] {entry.account.ifrs_account}: KSH {entry.amount:,.2f}\n"
                                        for entry in credits:
                                            decision += f"[CREDIT] {entry.account.ifrs_account}: KSH {entry.amount:,.2f}\n"
                                    else:
                                        decision += "• Posting in progress...\n"
                                    
                                    # Current Financial Position
                                    bs_data = business.get_balance_sheet()
                                    position = f"\nBALANCE SHEET IMPACT\n"
                                    position += f"Assets: KSH {bs_data.get('assets', Decimal('0.00')):,.2f}\n"
                                    position += f"Liabilities: KSH {bs_data.get('liabilities', Decimal('0.00')):,.2f}\n"
                                    position += f"Equity: KSH {bs_data.get('equity', Decimal('0.00')):,.2f}\n"
                                    
                                    entity_name = pending.vendor or pending.customer or pending.loan_lender or pending.billed_to or "Unknown"
                                    full_message = f"DOCUMENT POSTED\nID #{pending.id} ({pending.document_type.replace('_', ' ').title()}) from {entity_name}\nTotal: KSH {pending.total:,.2f}\n\n{audit_trace}{decision}{position}"
                                    send_whatsapp(full_message)
                                except Exception as e:
                                    logger.error(f"Audit message construction failed: {e}")
                                    send_whatsapp(f"DOCUMENT POSTED\nID #{pending.id} ({pending.document_type.replace('_', ' ').title()}) has been successfully posted to the ledger.")
                            
                            elif action == "REVOKE":
                                pending_id = pending.id
                                pending.delete()
                                send_whatsapp(f"RECEIVED: Document #{pending_id} has been securely discarded.")
                            return HttpResponse(status=200)

                        elif call.name == "post_manual_adjustment":
                            args = call.args
                            debit_acc = Account.objects.filter(business=business, ifrs_account=args["debit_account"]).first()
                            credit_acc = Account.objects.filter(business=business, ifrs_account=args["credit_account"]).first()
                            
                            if debit_acc and credit_acc:
                                with db_transaction.atomic():
                                    audit_desc = args.get("description", "WhatsApp Manual Adjustment")
                                    txn = Transaction.objects.create(business=business, description=audit_desc, is_manual_adjustment=True, status=TransactionStatus.POSTED)
                                    txn.post_transaction([{"ifrs_account": debit_acc.ifrs_account, "type": "debit", "amount": args["amount"]}, {"ifrs_account": credit_acc.ifrs_account, "type": "credit", "amount": args["amount"]}])
                                send_whatsapp(f"COMPLETED: I have posted KSH {args['amount']} to {debit_acc.name}.")

                        elif call.name == "close_financial_period":
                            current_period = business.get_current_period()
                            if current_period.is_closed:
                                send_whatsapp("ERROR: The current financial period is already closed.")
                            else:
                                try:
                                    with db_transaction.atomic():
                                        current_period.close_period()
                                        business.start_new_period()
                                    
                                    insight = generate_cfo_insight(client, business.business_name, incoming_msg, "Period closed successfully. Depreciation calculated and Net Income transferred to Retained Earnings.")
                                    send_whatsapp(f"YEAR-END CLOSE COMPLETE\n\n{insight}\n\nThe ledger has been officially locked and rolled forward.")
                                except Exception as e:
                                    logger.error(f"AI Close Period Failed: {e}")
                                    send_whatsapp(f"ERROR: Failed to close the period: {str(e)}")
                            
                            return HttpResponse(status=200)
                        
                        elif call.name == "request_platform_liquidity":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                amount_usdt = Decimal(str(args.get("amount_to_borrow", 0)))
                                if amount_usdt <= 0:
                                    send_whatsapp("ERROR: Please specify a valid amount to borrow.")
                                    continue
                                
                                # AI Underwriting Logic (Collateralized by Data)
                                bs_data = business.get_balance_sheet()
                                pnl_data = business.get_pnl()
                                
                                total_assets = bs_data.get("assets", Decimal("0.00"))
                                net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                                
                                # Strict Lending Rule: Max 20% of Assets or 1x Net Profit
                                max_borrow = max(total_assets * Decimal("0.20"), net_profit)
                                
                                if amount_usdt > max_borrow:
                                    send_whatsapp(f"ERROR: LOAN DENIED\nBased on your IFRS ledger, your maximum approved liquidity advance is {max_borrow:,.2f} USDT.")
                                    continue
                                
                                if not business.wallet_address:
                                    send_whatsapp("ERROR: Business Web3 Treasury not configured.")
                                    continue
                                
                                node_url = getattr(settings, "NODE_LIQUIDITY_URL", "https://node-web3-server.onrender.com/request-liquidity")
                                response_node = requests.post(
                                    node_url,
                                    json={
                                        "wallet_address": business.wallet_address,
                                        "amount_usdt": float(amount_usdt),
                                        "network": network
                                    },
                                    timeout=60
                                )
                                response_node.raise_for_status()
                                data = response_node.json()
                                
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                kes_value = (amount_usdt * live_fx_rate).quantize(Decimal("0.01"))
                                
                                with db_transaction.atomic():
                                    # Ensure Liability Account Exists
                                    Account.objects.get_or_create(
                                        business=business, ifrs_account="short_term_borrowings",
                                        defaults={"name": "Short-Term Borrowings", "account_class": "LIABILITY", "balance": Decimal("0.00")}
                                    )
                                    loan_txn = Transaction.objects.create(
                                        business=business, date=date.today(),
                                        description=f"Platform Liquidity Advance ({amount_usdt} USDT @ {live_fx_rate} KES/USDT)",
                                        status=TransactionStatus.POSTED, blockchain_tx_hash=data.get("txHash")
                                    )
                                    loan_txn.post_transaction([
                                        {"ifrs_account": "cash_and_cash_equivalents", "type": "debit", "amount": kes_value},
                                        {"ifrs_account": "short_term_borrowings", "type": "credit", "amount": kes_value}
                                    ])
                                
                                send_whatsapp(f"LOAN APPROVED ON {network.upper()}\n{amount_usdt:,.2f} USDT disbursed to your treasury.\nHash: {data.get('txHash')}")
                            except Exception as e:
                                logger.error(f"AI Lending Error: {e}")
                                send_whatsapp(f"ERROR: Loan disbursement failed: {str(e)}")
                            continue

                        elif call.name == "settle_vendor_bill":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                doc = Document.objects.get(id=args["document_id"], business=business)
                                
                                if not business.wallet_address:
                                    send_whatsapp("❌ Business treasury address not configured.")
                                    continue
                                
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_settle_bill_intent(vendor_wallet=args["vendor_wallet"], amount=float(args["amount"]), currency="USDT", network=network)
                                
                                doc.unsigned_payload = intent
                                doc.save()
                                
                                usdt_amount = Decimal(str(args["amount"]))
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Settlement - {usdt_amount} USDT @ {live_fx_rate} KES/USDT to {args['vendor_wallet']}", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                send_whatsapp(f"PAYMENT QUEUED\nThe bill settlement for {usdt_amount} USDT is ready. Please sign the transaction locally via OpenClaw.")
                            except Document.DoesNotExist:
                                send_whatsapp(f"ERROR: Document #{args['document_id']} not found.")
                            except Exception as e:
                                logger.error(f"AI Settlement Error: {e}")
                                send_whatsapp("ERROR: Could not generate settlement intent.")
                            continue

                        elif call.name == "execute_micro_payroll":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                pnl_data = business.get_pnl()
                                net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                                if net_profit <= 0:
                                    send_whatsapp("ERROR: Cannot run payroll - Net profit is zero or negative.")
                                    continue
                                    
                                if not business.wallet_address:
                                    send_whatsapp("❌ Business treasury address not configured.")
                                    continue
                                    
                                employees = business.employee_wallets or []
                                if not employees:
                                    send_whatsapp("ERROR: No employees found. Add wallet addresses first.")
                                    continue
                                    
                                payroll_array = Web3Automation.get_payroll_distribution_strategy(employees, Decimal(str(net_profit)))
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_batch_payroll_intent(payroll_array, f"Autonomous Payroll - {date.today()}", network=network)
                                
                                total_payroll = sum([Decimal(str(emp.get("amount", 0))) for emp in payroll_array])
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                doc = Document.objects.create(
                                    business=business, document_type="payroll", date=date.today(), 
                                    total=total_payroll, unsigned_payload=intent, 
                                    raw_text="Payroll batch generated by AI. Awaiting local signature."
                                )
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Payroll ({len(employees)} employees, {total_payroll} USDT @ {live_fx_rate} KES/USDT)", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                send_whatsapp(f"PAYROLL QUEUED\n{len(employees)} employees calculated for {total_payroll:,.2f} USDT total. Please sign via OpenClaw.")
                            except Exception as e:
                                logger.error(f"AI Payroll Error: {e}")
                                send_whatsapp(f"ERROR: Payroll intent generation failed: {str(e)}")
                            continue

                        elif call.name == "optimize_treasury_yield":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                amount_to_deploy = Decimal(str(args.get("amount_to_deploy", 0)))
                                if amount_to_deploy <= 0:
                                    send_whatsapp("ERROR: Invalid amount.")
                                    continue
                                    
                                if not business.wallet_address:
                                    send_whatsapp("❌ Business treasury address not configured.")
                                    continue
                                    
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_yield_deployment_intent(float(amount_to_deploy), network=network)
                                
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                doc = Document.objects.create(
                                    business=business, document_type="journal_entry", date=date.today(), 
                                    total=amount_to_deploy, unsigned_payload=intent, 
                                    raw_text="Yield deployment intent generated. Awaiting local signature."
                                )
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Yield Deployment ({amount_to_deploy} USDT)", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                send_whatsapp(f"YIELD DEPLOYMENT QUEUED\n{amount_to_deploy:,.2f} USDT ready for yield pool. Please sign via OpenClaw.")
                            except Exception as e:
                                logger.error(f"AI Yield Error: {e}")
                                send_whatsapp(f"ERROR: Yield intent generation failed: {str(e)}")
                            continue

                        elif call.name == "distribute_dividends":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                total_dividend = Decimal(str(args.get("total_amount", 0)))
                                if total_dividend <= 0:
                                    send_whatsapp("ERROR: Please specify a valid dividend amount.")
                                    continue
                                    
                                if not business.wallet_address:
                                    send_whatsapp("❌ Business treasury address not configured.")
                                    continue
                                    
                                cap_table = business.get_cap_table()
                                valid_cap_table = [s for s in cap_table if s.get("wallet")]
                                if not valid_cap_table:
                                    send_whatsapp("ERROR: Shareholders found, but none have Web3 wallets configured.")
                                    continue
                                    
                                distribution_array = Web3Automation.calculate_dividend_distribution(valid_cap_table, total_dividend)
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_dividend_distribution_intent(distribution_array, f"Dividend Distribution - {date.today()}", network=network)
                                
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                doc = Document.objects.create(
                                    business=business, document_type="journal_entry", date=date.today(), 
                                    total=total_dividend, unsigned_payload=intent, 
                                    raw_text="Dividend intent generated. Awaiting local signature."
                                )
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Dividend Distribution ({total_dividend} USDT)", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                send_whatsapp(f"DIVIDENDS QUEUED\n{total_dividend:,.2f} USDT ready for {len(distribution_array)} shareholders. Please sign via OpenClaw.")
                            except Exception as e:
                                logger.error(f"AI Dividend Error: {e}")
                                send_whatsapp(f"ERROR: Dividend intent generation failed: {str(e)}")
                            continue

                        elif call.name == "fund_tax_escrow":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                amount_usdt = Decimal(str(args.get("tax_amount", 0)))
                                if amount_usdt <= 0:
                                    send_whatsapp("ERROR: Invalid tax amount specified.")
                                    continue
                                    
                                if not business.wallet_address:
                                    send_whatsapp("❌ Business treasury address not configured.")
                                    continue
                                    
                                agent = Web3Agent(business.wallet_address)
                                intent = agent.build_tax_escrow_intent(float(amount_usdt), network=network)
                                
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                
                                doc = Document.objects.create(
                                    business=business, document_type="tax_filing", date=date.today(), 
                                    total=amount_usdt, unsigned_payload=intent, 
                                    raw_text="Tax escrow intent generated. Awaiting local signature."
                                )
                                
                                with db_transaction.atomic():
                                    Transaction.objects.create(
                                        business=business, date=date.today(), 
                                        description=f"Pending Tax Escrow ({amount_usdt} USDT)", 
                                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                    )
                                    
                                send_whatsapp(f"TAX ESCROW QUEUED\n{amount_usdt:,.2f} USDT ready to be locked in vault. Please sign via OpenClaw.")
                            except Exception as e:
                                logger.error(f"AI Tax Escrow Error: {e}")
                                send_whatsapp(f"ERROR: Tax escrow intent generation failed: {str(e)}")
                            continue

                # Handle casual conversation when no tools are called
                elif response.text:
                    send_whatsapp(response.text)

                # Always return a 200 OK so Twilio knows the message was received
                return HttpResponse(status=200)

            except Exception as e:
                logger.error(f"WhatsApp Chat Failure: {e}")
                return HttpResponse(status=200)


# Web Chat Endpoint - Unified Multimodal Conduit
# Handles text, audio, and document uploads through a single API interface
import traceback

class WebChatView(APIView):
    permission_classes = [IsAuthenticated]

    def generate_tts_base64(self, text):
        try:
            clean_text = re.sub(r'[*#📊📈💰💼✅❌📌👁️]', '', text).strip()
            if not clean_text: return ""
            client = texttospeech.TextToSpeechClient()
            synthesis_input = texttospeech.SynthesisInput(text=clean_text)
            voice = texttospeech.VoiceSelectionParams(language_code="en-US", name="en-US-Journey-F")
            audio_config = texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3)
            response = client.synthesize_speech(input=synthesis_input, voice=voice, audio_config=audio_config)
            return base64.b64encode(response.audio_content).decode('utf-8')
        except Exception as e:
            logger.error(f"TTS Engine Failure: {e}")
            return ""

    def post(self, request):
        business = request.user.business_profile
        incoming_msg = request.data.get('message', '').strip()
        audio_data_b64 = request.data.get('audio_data')
        image_data_b64 = request.data.get('image_data') 
        pending_action = request.data.get('pending_document_action') 

        client = _get_vertex_client()
        if not client:
            return Response({"error": "AI Engine unavailable."}, status=500)
        biz_name = business.business_name or request.user.username or "your company"

        from django.db.models import Q
        pending = Document.objects.filter(business=business).filter(
            Q(document_type="unknown") | 
            Q(ai_detected_type__isnull=False) & ~Q(document_type=models.F('ai_detected_type')) 
        ).order_by('-created_at').first()
        
        doc_context = ""
        if pending:
            override_note = ""
            if pending.ai_detected_type and pending.ai_detected_type != pending.document_type:
                override_note = f" (AI said {pending.ai_detected_type}, but overridden to {pending.document_type})"
            pending_entity = pending.vendor or pending.customer or pending.loan_lender or pending.equity_investor or pending.billed_to or "Unknown"
            doc_context = f"CONTEXT: Document #{pending.id} for KSH {pending.total} from {pending_entity} is currently HALTED for your review{override_note}."

        # Scenario A: Document Upload via Chat
        # Processes document images or PDFs sent through the web interface
        if image_data_b64:
            try:
                # Dynamic MIME Type Detection for Web UI Uploads
                # Intelligently identifies document type from uploaded files
                if ',' in image_data_b64:
                    header, encoded_data = image_data_b64.split(',', 1)
                    mime_type = header.replace('data:', '').split(';')[0]
                    image_bytes = base64.b64decode(encoded_data)
                else:
                    image_bytes = base64.b64decode(image_data_b64)
                    mime_type = 'application/pdf' # Default fallback for uploads
                    
                valid_mimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
                if mime_type not in valid_mimes: 
                    mime_type = 'application/pdf'

                visual_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
                
                dynamic_extraction_prompt = (
                    f"Extract transaction details strictly matching the JSON schema. "
                    f"IDENTITY: You are the AI CFO for '{biz_name}'. "
                    f"AGENT NARRATION: Write a brief, professional 1-2 sentence first-person monologue in the 'agent_narration' field describing what you see. "
                    f"MANDATORY extraction: You MUST find and extract the recipient name into the 'billed_to' or 'customer' field. "
                    f"CLASSIFICATION LOGIC (CRITICAL):\n"
                    f"  1. IGNORE document text labels like 'INVOICE' or 'BILL'.\n"
                    f"  2. If '{biz_name}' is the SELLER (money incoming) → 'invoice'.\n"
                    f"  3. If '{biz_name}' is the BUYER of Services/Consumables/Rent → 'bill'.\n"
                    f"  4. If '{biz_name}' is the BUYER of Hardware/Laptops/Servers/Furniture → 'asset_purchase'.\n"
                    f"  5. If the document acknowledges incoming investment money → 'equity_injection'."
                )
                
                pro_response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[dynamic_extraction_prompt, visual_part],
                    config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=AgenticPayload, temperature=0.0)
                )
                payload = AgenticPayload.model_validate_json(pro_response.text)
                
                formatted_total = Decimal(str(payload.total or "0.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                if Document.objects.filter(business=business, date=payload.date, total=formatted_total, vendor=payload.vendor).exists():
                    return Response({"reply": "⚠️ Duplicate blocked. This document is already in the ledger.", "audio_base64": self.generate_tts_base64("Halt. This document is a duplicate.")})

                document = ingest_agentic_payload(business, payload)

                if payload.requires_human_review:
                    reply = f"🚨 *REVIEW NEEDED*\n\nType: {payload.document_type.value.replace('_', ' ').title()}\nTotal: KSH {payload.total:,.2f}\nReason: {payload.human_review_reason}"
                    audio = self.generate_tts_base64(f"I have extracted the document, but I must halt. {payload.human_review_reason}")
                    return Response({"reply": reply, "pending_document": document.id, "audio_base64": audio})
                
                txn = document.transactions.first() if document.transactions.exists() else None
                decision = "\nLEDGER ENTRIES\n"
                if txn and txn.entries.exists():
                    for entry in txn.entries.filter(entry_type="debit"): decision += f"[DEBIT] {entry.account.ifrs_account}: KSH {entry.amount:,.2f}\n"
                    for entry in txn.entries.filter(entry_type="credit"): decision += f"[CREDIT] {entry.account.ifrs_account}: KSH {entry.amount:,.2f}\n"
                
                bs_data = business.get_balance_sheet()
                position = f"\nBALANCE SHEET IMPACT\nAssets: KSH {bs_data.get('assets', Decimal('0.00')):,.2f}\nLiabilities: KSH {bs_data.get('liabilities', Decimal('0.00')):,.2f}\nEquity: KSH {bs_data.get('equity', Decimal('0.00')):,.2f}"
                
                reply = f"DOCUMENT POSTED\nID #{document.id} ({document.document_type.replace('_', ' ').title()}) from {document.vendor or 'Unknown'}\nTotal: KSH {document.total:,.2f}\n\n{decision}{position}"
                audio = self.generate_tts_base64("The document has been extracted, validated, and posted to the ledger securely.")
                return Response({"reply": reply, "audio_base64": audio})
            except Exception as e:
                logger.error(f"Chat Extraction Failed: {e}")
                return Response({"reply": "ERROR: Failed to extract document data.", "audio_base64": self.generate_tts_base64("I could not read that document.")})

        # Scenario B: Action on Pending Document (Button Clicks)
        # Approve or reject document awaiting user decision
        if pending_action and pending:
            action = pending_action.upper()
            if action == "POST":
                provided_type = request.data.get("document_type")
                detected_type = provided_type or pending.ai_detected_type or "bill"
                pending.document_type = detected_type
                pending.save()
                pending.post_transaction()
                reply_text = f"DOCUMENT POSTED\nID #{pending.id} has been formally approved and written to the ledger."
                audio_b64 = self.generate_tts_base64("Understood. The pending document is now officially posted to the ledger.")
                return Response({"reply": reply_text, "pending_document": None, "audio_base64": audio_b64})

            elif action == "REVOKE":
                pending_id = pending.id
                pending.delete()
                return Response({"reply": f"Document #{pending_id} securely discarded.", "pending_document": None, "audio_base64": self.generate_tts_base64("Got it. The document has been securely discarded.")})

        if not incoming_msg and not audio_data_b64:
            return Response({"reply": "Hi! Ask me about your finances, upload a document, or tell me to look at your screen."})

        # Scenario C: Tools and Voice Command Logic
        # Process user intents and route to appropriate financial tools
        valid_accs = ", ".join([a[0] for a in IFRS_ACCOUNTS])
        valid_expenses = [e.value for e in ExpenseCategory]
        valid_assets = [a.value for a in AssetClass]
        
        intent_schema = {
            "type": "OBJECT",
            "properties": {"user_intent": {"type": "STRING", "description": "Summarize the user's request. If they are speaking, transcribe their exact question."}},
            "required": ["user_intent"]
        }
        
        agent_tools = types.Tool(
            function_declarations=[
                types.FunctionDeclaration(name="get_balance_sheet", description="Retrieve the Balance Sheet as of today.", parameters=intent_schema),
                types.FunctionDeclaration(name="get_pnl_statement", description="Retrieve the Income Statement for the current period.", parameters=intent_schema),
                types.FunctionDeclaration(name="get_cash_flow_statement", description="Retrieve the Statement of Cash Flows.", parameters=intent_schema),
                types.FunctionDeclaration(name="get_recent_transactions", description="Retrieve the latest 5 transactions.", parameters=intent_schema),
                types.FunctionDeclaration(name="activate_vision", description="Activate the LiveStream UI Navigator. Call this IF AND ONLY IF the user says 'look at my screen', 'record screen', or 'start UI navigator'.", parameters=intent_schema),
                types.FunctionDeclaration(
                    name="analyze_financial_health", 
                    description="Fetch a complete summary of P&L, Cash Flow, and Assets. Call this IMMEDIATELY for ALL strategic questions like 'can we afford a new hire', 'how is the business doing', or 'give me an overview'.", 
                    parameters=intent_schema
                ),
                types.FunctionDeclaration(
                    name="get_account_balance", description="Get the current balance of a specific account.", 
                    parameters={"type": "OBJECT", "properties": {"account_code": {"type": "STRING", "description": f"IFRS code from: {valid_accs}"}, "user_intent": {"type": "STRING"}}, "required": ["account_code", "user_intent"]}
                ),
                types.FunctionDeclaration(
                    name="post_manual_adjustment", description="Post a double-entry manual adjustment to the ledger.",
                    parameters={
                        "type": "OBJECT",
                        "properties": {
                            "debit_account": {"type": "STRING", "description": f"Exact IFRS code from: {valid_accs}"},
                            "credit_account": {"type": "STRING", "description": f"Exact IFRS code from: {valid_accs}"},
                            "amount": {"type": "NUMBER"},
                            "description": {"type": "STRING", "description": "Extract the exact reason or intent the user provided for this adjustment."}
                        },
                        "required": ["debit_account", "credit_account", "amount", "description"]
                    }
                ),
                types.FunctionDeclaration(
                    name="resolve_pending_document",
                    description="Approve (post) or Reject (revoke/discard) the currently halted document.",
                    parameters={
                        "type": "OBJECT",
                        "properties": {
                            "action": {"type": "STRING", "description": "'POST' to approve/proceed, 'REVOKE' to discard/reverse"},
                            "document_type": {"type": "STRING", "description": "Optional document type."},
                            "expense_category": {"type": "STRING", "description": f"Only if bill. MUST be exact: {', '.join(valid_expenses)}"},
                            "asset_class": {"type": "STRING", "description": f"Only if asset_purchase. MUST be exact: {', '.join(valid_assets)}"},
                            "user_intent": {"type": "STRING"}
                        },
                        "required": ["action", "user_intent"]
                    }
                ),
                types.FunctionDeclaration(
                    name="request_platform_liquidity",
                    description="Request a short-term USDT loan/liquidity advance from the DeFi protocol based on ledger health. Call this if the user asks for a loan, advance, or to borrow money.",
                    parameters={
                        "type": "OBJECT",
                        "properties": {
                            "amount_to_borrow": {
                                "type": "NUMBER", 
                                "description": "Amount of USDT to borrow."
                            },
                            "network": {
                                "type": "STRING", 
                                "description": "The blockchain network to use. Default is 'celo-sepolia'."
                            },
                            "user_intent": {
                                "type": "STRING"
                            }
                        },
                        "required": ["amount_to_borrow", "user_intent"]
                    }
                ),
                types.FunctionDeclaration(
                    name="settle_vendor_bill",
                    description="Prepare and queue a vendor bill payment for the user to securely sign locally via OpenClaw.",
                    parameters={
                        "type": "OBJECT",
                        "properties": {
                            "document_id": {"type": "NUMBER", "description": "The ID of the bill to pay."},
                            "amount": {"type": "NUMBER", "description": "Amount to pay."},
                            "vendor_wallet": {"type": "STRING", "description": "Web3 address of vendor."},
                            "network": {
                                "type": "STRING", 
                                "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'ethereum-sepolia'."
                                }
                        },
                        "required": ["document_id", "amount", "vendor_wallet"]
                    }
                ),
                types.FunctionDeclaration(
                    name="execute_micro_payroll",
                    description="Calculate and queue a batch payroll transaction for the user to securely sign locally via OpenClaw.",
                    parameters={
                        "type": "OBJECT",
                        "properties": {
                            "confirm": {"type": "BOOLEAN"},
                            "network": {
                                "type": "STRING",
                                "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'ethereum-sepolia'."
                            }
                        },
                        "required": ["confirm"]
                    }
                ),
                types.FunctionDeclaration(
                    name="optimize_treasury_yield",
                    description="Prepare a transaction to deploy excess cash into DeFi protocols, queuing it for the user to sign locally.",
                    parameters={
                        "type": "OBJECT",
                        "properties": {
                            "amount_to_deploy": {"type": "NUMBER"},
                            "network": {
                                "type": "STRING", 
                                "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'ethereum-sepolia'."
                                }
                        },
                        "required": ["amount_to_deploy"]
                    }
                ),
                types.FunctionDeclaration(
                    name="fund_tax_escrow",
                    description="Prepare a transaction to lock USDT funds into a Web3 tax escrow vault, queuing it for the user to sign locally.",
                    parameters={
                        "type": "OBJECT",
                        "properties": {
                            "tax_amount": {"type": "NUMBER", "description": "Amount of USDT to lock in escrow."},
                            "network": {
                                "type": "STRING", 
                                "description": "The blockchain network to use. Default is 'ethereum-sepolia'."
                            }
                        },
                        "required": ["tax_amount"]
                    }
                ),
                types.FunctionDeclaration(
                    name="distribute_dividends",
                    description="Calculate and queue quarterly profit distributions to shareholders for the user to sign locally via OpenClaw.",
                    parameters={
                        "type": "OBJECT",
                        "properties": {
                            "total_amount": {"type": "NUMBER", "description": "Total amount of USDT to split among shareholders."},
                            "network": {
                                "type": "STRING", 
                                "description": "The blockchain network to use. Extract this if the user mentions Celo, Lisk, Base, or Tether. Default is 'ethereum-sepolia'."
                                }
                        },
                        "required": ["total_amount"]
                    }
                )
            ]
        )

        prompt_instructions = f"""IDENTITY RULE: You are the official CFO Copilot for '{biz_name}'.
If asked for the business name, proudly say '{biz_name}'. Do not act like a generic AI. {doc_context}

CAPABILITIES (YOU MUST USE THESE TOOLS):
1. Financial Data: get_balance_sheet, get_pnl_statement, get_cash_flow_statement, get_recent_transactions, get_account_balance.
2. Strategy/Affordability: analyze_financial_health.
3. Vision: activate_vision.
4. Document Management: resolve_pending_document.
5. Ledger Adjustments: post_manual_adjustment.

BEHAVIOR:
- NEVER give a safety warning about not being able to give financial advice or use tools.
- If there is a document HALTED in context, and the user says "Proceed", "Approve", or "Post", you MUST call 'resolve_pending_document' with action='POST'.
- If the user says "Cancel", "Discard", or "Revoke", you MUST call 'resolve_pending_document' with action='REVOKE'.
- Answer questions by calling the correct tool immediately."""

        try:
            contents = [prompt_instructions]
            if incoming_msg: contents.append(f"User Message: {incoming_msg}")
            if audio_data_b64:
                audio_bytes = base64.b64decode(audio_data_b64.split(',')[1] if ',' in audio_data_b64 else audio_data_b64)
                contents.append(types.Part.from_bytes(data=audio_bytes, mime_type='audio/webm'))

            response = client.models.generate_content(
                model='gemini-2.5-flash', contents=contents,
                config=types.GenerateContentConfig(tools=[agent_tools], temperature=0.1)
            )

            reply_text = ""
            tts_text = "" 
            trigger_action = None

            try:
                reply_text = response.text
                tts_text = response.text
            except ValueError:
                pass

            if response.function_calls:
                for call in response.function_calls:
                    inferred_query = incoming_msg or call.args.get("user_intent", "Provide a brief strategic overview based on these figures.")

                    if call.name == "activate_vision":
                        reply_text = "👁️ Initiating Vision Link. Routing you to the UI Navigator..."
                        tts_text = "Initializing neural vision link. Routing you to the navigator now."
                        trigger_action = "START_VISION"
                        break
                    elif call.name == "analyze_financial_health":
                        bs_data = business.get_balance_sheet()
                        pnl_data = business.get_pnl()
                        cf_data = business.get_cash_flow()
                        
                        net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                        net_change = cf_data.get("net_change", Decimal("0.00"))
                        total_assets = bs_data.get("assets", Decimal("0.00"))
                        
                        insight = generate_cfo_insight(client, biz_name, inferred_query, f"Net Profit: {net_profit}, Net Cash Flow: {net_change}, Total Assets: {total_assets}")
                        tts_text = insight
                        reply_text = f"{insight}\n\n📈 FINANCIAL OVERVIEW\nNet Profit: KSH {net_profit:,.2f}\nNet Cash Flow: KSH {net_change:,.2f}\nTotal Assets: KSH {total_assets:,.2f}"
                        break
                    elif call.name == "get_balance_sheet":
                        bs_data = business.get_balance_sheet()
                        insight = generate_cfo_insight(client, biz_name, inferred_query, f"Assets: {bs_data.get('assets')}, Liabilities: {bs_data.get('liabilities')}, Equity: {bs_data.get('equity')}")
                        tts_text, reply_text = insight, f"{insight}\n\nBALANCE SHEET\nAssets: KSH {bs_data.get('assets'):,.2f}\nLiabilities: KSH {bs_data.get('liabilities'):,.2f}\nEquity: KSH {bs_data.get('equity'):,.2f}"
                        break
                    elif call.name == "get_pnl_statement":
                        pnl_data = business.get_pnl()
                        net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                        insight = generate_cfo_insight(client, biz_name, inferred_query, f"Net Profit: {net_profit}")
                        tts_text, reply_text = insight, f"{insight}\n\n📈 PROFIT & LOSS\nNet Profit: KSH {net_profit:,.2f}"
                        break
                    elif call.name == "get_cash_flow_statement":
                        cf_data = business.get_cash_flow()
                        operating = cf_data.get("operating", Decimal("0.00"))
                        investing = cf_data.get("investing", Decimal("0.00"))
                        financing = cf_data.get("financing", Decimal("0.00"))
                        net_change = cf_data.get("net_change", Decimal("0.00"))
                        insight = generate_cfo_insight(client, biz_name, inferred_query, f"Operating: {operating}, Investing: {investing}, Financing: {financing}, Net Change: {net_change}")
                        tts_text, reply_text = insight, f"{insight}\n\n💰 CASH FLOW\nOperating: KSH {operating:,.2f}\nInvesting: KSH {investing:,.2f}\nFinancing: KSH {financing:,.2f}\nNet Change: KSH {net_change:,.2f}"
                        break
                    elif call.name == "get_recent_transactions":
                        txns = Transaction.objects.filter(business=business, status=TransactionStatus.POSTED).order_by('-date')[:5]
                        if txns.exists():
                            total_posted = sum([t.entries.filter(entry_type="debit").first().amount for t in txns if t.entries.filter(entry_type="debit").exists()])
                            insight = generate_cfo_insight(client, biz_name, inferred_query, f"Showing last 5 transactions totaling KSH {total_posted}.")
                            tts_text = insight
                            reply_text = f"{insight}\n\n📋 RECENT TRANSACTIONS (Last 5)\n\n"
                            for txn in txns:
                                amount = txn.entries.filter(entry_type="debit").first()
                                if amount:
                                    reply_text += f"• {txn.date}: {txn.description}\n  KSH {amount.amount:,.2f}\n\n"
                        else:
                            reply_text = tts_text = "📭 No transactions posted yet."
                        break
                    elif call.name == "get_account_balance":
                        account_code = call.args.get("account_code")
                        account = Account.objects.filter(business=business, ifrs_account=account_code).first()
                        if account:
                            insight = generate_cfo_insight(client, biz_name, inferred_query, f"Account {account.name} has a balance of KSH {account.balance}.")
                            tts_text, reply_text = insight, f"{insight}\n\nAccount: {account.name.upper()}\nAccount Code: {account.ifrs_account}\nBalance: KSH {account.balance:,.2f}"
                        else:
                            reply_text = tts_text = f"ERROR: Account '{account_code}' not found."
                        break
                    elif call.name == "resolve_pending_document":
                        if not pending:
                            reply_text = "ERROR: No pending document found."
                            tts_text = "I do not see any pending documents to resolve."
                            break
                        
                        action = call.args["action"].upper()
                        if action == "POST":
                            provided_type = call.args.get("document_type")
                            detected_type = provided_type or pending.ai_detected_type or "bill"
                            pending.document_type = detected_type
                            
                            if call.args.get("expense_category") in valid_expenses: 
                                pending.expense_category = call.args.get("expense_category")
                            elif pending.document_type == "bill":
                                pending.expense_category = ExpenseCategory.OPERATING_EXPENSES.value

                            if call.args.get("asset_class") in valid_assets: 
                                pending.asset_class = call.args.get("asset_class")
                            elif pending.document_type == "asset_purchase":
                                pending.asset_class = AssetClass.PROPERTY_PLANT_EQUIPMENT.value
                                
                            pending.save()
                            pending.post_transaction()
                            
                            try:
                                txn = pending.transactions.first() if pending.transactions.exists() else None
                                audit_trace = f"📌 AUDIT TRACE\n"
                                if pending.ai_detected_type and pending.ai_detected_type != detected_type:
                                    audit_trace += f"• System Override: {pending.ai_detected_type} → {detected_type}\n"
                                elif pending.ai_detected_type:
                                    audit_trace += f"• AI Detected: {pending.ai_detected_type}\n"
                                
                                decision = f"\nLEDGER ENTRIES\n"
                                if txn and txn.entries.exists():
                                    for entry in txn.entries.filter(entry_type="debit"):
                                        decision += f"[DEBIT] {entry.account.ifrs_account}: KSH {entry.amount:,.2f}\n"
                                    for entry in txn.entries.filter(entry_type="credit"):
                                        decision += f"[CREDIT] {entry.account.ifrs_account}: KSH {entry.amount:,.2f}\n"
                                
                                bs_data = business.get_balance_sheet()
                                position = f"\nBALANCE SHEET IMPACT\nAssets: KSH {bs_data.get('assets', Decimal('0.00')):,.2f}\nLiabilities: KSH {bs_data.get('liabilities', Decimal('0.00')):,.2f}\nEquity: KSH {bs_data.get('equity', Decimal('0.00')):,.2f}"
                                
                                entity_name = pending.vendor or pending.customer or pending.billed_to or "Unknown"
                                reply_text = f"DOCUMENT POSTED\nID #{pending.id} ({pending.document_type.replace('_', ' ').title()}) from {entity_name}\nTotal: KSH {pending.total:,.2f}\n\n{audit_trace}{decision}{position}"
                                tts_text = f"Understood. The document from {entity_name} is now officially posted to the ledger."
                            except Exception as e:
                                logger.error(f"Audit message construction failed: {e}")
                                reply_text = f"Document #{pending.id} has been successfully posted to the ledger."
                                tts_text = "The document is posted."
                        
                        elif action == "REVOKE":
                            pending_id = pending.id
                            pending.delete()
                            reply_text = f"Document #{pending_id} has been securely discarded."
                            tts_text = "Got it. The document has been securely discarded."
                        break

                    elif call.name == "post_manual_adjustment":
                        args = call.args
                        debit_acc = Account.objects.filter(business=business, ifrs_account=args["debit_account"]).first()
                        credit_acc = Account.objects.filter(business=business, ifrs_account=args["credit_account"]).first()
                        if debit_acc and credit_acc:
                            with db_transaction.atomic():
                                audit_desc = args.get("description", "Manual Adjustment via Web Chat")
                                
                                txn = Transaction.objects.create(
                                    business=business, 
                                    description=audit_desc,
                                    is_manual_adjustment=True, 
                                    status=TransactionStatus.POSTED
                                )
                                txn.post_transaction([
                                    {"ifrs_account": debit_acc.ifrs_account, "type": "debit", "amount": args["amount"]}, 
                                    {"ifrs_account": credit_acc.ifrs_account, "type": "credit", "amount": args["amount"]}
                                ])
                            reply_text = f"COMPLETED: Posted KSH {args['amount']} to {debit_acc.name}.\"
                            tts_text = f"Done. Posted adjustment to {debit_acc.name}."
                        break

                    elif call.name == "request_platform_liquidity":
                            args = call.args or {}
                            network = args.get("network", business.primary_network)
                            try:
                                amount_usdt = Decimal(str(args.get("amount_to_borrow", 0)))
                                if amount_usdt <= 0:
                                    reply_text = tts_text = "Please specify a valid amount to borrow."
                                    break
                                
                                # AI Underwriting Logic
                                bs_data = business.get_balance_sheet()
                                pnl_data = business.get_pnl()
                                
                                total_assets = bs_data.get("assets", Decimal("0.00"))
                                net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                                
                                max_borrow = max(total_assets * Decimal("0.20"), net_profit)
                                
                                if amount_usdt > max_borrow:
                                    reply_text = f"ERROR: LOAN DENIED\nBased on your IFRS ledger, your maximum approved liquidity advance is {max_borrow:,.2f} USDT."
                                    tts_text = f"Loan denied. Based on your current assets and profit, your maximum borrowing limit is {max_borrow:,.2f} USDT."
                                    break
                                
                                if not business.wallet_address:
                                    reply_text = tts_text = "Business Web3 Treasury not configured."
                                    break
                                
                                node_url = getattr(settings, "NODE_LIQUIDITY_URL", "https://node-web3-server.onrender.com/request-liquidity")
                                response_node = requests.post(
                                    node_url,
                                    json={
                                        "wallet_address": business.wallet_address,
                                        "amount_usdt": float(amount_usdt),
                                        "network": network
                                    },
                                    timeout=60
                                )
                                response_node.raise_for_status()
                                data = response_node.json()
                                
                                live_fx_rate = get_realtime_usdt_kes_rate()
                                kes_value = (amount_usdt * live_fx_rate).quantize(Decimal("0.01"))
                                
                                with db_transaction.atomic():
                                    Account.objects.get_or_create(
                                        business=business, ifrs_account="short_term_borrowings",
                                        defaults={"name": "Short-Term Borrowings", "account_class": "LIABILITY", "balance": Decimal("0.00")}
                                    )
                                    loan_txn = Transaction.objects.create(
                                        business=business, date=date.today(),
                                        description=f"Platform Liquidity Advance ({amount_usdt} USDT @ {live_fx_rate} KES/USDT)",
                                        status=TransactionStatus.POSTED, blockchain_tx_hash=data.get("txHash")
                                    )
                                    loan_txn.post_transaction([
                                        {"ifrs_account": "cash_and_cash_equivalents", "type": "debit", "amount": kes_value},
                                        {"ifrs_account": "short_term_borrowings", "type": "credit", "amount": kes_value}
                                    ])
                                
                                reply_text = f"LOAN APPROVED ON {network.upper()}\n{amount_usdt:,.2f} USDT disbursed to treasury.\nHash: {data.get('txHash')}"
                                tts_text = f"Your loan application was approved based on your ledger health. {amount_usdt} USDT has been disbursed to your Web3 treasury."
                            except Exception as e:
                                logger.error(f"AI Lending Error: {e}")
                                reply_text = tts_text = "Loan disbursement failed."
                            break

                    elif call.name == "settle_vendor_bill":
                        args = call.args or {}
                        network = args.get("network", business.primary_network)
                        try:
                            doc = Document.objects.get(id=args["document_id"], business=business)
                            if not business.wallet_address:
                                reply_text = tts_text = "Business treasury address not configured."
                                break
                            
                            agent = Web3Agent(business.wallet_address)
                            intent = agent.build_settle_bill_intent(vendor_wallet=args["vendor_wallet"], amount=float(args["amount"]), currency="USDT", network=network)
                            
                            doc.unsigned_payload = intent
                            doc.save()
                            
                            usdt_amount = Decimal(str(args["amount"]))
                            live_fx_rate = get_realtime_usdt_kes_rate()
                            
                            with db_transaction.atomic():
                                Transaction.objects.create(
                                    business=business, date=date.today(), 
                                    description=f"Pending Settlement - {usdt_amount} USDT @ {live_fx_rate} KES/USDT to {args['vendor_wallet']}", 
                                    status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                )
                                
                            reply_text = f"PAYMENT QUEUED\nThe bill settlement for {usdt_amount} USDT is ready. Please sign the transaction locally via OpenClaw."
                            tts_text = f"The bill settlement has been queued for your local signature."
                        except Document.DoesNotExist:
                            reply_text = tts_text = f"Document not found."
                        except Exception as e:
                            logger.error(f"AI Settlement Error: {e}")
                            reply_text = tts_text = "Error generating settlement intent."
                        break

                    elif call.name == "execute_micro_payroll":
                        args = call.args or {}
                        network = args.get("network", business.primary_network)
                        try:
                            pnl_data = business.get_pnl()
                            net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                            if net_profit <= 0:
                                reply_text = tts_text = "Cannot run payroll: No profit."
                                break
                            
                            if not business.wallet_address:
                                reply_text = tts_text = "Business treasury address not configured."
                                break
                                
                            employees = business.employee_wallets or []
                            if not employees:
                                reply_text = tts_text = "No employees found. Add wallet addresses first."
                                break
                                
                            payroll_array = Web3Automation.get_payroll_distribution_strategy(employees, Decimal(str(net_profit)))
                            agent = Web3Agent(business.wallet_address)
                            intent = agent.build_batch_payroll_intent(payroll_array, f"Autonomous Payroll - {date.today()}", network=network)
                            
                            total_payroll = sum([Decimal(str(emp.get("amount", 0))) for emp in payroll_array])
                            live_fx_rate = get_realtime_usdt_kes_rate()
                            
                            doc = Document.objects.create(
                                business=business, document_type="payroll", date=date.today(), 
                                total=total_payroll, unsigned_payload=intent, 
                                raw_text="Payroll batch generated by AI. Awaiting local signature."
                            )
                            
                            with db_transaction.atomic():
                                Transaction.objects.create(
                                    business=business, date=date.today(), 
                                    description=f"Pending Payroll ({len(employees)} employees, {total_payroll} USDT @ {live_fx_rate} KES/USDT)", 
                                    status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                )
                                
                            reply_text = f"PAYROLL QUEUED\n{len(employees)} employees calculated for {total_payroll:,.2f} USDT total. Please sign via OpenClaw."
                            tts_text = f"Payroll queued for {len(employees)} employees."
                        except Exception as e:
                            logger.error(f"AI Payroll Error: {e}")
                            reply_text = tts_text = "Payroll intent generation failed."
                        break

                    elif call.name == "optimize_treasury_yield":
                        args = call.args or {}
                        network = args.get("network", business.primary_network)
                        try:
                            amount_to_deploy = Decimal(str(args.get("amount_to_deploy", 0)))
                            if amount_to_deploy <= 0:
                                reply_text = tts_text = "Invalid amount."
                                break
                                
                            if not business.wallet_address:
                                reply_text = tts_text = "Business treasury address not configured."
                                break
                                
                            agent = Web3Agent(business.wallet_address)
                            intent = agent.build_yield_deployment_intent(float(amount_to_deploy), network=network)
                            
                            live_fx_rate = get_realtime_usdt_kes_rate()
                            
                            doc = Document.objects.create(
                                business=business, document_type="journal_entry", date=date.today(), 
                                total=amount_to_deploy, unsigned_payload=intent, 
                                raw_text="Yield deployment intent generated. Awaiting local signature."
                            )
                            
                            with db_transaction.atomic():
                                Transaction.objects.create(
                                    business=business, date=date.today(), 
                                    description=f"Pending Yield Deployment ({amount_to_deploy} USDT)", 
                                    status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                )
                                
                            reply_text = f"YIELD DEPLOYMENT QUEUED\n{amount_to_deploy:,.2f} USDT ready for yield pool. Please sign via OpenClaw."
                            tts_text = f"Yield deployment queued for your signature."
                        except Exception as e:
                            logger.error(f"AI Yield Error: {e}")
                            reply_text = tts_text = "Yield intent generation failed."
                        break

                    elif call.name == "distribute_dividends":
                        args = call.args or {}
                        network = args.get("network", business.primary_network)
                        try:
                            total_dividend = Decimal(str(args.get("total_amount", 0)))
                            if total_dividend <= 0:
                                reply_text = tts_text = "Please specify a valid dividend amount."
                                break
                                
                            if not business.wallet_address:
                                reply_text = tts_text = "Business treasury address not configured."
                                break
                                
                            cap_table = business.get_cap_table()
                            valid_cap_table = [s for s in cap_table if s.get("wallet")]
                            if not valid_cap_table:
                                reply_text = tts_text = "Shareholders exist on the ledger, but none have Web3 wallets configured."
                                break
                                
                            distribution_array = Web3Automation.calculate_dividend_distribution(valid_cap_table, total_dividend)
                            agent = Web3Agent(business.wallet_address)
                            intent = agent.build_dividend_distribution_intent(distribution_array, f"Dividend Distribution - {date.today()}", network=network)
                            
                            live_fx_rate = get_realtime_usdt_kes_rate()
                            
                            doc = Document.objects.create(
                                business=business, document_type="journal_entry", date=date.today(), 
                                total=total_dividend, unsigned_payload=intent, 
                                raw_text="Dividend intent generated. Awaiting local signature."
                            )
                            
                            with db_transaction.atomic():
                                Transaction.objects.create(
                                    business=business, date=date.today(), 
                                    description=f"Pending Dividend Distribution ({total_dividend} USDT)", 
                                    status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                )
                                
                            reply_text = f"DIVIDENDS QUEUED\n{total_dividend:,.2f} USDT ready for {len(distribution_array)} shareholders. Please sign via OpenClaw."
                            tts_text = f"Dividend distribution queued."
                        except Exception as e:
                            logger.error(f"AI Dividend Error: {e}")
                            reply_text = tts_text = "Dividend intent generation failed."
                        break

                    elif call.name == "fund_tax_escrow":
                        args = call.args or {}
                        network = args.get("network", business.primary_network)
                        try:
                            amount_usdt = Decimal(str(args.get("tax_amount", 0)))
                            if amount_usdt <= 0:
                                reply_text = tts_text = "Invalid tax amount specified."
                                break
                                
                            if not business.wallet_address:
                                reply_text = tts_text = "Business treasury address not configured."
                                break
                                
                            agent = Web3Agent(business.wallet_address)
                            intent = agent.build_tax_escrow_intent(float(amount_usdt), network=network)
                            
                            live_fx_rate = get_realtime_usdt_kes_rate()
                            
                            doc = Document.objects.create(
                                business=business, document_type="tax_filing", date=date.today(), 
                                total=amount_usdt, unsigned_payload=intent, 
                                raw_text="Tax escrow intent generated. Awaiting local signature."
                            )
                            
                            with db_transaction.atomic():
                                Transaction.objects.create(
                                    business=business, date=date.today(), 
                                    description=f"Pending Tax Escrow ({amount_usdt} USDT)", 
                                    status=TransactionStatus.PENDING_SIGNATURE, document=doc
                                )
                                
                            reply_text = f"TAX ESCROW QUEUED\n{amount_usdt:,.2f} USDT ready to be locked in vault. Please sign via OpenClaw."
                            tts_text = f"Tax escrow funding queued for your signature."
                        except Exception as e:
                            logger.error(f"AI Tax Escrow Error: {e}")
                            reply_text = tts_text = "Tax escrow intent generation failed."
                        break
            
            if not reply_text and not response.function_calls:
                logger.warning("Gemini silent safety failure detected. Forcing strategic override.")
                bs_data = business.get_balance_sheet()
                pnl_data = business.get_pnl()
                cf_data = business.get_cash_flow()
                
                net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                net_change = cf_data.get("net_change", Decimal("0.00"))
                total_assets = bs_data.get("assets", Decimal("0.00"))
                
                insight = generate_cfo_insight(client, biz_name, incoming_msg or "Give me a strategic overview.", f"Net Profit: {net_profit}, Net Cash Flow: {net_change}, Total Assets: {total_assets}")
                tts_text = insight
                reply_text = f"{insight}\n\n📈 FINANCIAL OVERVIEW\nNet Profit: KSH {net_profit:,.2f}\nNet Cash Flow: KSH {net_change:,.2f}\nTotal Assets: KSH {total_assets:,.2f}"

            if not reply_text:
                reply_text = tts_text = "I processed your request. How else can I help?"

            return Response({
                "reply": reply_text,
                "pending_document": pending.id if pending else None,
                "audio_base64": self.generate_tts_base64(tts_text),
                "trigger_action": trigger_action
            })

        except Exception as e:
            logger.error(f"Web Chat Failure: {e}\n{traceback.format_exc()}")
            return Response({"reply": "❌ Chat failed.", "audio_base64": self.generate_tts_base64("System error.")}, status=500)

            return Response({
                "reply": reply_text,
                "pending_document": pending.id if pending else None,
                "audio_base64": self.generate_tts_base64(tts_text),
                "trigger_action": trigger_action
            })

        except Exception as e:
            logger.error(f"Web Chat Failure: {e}\n{traceback.format_exc()}")
            return Response({"reply": "❌ Chat failed.", "audio_base64": self.generate_tts_base64("System error.")}, status=500)

            
class AccountViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = AccountSerializer

    def get_queryset(self):
        return Account.objects.filter(business__user=self.request.user)


# General Ledger and Financial Period Management
# Handles journal entries, financial periods, and period closures

class JournalEntryListView(APIView):
    """Provides a flat, chronological General Ledger view."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        entries = JournalEntry.objects.filter(
            transaction__business__user=request.user
        ).order_by('-transaction__date', '-id')
        
        serializer = JournalEntrySerializer(entries, many=True)
        return Response(serializer.data)


class FinancialPeriodListView(APIView):
    """Lists all financial periods for the business."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business_profile
        periods = FinancialPeriod.objects.filter(business=business).order_by('-start_date')
        
        serializer = FinancialPeriodSerializer(periods, many=True)
        return Response(serializer.data)


class CloseFinancialPeriodView(APIView):
    """
    Triggers the complex IFRS end-of-year close.
    Calculates depreciation, zeroes out Income/Expense, updates Retained Earnings,
    and rolls the business over to the next financial year.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        business = request.user.business_profile
        current_period = business.get_current_period()

        if current_period.is_closed:
            return Response(
                {"error": "The current period is already closed."}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            with db_transaction.atomic():
                current_period.close_period()
                business.start_new_period()

            return Response({
                "status": "success",
                "message": f"Period {current_period.start_date} to {current_period.end_date} successfully closed."
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to close period: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Get business or return error
def get_business_or_error(user):
    business = getattr(user, "business_profile", None)
    return business

# Helper Functions for Account Grouping and Financial Data
# Organizes accounts by type and subgroup for reporting
def get_accounts_with_subgroup(business, account_type: str):
    qs = business.accounts.filter(account_class=account_type)
    return list(qs.values('id', 'name', 'account_class', 'ifrs_account', 'balance', 'subgroup'))

# Balance Sheet API Endpoint
# Returns the Statement of Financial Position
class BalanceSheetAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        business = request.user.business_profile
        if not business:
            return Response({"error": "Business profile not found"}, status=404)
        data = business.get_balance_sheet()
        serializer = BalanceSheetSerializer(data)
        return Response(serializer.data)

# Profit and Loss API Endpoint
# Returns the Income Statement
class PnLView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business_profile
        pnl_data = business.get_pnl()
        serializer = PnLSerializer(pnl_data)
        return Response(serializer.data)

# Cash Flow Statement API Endpoint
# Returns the Statement of Cash Flows
class CashFlowView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business_profile
        cashflow_data = business.get_cash_flow()
        serializer = CashFlowSerializer(cashflow_data)
        return Response(serializer.data)

# Manual Adjustment API Endpoint
# Posts arbitrary double-entry adjustments to the ledger
class ManualAdjustmentAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *arg, **kwargs):
        serializer = ManualAdjustmentSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            txn = serializer.save()
            return Response({
                "status": "Adjustment posted",
                "transaction_id": txn.id,
                "description": txn.description,
                "date": txn.date
                }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class ExportYearEndFinancialsView(APIView):
    """
    Generates professional financial reports.
    Excel: Multi-sheet workbook with P&L, BS, and full Audit Trail.
    PDF: Formal IFRS-styled Statement of Financial Position and Profit or Loss.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business_profile
        export_format = request.GET.get('file_type', 'excel').lower()
        current_period = business.get_current_period()
        
        # 1. Fetch live financial data
        pnl_data = business.get_pnl()
        bs_data = business.get_balance_sheet()
        cf_data = business.get_cash_flow()
        
        # --- REAL PDF BRANCH ---
        if export_format == 'pdf':
            from reportlab.pdfgen import canvas
            from reportlab.lib.pagesizes import letter
            from reportlab.lib import colors
            from reportlab.lib.units import inch

            buffer = BytesIO()
            p = canvas.Canvas(buffer, pagesize=letter)
            width, height = letter
            line_y = height - 1.25*inch

            # --- Header Section ---
            p.setFont("Helvetica-Bold", 18)
            p.drawCentredString(width/2, height - 0.75*inch, f"{business.business_name.upper()}")
            p.setFont("Helvetica", 10)
            p.drawCentredString(width/2, height - 1.0*inch, "Official Financial Statements - IFRS for SMEs Compliant")
            p.setLineWidth(1)
            p.line(0.75*inch, line_y, width - 0.75*inch, line_y)

            # --- Period Details ---
            y = line_y - 0.4*inch
            p.setFont("Helvetica-Bold", 12)
            p.drawString(0.75*inch, y, f"Reporting Period Ending: {current_period.end_date}")
            p.drawRightString(width - 0.75*inch, y, f"Currency: KSH")

            # --- Statement of Financial Position (Balance Sheet) ---
            y -= 0.6*inch
            p.setFont("Helvetica-Bold", 14)
            p.drawString(0.75*inch, y, "Statement of Financial Position")
            
            y -= 0.3*inch
            p.setFont("Helvetica-Bold", 11)
            p.drawString(0.75*inch, y, "ASSETS")
            p.setFont("Helvetica", 11)
            y -= 0.2*inch
            p.drawString(1.0*inch, y, "Total Assets")
            p.drawRightString(width - 0.75*inch, y, f"{bs_data.get('assets', 0):,.2f}")

            y -= 0.3*inch
            p.setFont("Helvetica-Bold", 11)
            p.drawString(0.75*inch, y, "EQUITY AND LIABILITIES")
            p.setFont("Helvetica", 11)
            y -= 0.2*inch
            p.drawString(1.0*inch, y, "Total Liabilities")
            p.drawRightString(width - 0.75*inch, y, f"{bs_data.get('liabilities', 0):,.2f}")
            y -= 0.2*inch
            p.drawString(1.0*inch, y, "Total Equity")
            p.drawRightString(width - 0.75*inch, y, f"{bs_data.get('equity', 0):,.2f}")

            # --- Statement of Profit or Loss ---
            y -= 0.6*inch
            p.setFont("Helvetica-Bold", 14)
            p.drawString(0.75*inch, y, "Statement of Profit or Loss")
            
            y -= 0.3*inch
            p.setFont("Helvetica", 11)
            p.drawString(1.0*inch, y, "Net Revenue / Income")
            p.drawRightString(width - 0.75*inch, y, f"{pnl_data.get('totals', {}).get('INCOME', 0):,.2f}")
            
            y -= 0.2*inch
            p.drawString(1.0*inch, y, "Total Operating Expenses")
            p.drawRightString(width - 0.75*inch, y, f"({pnl_data.get('totals', {}).get('EXPENSE', 0):,.2f})")
            
            y -= 0.1*inch
            p.line(width - 2.0*inch, y, width - 0.75*inch, y)
            
            y -= 0.25*inch
            p.setFont("Helvetica-Bold", 12)
            p.drawString(0.75*inch, y, "PROFIT (LOSS) FOR THE PERIOD")
            p.drawRightString(width - 0.75*inch, y, f"{pnl_data.get('net_profit', 0):,.2f}")

            # --- Footer & Signature ---
            p.setFont("Helvetica-Oblique", 9)
            p.drawString(0.75*inch, 0.75*inch, f"Generated on: {date.today().strftime('%Y-%m-%d')} | AutoBooks AI CFO Engine")
            
            p.setDash(1, 2)
            p.line(width - 2.5*inch, 1.2*inch, width - 0.75*inch, 1.2*inch)
            p.setFont("Helvetica", 10)
            p.drawRightString(width - 0.75*inch, 1.0*inch, "Authorized Signature")

            p.showPage()
            p.save()

            buffer.seek(0)
            response = HttpResponse(buffer, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{business.business_name}_Report_{current_period.end_date}.pdf"'
            return response

        # --- EXCEL BRANCH (With Audit Trail Sheet) ---
        journals = JournalEntry.objects.filter(
            transaction__business=business, 
            transaction__period=current_period
        ).order_by('transaction__date')

        df_pnl = pd.DataFrame(list(pnl_data.items()), columns=["Category", "Value"])
        df_bs = pd.DataFrame(list(bs_data.items()), columns=["Position", "Amount"])
        df_cf = pd.DataFrame(list(cf_data.items()), columns=["Activity", "Net Flow"])
        
        # Full Audit Trail Flattening
        df_audit = pd.DataFrame(list(journals.values(
            'transaction__date', 
            'transaction__description',
            'account__name', 
            'entry_type', 
            'amount'
        )))

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_pnl.to_excel(writer, sheet_name='Profit & Loss', index=False)
            df_bs.to_excel(writer, sheet_name='Balance Sheet', index=False)
            df_cf.to_excel(writer, sheet_name='Cash Flow', index=False)
            if not df_audit.empty:
                df_audit.to_excel(writer, sheet_name='Full Audit Trail', index=False)
        
        output.seek(0)
        response = HttpResponse(output, content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        response['Content-Disposition'] = f'attachment; filename="{business.business_name}_Ledger_{current_period.end_date}.xlsx"'
        return response
    
def health_check(request):
    return JsonResponse({"status": "ok"})

def create_superuser_view(request):
    """Create superuser - should be removed after first deployment."""
    User = get_user_model()
    if not User.objects.filter(username="admin").exists():
        User.objects.create_superuser("admin", "admin@example.com", "admin123")
        return HttpResponse(" Superuser created: admin / admin123")
    return HttpResponse(" Superuser already exists.")



    def get_queryset(self):
        return Account.objects.filter(business__user=self.request.user)




# ===============================================
# AUTONOMOUS AGENT TRIGGER HOOKS
# ===============================================
class Web3AgentAutonomousTriggerView(APIView):
    """
    Autonomous trigger for CFO actions. 
    Instead of executing, it queues intents for OpenClaw if thresholds are met.
    The ONLY exception is Request Liquidity, which executes directly from the Master Treasury.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        business = request.user.business_profile
        
        if not business.wallet_address:
            return Response({"error": "Business wallet not configured."}, status=status.HTTP_400_BAD_REQUEST)
            
        actions = request.data.get("actions", [])
        results = {}
        agent = Web3Agent(business.wallet_address)
        
        # === ACTION 1: Check & Queue Tax Reserve ===
        if "check_tax_reserve" in actions or not actions:
            pnl_data = business.get_pnl()
            net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
            tax_rate = Decimal(str(request.data.get("tax_rate", "0.30")))
            tax_required = Web3Automation.should_reserve_taxes(net_profit, float(tax_rate))
            
            if tax_required > 0:
                intent = agent.build_tax_escrow_intent(float(tax_required), network=business.primary_network)
                doc = Document.objects.create(
                    business=business, document_type="tax_filing", date=date.today(),
                    total=tax_required, unsigned_payload=intent, raw_text="Autonomous Tax Reserve calculation."
                )
                Transaction.objects.create(
                    business=business, date=date.today(), description=f"Autonomous Tax Reserve - {tax_rate*100}%",
                    status=TransactionStatus.PENDING_SIGNATURE, document=doc
                )
                results["tax_reserve"] = "queued"

        # === ACTION 2: Optimize Yield Deployment ===
        if "optimize_yield" in actions:
            bs_data = business.get_balance_sheet()
            available_cash = bs_data.get("assets", Decimal("0.00"))
            minimum_reserve = Decimal(str(request.data.get("minimum_reserve", "100000.00")))
            amount_to_deploy = Web3Automation.should_deploy_yield(available_cash, minimum_reserve)
            
            if amount_to_deploy > 0:
                intent = agent.build_yield_deployment_intent(float(amount_to_deploy), network=business.primary_network)
                doc = Document.objects.create(
                    business=business, document_type="journal_entry", date=date.today(),
                    total=amount_to_deploy, unsigned_payload=intent, raw_text="Autonomous Yield calculation."
                )
                Transaction.objects.create(
                    business=business, date=date.today(), description="Autonomous Yield Optimization",
                    status=TransactionStatus.PENDING_SIGNATURE, document=doc
                )
                results["yield_deployment"] = "queued"

        # === ACTION 3: Settle Pending Bills ===
        if "settle_pending_bills" in actions:
            pending_documents = Document.objects.filter(
                business=business, document_type="bill", unsigned_payload__isnull=True, blockchain_tx_hash__isnull=True
            )[:5]
            
            settled_count = 0
            for doc in pending_documents:
                vendor_wallet = request.data.get(f"vendor_wallet_{doc.id}", getattr(doc, 'vendor_wallet', None))
                if vendor_wallet and doc.total > 0:
                    intent = agent.build_settle_bill_intent(vendor_wallet, float(doc.total), "USDT", network=business.primary_network)
                    doc.unsigned_payload = intent
                    doc.save()
                    
                    txn = doc.transactions.first()
                    if txn:
                        txn.status = TransactionStatus.PENDING_SIGNATURE
                        txn.save()
                    settled_count += 1
            
            results["bill_settlement"] = f"{settled_count} bills queued for signature."

        # === ACTION 4: Execute Micro Payroll ===
        if "execute_micro_payroll" in actions:
            pnl_data = business.get_pnl()
            net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
            employees = business.employee_wallets or []
            
            if net_profit > 0 and employees:
                payroll_array = Web3Automation.get_payroll_distribution_strategy(employees, Decimal(str(net_profit)))
                if payroll_array:
                    intent = agent.build_batch_payroll_intent(payroll_array, f"Autonomous Payroll - {date.today()}", network=business.primary_network)
                    total_payroll = sum([Decimal(str(emp.get("amount", 0))) for emp in payroll_array])
                    
                    doc = Document.objects.create(
                        business=business, document_type="payroll", date=date.today(),
                        total=total_payroll, unsigned_payload=intent, raw_text="Autonomous Payroll generation."
                    )
                    Transaction.objects.create(
                        business=business, date=date.today(), description=f"Autonomous Payroll ({len(employees)} employees)",
                        status=TransactionStatus.PENDING_SIGNATURE, document=doc
                    )
                    results["micro_payroll"] = "queued"

        # === ACTION 5: Distribute Dividends ===
        if "distribute_dividends" in actions:
            dividend_amount = Decimal(str(request.data.get("dividend_amount", "0.00")))
            if dividend_amount > 0:
                cap_table = business.get_cap_table()
                valid_cap_table = [s for s in cap_table if s.get("wallet")]
                if valid_cap_table:
                    distribution_array = Web3Automation.calculate_dividend_distribution(valid_cap_table, dividend_amount)
                    if distribution_array:
                        intent = agent.build_dividend_distribution_intent(distribution_array, f"Autonomous Dividends - {date.today()}", network=business.primary_network)
                        
                        doc = Document.objects.create(
                            business=business, document_type="journal_entry", date=date.today(),
                            total=dividend_amount, unsigned_payload=intent, raw_text="Autonomous Dividend distribution."
                        )
                        Transaction.objects.create(
                            business=business, date=date.today(), description=f"Autonomous Dividends ({dividend_amount} USDT)",
                            status=TransactionStatus.PENDING_SIGNATURE, document=doc
                        )
                        results["dividends"] = "queued"

        # === ACTION 6: Request Liquidity (DIRECT EXECUTION) ===
        # Note: This does NOT get queued for OpenClaw. It executes immediately via Node.js Master Treasury.
        if "request_liquidity" in actions:
            amount_to_borrow = Decimal(str(request.data.get("amount_to_borrow", "0.00")))
            if amount_to_borrow > 0:
                bs_data = business.get_balance_sheet()
                pnl_data = business.get_pnl()
                
                total_assets = bs_data.get("assets", Decimal("0.00"))
                net_profit = pnl_data.get("totals", {}).get("INCOME", Decimal("0.00")) - pnl_data.get("totals", {}).get("EXPENSE", Decimal("0.00"))
                
                # Strict Lending Rule: Max 20% of Assets or 1x Net Profit
                max_borrow = max(total_assets * Decimal("0.20"), net_profit)
                
                if amount_to_borrow <= max_borrow:
                    try:
                        result = agent.request_liquidity(float(amount_to_borrow), network=business.primary_network)
                        
                        live_fx_rate = get_realtime_usdt_kes_rate()
                        kes_value = (amount_to_borrow * live_fx_rate).quantize(Decimal("0.01"))
                        
                        with db_transaction.atomic():
                            Account.objects.get_or_create(
                                business=business, ifrs_account="short_term_borrowings",
                                defaults={"name": "Short-Term Borrowings", "account_class": "LIABILITY", "balance": Decimal("0.00")}
                            )
                            loan_txn = Transaction.objects.create(
                                business=business, date=date.today(),
                                description=f"Autonomous Platform Liquidity ({amount_to_borrow} USDT)",
                                status=TransactionStatus.POSTED, blockchain_tx_hash=result.get("txHash")
                            )
                            loan_txn.post_transaction([
                                {"ifrs_account": "cash_and_cash_equivalents", "type": "debit", "amount": kes_value},
                                {"ifrs_account": "short_term_borrowings", "type": "credit", "amount": kes_value}
                            ])
                        results["liquidity"] = "executed_directly"
                    except Exception as e:
                        logger.error(f"Autonomous Liquidity Failed: {e}")
                        results["liquidity"] = f"failed: {str(e)}"
                else:
                    results["liquidity"] = "denied: exceeds_limits"

        return Response({"status": "success", "autonomous_actions_executed": results}, status=status.HTTP_200_OK)



class ActivateWeb3View(APIView):
    """Opt-in Web3 Onboarding. OpenClaw generates the keys locally and registers the public address here."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        business = request.user.business_profile
        wallet_address = request.data.get("wallet_address")
        network = request.data.get("network", "celo-sepolia")

        if not wallet_address:
            return Response({"error": "Missing wallet_address from local OpenClaw client."}, status=status.HTTP_400_BAD_REQUEST)

        if business.wallet_address:
            return Response({"error": "Web3 wallet already active for this business."}, status=status.HTTP_400_BAD_REQUEST)

        # Save ONLY the public information
        business.wallet_address = wallet_address
        business.primary_network = network
        business.save(update_fields=['wallet_address', 'primary_network'])

        return Response({
            "message": f"Web3 successfully activated on {network}.",
            "wallet_address": business.wallet_address
        }, status=status.HTTP_200_OK)


# ===============================================
# WEB3 ADMINISTRATION & CAP TABLE MANAGEMENT
# ===============================================
class BusinessWalletManagementView(APIView):
    """Manages the business Web3 wallet, fetches live balances, and processes platform liquidity advances."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business_profile
        
        # Fetch real-time on-chain balance from Node.js
        live_balance = "0.00"
        if business.wallet_address:
            node_url = getattr(settings, "NODE_WALLET_BALANCE_URL", f"https://node-web3-server.onrender.com/wallet-balance/{business.wallet_address}/{business.primary_network}")
            try:
                resp = requests.get(node_url, timeout=10)
                if resp.status_code == 200:
                    live_balance = resp.json().get("balance", "0.00")
            except Exception as e:
                logger.error(f"Failed to fetch Web3 balance: {e}")

        return Response({
            "wallet_address": business.wallet_address,
            "primary_network": business.primary_network,
            "balance_USDT": live_balance
        }, status=status.HTTP_200_OK)

    def post(self, request):
        business = request.user.business_profile
        amount_usdt = request.data.get("amount_usdt")
        
        if not business.wallet_address:
            return Response({"error": "Web3 Treasury not activated."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            amount_decimal = Decimal(str(amount_usdt))
            if amount_decimal <= 0:
                raise ValueError
        except:
            return Response({"error": "Invalid USDT amount."}, status=status.HTTP_400_BAD_REQUEST)

        node_url = getattr(settings, "NODE_LIQUIDITY_URL", "https://node-web3-server.onrender.com/request-liquidity")
        
        try:
            # 1. Trigger Node.js to send the USDT on the blockchain
            response = requests.post(
                node_url,
                json={
                    "wallet_address": business.wallet_address,
                    "amount_usdt": float(amount_decimal),
                    "network": business.primary_network
                },
                timeout=60
            )
            response.raise_for_status()
            data = response.json()

            # 2. IFRS Accounting: Platform Liquidity Advance (Loan)
            live_fx_rate = get_realtime_usdt_kes_rate()
            kes_value = (amount_decimal * live_fx_rate).quantize(Decimal("0.01"))

            with db_transaction.atomic():
                # Ensure the liability account exists first!
                Account.objects.get_or_create(
                    business=business,
                    ifrs_account="short_term_borrowings",
                    defaults={
                        "name": "Short-Term Borrowings",
                        "account_class": "LIABILITY",
                        "balance": Decimal("0.00")
                    }
                )

                txn = Transaction.objects.create(
                    business=business,
                    date=date.today(),
                    description=f"Platform Liquidity Advance ({amount_decimal} USDT @ {live_fx_rate} KES/USDT)",
                    status=TransactionStatus.POSTED,
                    blockchain_tx_hash=data.get("txHash")
                )
                
                txn.post_transaction([
                    {"ifrs_account": "cash_and_cash_equivalents", "type": "debit", "amount": kes_value},
                    {"ifrs_account": "short_term_borrowings", "type": "credit", "amount": kes_value}
                ])

            return Response({
                "status": "success",
                "message": f"Successfully advanced {amount_decimal} USDT to treasury.",
                "tx_hash": data.get("txHash")
            }, status=status.HTTP_200_OK)

        except requests.exceptions.HTTPError as e:
            try:
                error_msg = e.response.json().get('error', 'Unknown Error')
            except:
                error_msg = str(e)
            return Response({"error": f"Blockchain Transfer Failed: {error_msg}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Ledger sync failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class EmployeeManagementView(APIView):
    """Admin view to manage employee roster and their Web3 wallets."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business_profile
        return Response({"employees": business.employee_wallets or []}, status=status.HTTP_200_OK)

    def post(self, request):
        business = request.user.business_profile
        employees = request.data.get("employees", [])
        
        # Expecting: [{"name": "Simon Mwendwa", "wallet": "0x...", "salary_per_period": 50000}]
        business.employee_wallets = employees
        business.save(update_fields=['employee_wallets'])
        
        return Response({
            "status": "success", 
            "message": "Employee roster updated.",
            "employees": business.employee_wallets
        }, status=status.HTTP_200_OK)


class ShareholderManagementView(APIView):
    """Admin view to map Web3 wallets to mathematically verified shareholders."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business_profile
        # Leverages the dynamic calculation method added to models.py
        cap_table = business.get_cap_table()
        return Response({"shareholders": cap_table}, status=status.HTTP_200_OK)

    def patch(self, request):
        business = request.user.business_profile
        updates = request.data.get("shareholders", []) 
        
        with db_transaction.atomic():
            for update in updates:
                name = update.get("name")
                wallet = update.get("wallet")
                if name and wallet:
                    # Only update the wallet address, preserving the immutable total_investment
                    Shareholder.objects.filter(business=business, name=name).update(wallet_address=wallet)
        
        return Response({
            "status": "success", 
            "message": "Shareholder Web3 wallets mapped successfully.",
            "shareholders": business.get_cap_table()
        }, status=status.HTTP_200_OK)

class TaxMonitoringView(APIView):
    """Provides a realistic overview of tax liabilities, expenses, and on-chain escrow status."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business_profile
        
        # Helper to get account balance safely
        def get_bal(ifrs_code):
            acc = Account.objects.filter(business=business, ifrs_account=ifrs_code).first()
            return acc.balance if acc else Decimal("0.00")

        # 1. Fetch IFRS Balances
        liability = get_bal("current_tax_liabilities")
        expense = get_bal("tax_expense")
        deferred_liab = get_bal("deferred_tax_liabilities")
        deferred_asset = get_bal("deferred_tax_assets")

        # 2. Calculate Total Escrowed/Paid
        # Autonomous Web3 agents debit 'current_tax_liabilities' when they lock funds in escrow.
        tax_liability_acc = Account.objects.filter(business=business, ifrs_account="current_tax_liabilities").first()
        escrowed_amount = Decimal("0.00")
        if tax_liability_acc:
            escrowed = JournalEntry.objects.filter(
                transaction__business=business,
                account=tax_liability_acc,
                entry_type="debit"
            ).aggregate(Sum('amount'))['amount__sum']
            escrowed_amount = escrowed if escrowed else Decimal("0.00")

        # 3. Fetch Recent Web3 Escrow Transactions
        escrow_txns = Transaction.objects.filter(
            business=business,
            description__icontains="Tax Reserve Escrow",
            status=TransactionStatus.POSTED
        ).order_by('-date')[:5]

        recent_escrows = []
        for txn in escrow_txns:
            # Extract the debited amount (the amount sent to the smart contract)
            amt = txn.entries.filter(entry_type="debit").first()
            recent_escrows.append({
                "date": str(txn.date),
                "description": txn.description,
                "tx_hash": txn.blockchain_tx_hash,
                "amount": float(amt.amount) if amt else 0.0
            })

        return Response({
            "current_tax_liability": float(liability),
            "tax_expense": float(expense),
            "deferred_tax_liability": float(deferred_liab),
            "deferred_tax_asset": float(deferred_asset),
            "total_escrowed": float(escrowed_amount),
            "recent_escrows": recent_escrows,
            "statutory_tax_rate": 30.0 # Kenya Corporate Tax Rate
        }, status=status.HTTP_200_OK)


# ------------- END WALLET MANAGEMENT -----------------

class TransactionViewsets(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = TransactionSerializer

    def get_queryset(self):
        return Transaction.objects.filter(business__user=self.request.user)

    def perform_create(self, serializer):
        business = self.request.user.business_profile
        serializer.save(business=business)

class FixedAssetViewSet(viewsets.ModelViewSet):
    """
    Allows the CFO/User to view their sub-ledger of assets 
    and update the `current_fair_value` before period close.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = FixedAssetSerializer

    def get_queryset(self):
        return FixedAsset.objects.filter(business__user=self.request.user, is_active=True)

    def perform_create(self, serializer):
        serializer.save(business=self.request.user.business_profile)

# ===============================================
# WEB3 SIWE (Sign-In With Ethereum) AUTHENTICATION
# ===============================================

class Web3ChallengeView(APIView):
    """Generates a random cryptographic nonce for the Claware Wallet to sign."""
    permission_classes = [AllowAny]

    def post(self, request):
        public_address = request.data.get("public_address")
        if not public_address:
            return Response({"error": "public_address is required"}, status=status.HTTP_400_BAD_REQUEST)

        # Generate a secure random nonce
        nonce = f"Autobooks Cloud Authentication Challenge: {secrets.token_hex(16)}"
        
        # Store in Django cache for 5 minutes (300 seconds)
        cache_key = f"siwe_nonce_{public_address.lower()}"
        cache.set(cache_key, nonce, timeout=300)

        return Response({"nonce": nonce}, status=status.HTTP_200_OK)

class Web3LoginView(APIView):
    """Verifies the Claware Wallet signature, creates the user/business, and issues JWTs."""
    permission_classes = [AllowAny]

    def post(self, request):
        public_address = request.data.get("public_address")
        signature = request.data.get("signature")

        if not public_address or not signature:
            return Response({"error": "Missing public_address or signature"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Retrieve the nonce from cache
        cache_key = f"siwe_nonce_{public_address.lower()}"
        nonce = cache.get(cache_key)
        
        if not nonce:
            return Response({"error": "Challenge expired or not found. Try again."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 2. Reconstruct the message and recover the signer using the ALIAS
            message = encode_defunct(text=nonce)
            recovered_address = EthAccount.recover_message(message, signature=signature) # <--- Fixed here

            # 3. Cryptographic Verification
            if recovered_address.lower() != public_address.lower():
                return Response({"error": "Signature verification failed. Impersonation attempt detected."}, status=status.HTTP_401_UNAUTHORIZED)

            # 4. Success! Get or Create the User based on their Public Wallet
            User = get_user_model()
            user, created = User.objects.get_or_create(username=public_address.lower())
            
            if created:
                # Lock out traditional password logins for Web3-native accounts
                user.set_unusable_password()
                user.save()

            # 5. Ensure the Business Profile and IFRS Ledger exist
            get_or_create_business(user)

            # Clear the nonce to prevent replay attacks
            cache.delete(cache_key)

            # 6. Generate Standard Django SimpleJWT Tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'message': 'Web3 Login successful.',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'username': user.username,
                'wallet_address': public_address
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Web3 SIWE Error: {str(e)}")
            return Response({"error": f"Authentication error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class Web3ReconciliationView(APIView):
    """Called by the local wallet client after a successful broadcast via Node.js"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        business = request.user.business_profile
        document_id = request.data.get("document_id")
        tx_hash = request.data.get("tx_hash")
        
        try:
            doc = Document.objects.get(id=document_id, business=business)
            txn = doc.transactions.filter(status=TransactionStatus.PENDING_SIGNATURE).first()
            
            if not txn:
                return Response({"error": "No pending transaction found for this document."}, status=status.HTTP_400_BAD_REQUEST)
                
            with db_transaction.atomic():
                # 1. Clear the payload queue from the Document
                doc.unsigned_payload = None
                doc.blockchain_tx_hash = tx_hash
                doc.save()
                
                # 2. Mark the transaction as complete
                txn.blockchain_tx_hash = tx_hash
                txn.status = TransactionStatus.POSTED
                txn.save()

                # 3. Formally map the Double-Entry Ledger if not already mapped
                if not txn.entries.exists():
                    import re
                    
                    # FETCH LIVE RATE DIRECTLY FROM COINGECKO UTILITY
                    market_rate = get_realtime_usdt_kes_rate()

                    # --- PARTIAL PAYMENT MATH: EXTRACT SIGNED AMOUNT FROM AUDIT TRACE ---
                    # We ignore doc.total because we are paying partially. 
                    # We extract the USDT quantity the user actually signed from the txn description.
                    # Example string: "Pending Settlement - 2 USDT @ 129.30 KES/USDT to..."
                    usdt_payment_amount = Decimal("0.00")
                    match = re.search(r"([\d\.]+)\s*USDT", txn.description)
                    
                    if match:
                        usdt_payment_amount = Decimal(match.group(1))
                    
                    # Convert only the PAID amount to KES for the ledger entry
                    kes_value = (usdt_payment_amount * market_rate).quantize(Decimal("0.01"))
                    
                    logger.info(f"Reconciling Partial Payment: {usdt_payment_amount} USDT -> {kes_value} KES (@ {market_rate})")
                    # ----------------------------------------------------------------

                    entries = []
                    if doc.document_type == "payroll":
                        entries = [{"ifrs_account": "employee_benefits_expense", "type": "debit", "amount": kes_value}, {"ifrs_account": "cash_and_cash_equivalents", "type": "credit", "amount": kes_value}]
                    elif doc.document_type == "tax_filing":
                        entries = [{"ifrs_account": "current_tax_liabilities", "type": "debit", "amount": kes_value}, {"ifrs_account": "cash_and_cash_equivalents", "type": "credit", "amount": kes_value}]
                    elif doc.document_type == "journal_entry":
                        if "Yield" in txn.description:
                            entries = [{"ifrs_account": "investments_in_associates", "type": "debit", "amount": kes_value}, {"ifrs_account": "cash_and_cash_equivalents", "type": "credit", "amount": kes_value}]
                        elif "Dividend" in txn.description:
                            entries = [{"ifrs_account": "retained_earnings", "type": "debit", "amount": kes_value}, {"ifrs_account": "cash_and_cash_equivalents", "type": "credit", "amount": kes_value}]
                    elif doc.document_type == "bill":
                        # This clears the payable by the EXACT fiat-value of the USDT sent, regardless of original bill total.
                        entries = [{"ifrs_account": "trade_and_other_payables", "type": "debit", "amount": kes_value}, {"ifrs_account": "cash_and_cash_equivalents", "type": "credit", "amount": kes_value}]
                    
                    # Post the validated double-entries
                    if entries:
                        txn.post_transaction(entries, transaction_date=date.today())
            
            return Response({"status": "success", "message": "Ledger reconciled for partial payment using live market rates."})
            
        except Document.DoesNotExist:
            return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
