"""
Management command to fix documents that were incorrectly posted as "bill" 
instead of their original detected type (e.g., "invoice").

Usage: python manage.py fix_misposted_documents
"""
from django.core.management.base import BaseCommand
from django.db import transaction as db_transaction
from app.models import Document, Transaction, TransactionStatus, Account, JournalEntry
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Fix documents that were posted with incorrect document_type"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without actually modifying data'
        )
        parser.add_argument(
            '--document-id',
            type=int,
            help='Fix a specific document by ID'
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        doc_id = options.get('document_id')
        
        # Find documents that could have been misposted
        # These are documents posted as "bill" but might have been detected as something else
        query = Document.objects.filter(
            document_type="bill",
            transaction__isnull=False,
            transaction__status=TransactionStatus.POSTED
        )
        
        if doc_id:
            query = query.filter(id=doc_id)
        
        if not query.exists():
            self.stdout.write(self.style.WARNING("No documents found to fix."))
            return
        
        self.stdout.write(f"\nFound {query.count()} documents to review:")
        
        for doc in query:
            self.stdout.write(f"\n{'='*70}")
            self.stdout.write(f"Document ID: {doc.id}")
            self.stdout.write(f"Current Type: {doc.document_type}")
            self.stdout.write(f"AI Detected Type: {doc.ai_detected_type or 'NOT SET (Cannot auto-fix)'}")
            self.stdout.write(f"Date: {doc.date}")
            self.stdout.write(f"Total: {doc.total}")
            self.stdout.write(f"Vendor: {doc.vendor}")
            
            # Show the current posted transactions
            txns = Transaction.objects.filter(document=doc, status=TransactionStatus.POSTED)
            if txns.exists():
                self.stdout.write(f"\nCurrent Ledger Entries:")
                for txn in txns:
                    for entry in txn.entries.all():
                        self.stdout.write(
                            f"  {entry.entry_type.upper():6} {entry.amount:>12} → {entry.account.name}"
                        )
            
            if doc.ai_detected_type and doc.ai_detected_type != doc.document_type:
                self.stdout.write(
                    self.style.SUCCESS(f"\n✓ Can be fixed: Revert to '{doc.ai_detected_type}'")
                )
                
                if not dry_run:
                    try:
                        with db_transaction.atomic():
                            # 1. Reverse all current postings
                            reversal_txn = Transaction.objects.create(
                                business=doc.business,
                                document=doc,
                                date=doc.date,
                                status=TransactionStatus.DRAFT,
                                description=f"REVERSAL: Correcting misposted {doc.document_type} (was incorrectly posted instead of {doc.ai_detected_type})"
                            )
                            
                            reversal_entries = []
                            for txn in txns:
                                for entry in txn.entries.all():
                                    # Flip the entry
                                    rev_type = "credit" if entry.entry_type == "debit" else "debit"
                                    reversal_entries.append({
                                        "ifrs_account": entry.account.ifrs_account,
                                        "amount": entry.amount,
                                        "type": rev_type
                                    })
                            
                            reversal_txn.post_transaction(reversal_entries)
                            
                            # 2. Post the corrected transaction
                            doc.document_type = doc.ai_detected_type
                            doc.save(update_fields=['document_type'])
                            doc.post_transaction()
                            
                            self.stdout.write(
                                self.style.SUCCESS(f"✓ Fixed document #{doc.id}: Posted as '{doc.ai_detected_type}'")
                            )
                    except Exception as e:
                        self.stdout.write(
                            self.style.ERROR(f"✗ Error fixing document #{doc.id}: {str(e)}")
                        )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"\n⚠ Cannot auto-fix: No AI-detected type stored.\n"
                        f"   Manual review required: Check WhatsApp audit trail for original classification."
                    )
                )
        
        self.stdout.write(f"\n{'='*70}")
        
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS("\n✓ Dry run completed. Run without --dry-run to apply fixes.")
            )
