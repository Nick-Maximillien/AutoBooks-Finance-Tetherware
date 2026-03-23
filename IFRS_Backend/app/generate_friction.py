import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch

OUTPUT_DIR = "ithoka_2026_financial_run"
if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def generate_credit_note():
    filename = "2026_08_10_Credit_Note_Refund.pdf"
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    with open(filepath, "wb") as f:
        c = canvas.Canvas(f, pagesize=letter)
        width, height = letter

        # Header
        c.setFont("Helvetica-Bold", 20)
        c.drawString(1 * inch, height - 1 * inch, "ITHOKA COMPUTING")
        c.setFont("Helvetica-Bold", 14)
        c.drawString(1 * inch, height - 1.5 * inch, "CREDIT NOTE / REFUND")
        
        # Meta Data
        c.setFont("Helvetica", 11)
        c.drawString(1 * inch, height - 2.0 * inch, "Date: 2026-08-10")
        c.drawString(1 * inch, height - 2.2 * inch, "Issued To: FinTech Hub Kenya")
        c.drawString(1 * inch, height - 2.4 * inch, "Ref: Cancellation of Phase 2 Pipeline Setup")

        # Table Header
        c.line(1 * inch, height - 2.8 * inch, width - 1 * inch, height - 2.8 * inch)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1 * inch, height - 3.0 * inch, "Description")
        c.drawString(4.5 * inch, height - 3.0 * inch, "Qty")
        c.drawString(5.0 * inch, height - 3.0 * inch, "Unit Price")
        c.drawString(6.2 * inch, height - 3.0 * inch, "Total")
        c.line(1 * inch, height - 3.1 * inch, width - 1 * inch, height - 3.1 * inch)

        # Items
        y_pos = height - 3.4 * inch
        c.setFont("Helvetica", 10)
        c.drawString(1 * inch, y_pos, "Service Refund (Cancellation)")
        c.drawString(4.5 * inch, y_pos, "1")
        c.drawString(5.0 * inch, y_pos, "174,000.00")
        c.drawString(6.2 * inch, y_pos, "174,000.00")
        
        # Totals
        y_pos -= 0.5 * inch
        c.line(4.5 * inch, y_pos, width - 1 * inch, y_pos)
        y_pos -= 0.3 * inch
        c.drawString(4.5 * inch, y_pos, "Subtotal:")
        c.drawString(6.2 * inch, y_pos, "174,000.00")
        
        y_pos -= 0.3 * inch
        c.drawString(4.5 * inch, y_pos, "Tax (VAT 0% - Reversal):")
        c.drawString(6.2 * inch, y_pos, "0.00")
        
        y_pos -= 0.3 * inch
        c.setFont("Helvetica-Bold", 12)
        c.drawString(4.5 * inch, y_pos, "CREDIT TOTAL (KSH):")
        c.drawString(6.2 * inch, y_pos, "174,000.00")

        # Footer
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(1 * inch, 1 * inch, "This amount reverses previous invoice charges. (TEST: Q3 Friction & Reversal)")

        c.showPage()
        c.save()
    print(f" Generated Q3 Friction Document: {filepath}")

generate_credit_note()