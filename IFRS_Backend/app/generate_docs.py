import os
import calendar
import random
from datetime import date
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch

# --- CONFIGURATION ---
BUSINESS_NAME = "Ithoka Computing"
OUTPUT_DIR = "Ithoka_2026_financial_run"

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

documents = []

# Seeded to ensure the simulation is identical and verifiable every time you run it
random.seed(42)

def add_doc(filename, title, issuer, recipient, doc_date, items, notes=""):
    # SURGICAL MATH FIX: Correctly multiply Qty * Unit Price
    subtotal = sum(float(item[1]) * float(item[2]) for item in items)
    
    # 16% VAT unless it's Payroll, Equity, International Subscriptions, or Cloud
    tax_rate = 0.16
    if "Payroll" in title or "AWS" in issuer or "Google" in issuer or "Equity" in title:
        tax_rate = 0.0
        
    tax = subtotal * tax_rate
    total = subtotal + tax

    # Format items for PDF display
    formatted_items = []
    for desc, qty, price in items:
        formatted_items.append((desc, str(qty), f"{price:,.2f}", f"{(qty * price):,.2f}"))

    documents.append({
        "filename": filename,
        "title": title,
        "issuer": issuer,
        "recipient": recipient,
        "date": doc_date.strftime("%Y-%m-%d"),
        "items": formatted_items,
        "subtotal": f"{subtotal:,.2f}",
        "tax": f"{tax:,.2f}",
        "total": f"{total:,.2f}",
        "notes": notes
    })

# ==========================================
# PROCEDURAL GENERATION: THE 2026 LEDGER
# ==========================================

print("Initializing High-Fidelity 2026 Financial Matrix for Ithoka Computing...")

# 1. INITIAL STARTUP CAPITAL (JANUARY)
add_doc(
    "2026_01_02_Founder_Equity.pdf", "EQUITY RECEIPT", BUSINESS_NAME, "Founder (Nick Muthoki)", date(2026, 1, 2),
    [("Seed Capital Injection", 1, 2500000.00)], "Initial capital injection to corporate bank account."
)

add_doc(
    "2026_01_05_Founder_Equity_1.pdf", "EQUITY RECEIPT", BUSINESS_NAME, "Co-Founder (Moses Zico)", date(2026, 1, 5),
    [("Seed Capital Injection", 1, 1500000.00)], "Initial capital injection to corporate bank account."
)


# 2. FIRST HARDWARE ACQUISITION
add_doc(
    "2026_01_10_MacBook_Purchase.pdf", "TAX INVOICE", "Salute iWorld Kenya", BUSINESS_NAME, date(2026, 1, 10),
    [("MacBook Pro M3 Max 64GB", 2, 350000.00)], "(Capital Expenditure: PPE)"
)

# 3. DYNAMIC MONTHLY CYCLES (JAN - DEC)
clients = ["HakiChain NGO", "Nexus Forensics Corp", "AgroSight Farms", "MedGemma AI Labs", "FinTech Hub Kenya"]
services = ["Web3 Smart Contract Audit", "Neurosymbolic AI Fine-Tuning", "Full-Stack Dashboard Dev", "Forensic Data Pipeline Setup", "Monthly DevOps Retainer"]
invoice_counter = 100

for month in range(1, 13):
    last_day = calendar.monthrange(2026, month)[1]
    
    # A. Fixed OpEx: Rent (1st of Month)
    add_doc(
        f"2026_{month:02d}_01_Nairobi_Garage_Rent.pdf", "TAX INVOICE", "Nairobi Garage Kilimani", BUSINESS_NAME, date(2026, month, 1),
        [("Private Office Rent - Monthly", 1, 60000.00)], "Due upon receipt."
    )
    
    # B. Fixed OpEx: Internet (5th of Month)
    add_doc(
        f"2026_{month:02d}_05_Safaricom_Fiber.pdf", "MONTHLY BILL", "Safaricom PLC", BUSINESS_NAME, date(2026, month, 5),
        [("Enterprise Fiber 500Mbps", 1, 15000.00)], "Account # 882930."
    )
    
    # C. Variable OpEx: AWS Cloud (15th of Month)
    # AWS bills fluctuate realistically between 25k and 55k based on server load
    aws_cost = round(random.uniform(25000, 55000), 2)
    add_doc(
        f"2026_{month:02d}_15_AWS_Cloud.pdf", "INVOICE", "Amazon Web Services, Inc.", BUSINESS_NAME, date(2026, month, 15),
        [("EC2 Compute and RDS Storage", 1, aws_cost)], "Billed to Corporate Card. Reverse Charge VAT applies."
    )
    
    # D. Payroll Run (Last day of Month)
    add_doc(
        f"2026_{month:02d}_{last_day}_Payroll_Run.pdf", "PAYROLL VOUCHER", BUSINESS_NAME, "Salaries & Wages Account", date(2026, month, last_day),
        [
            ("Lead Engineer Salary", 1, 150000.00),
            ("UI Developer Salary", 1, 80000.00)
        ], "Authorized by CFO."
    )

    # E. Revenue Generation: Client Invoices (1 to 2 per month)
    num_invs = random.choice([1, 2])
    for _ in range(num_invs):
        client = random.choice(clients)
        service = random.choice(services)
        # Price varies based on the contract size
        price = random.choice([150000.00, 200000.00, 350000.00, 500000.00])
        inv_date = random.randint(10, 28)
        
        add_doc(
            f"2026_{month:02d}_{inv_date:02d}_Client_INV{invoice_counter}.pdf", "TAX INVOICE", BUSINESS_NAME, client, date(2026, month, inv_date),
            [(service, 1, price)], "Payment Due in 14 Days."
        )
        invoice_counter += 1

# 4. RANDOM MID-YEAR CAPITAL EXPENDITURES
add_doc(
    "2026_03_15_Dell_Server.pdf", "TAX INVOICE", "Dell Technologies East Africa", BUSINESS_NAME, date(2026, 3, 15),
    [("PowerEdge R750 Rack Server", 1, 130000.00)], "(Capital Expenditure: PPE)"
)
add_doc(
    "2026_06_10_Office_Furniture.pdf", "TAX INVOICE", "Victoria Furniture Ltd", BUSINESS_NAME, date(2026, 6, 10),
    [
        ("Ergonomic Office Desk", 3, 45000.00),
        ("Orthopedic Office Chair", 3, 25000.00)
    ], "Delivered and Installed."
)
add_doc(
    "2026_09_05_Google_Workspace.pdf", "INVOICE", "Google Ireland Ltd", BUSINESS_NAME, date(2026, 9, 5),
    [("Google Workspace Enterprise - Annual Sub", 5, 30000.00)], "Annual License. (Intangible Asset / Prepaid Expense)"
)

# ==========================================
# PDF GENERATION ENGINE
# ==========================================
def generate_pdf(doc_data):
    filepath = os.path.join(OUTPUT_DIR, doc_data["filename"])
    
    with open(filepath, "wb") as f:
        c = canvas.Canvas(f, pagesize=letter)
        width, height = letter

        # Header
        c.setFont("Helvetica-Bold", 20)
        c.drawString(1 * inch, height - 1 * inch, doc_data["issuer"].upper())
        
        c.setFont("Helvetica-Bold", 14)
        c.drawString(1 * inch, height - 1.5 * inch, doc_data["title"])
        
        # Meta Data
        c.setFont("Helvetica", 11)
        c.drawString(1 * inch, height - 2.0 * inch, f"Date: {doc_data['date']}")
        c.drawString(1 * inch, height - 2.2 * inch, f"Billed To: {doc_data['recipient']}")

        # Table Header
        c.line(1 * inch, height - 2.6 * inch, width - 1 * inch, height - 2.6 * inch)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(1 * inch, height - 2.8 * inch, "Description")
        c.drawString(4.5 * inch, height - 2.8 * inch, "Qty")
        c.drawString(5.0 * inch, height - 2.8 * inch, "Unit Price")
        c.drawString(6.2 * inch, height - 2.8 * inch, "Total")
        c.line(1 * inch, height - 2.9 * inch, width - 1 * inch, height - 2.9 * inch)

        # Items
        y_pos = height - 3.2 * inch
        c.setFont("Helvetica", 10)
        for item in doc_data["items"]:
            c.drawString(1 * inch, y_pos, item[0])
            c.drawString(4.5 * inch, y_pos, item[1])
            c.drawString(5.0 * inch, y_pos, item[2])
            c.drawString(6.2 * inch, y_pos, item[3])
            y_pos -= 0.3 * inch

        # Totals
        c.line(4.5 * inch, y_pos, width - 1 * inch, y_pos)
        y_pos -= 0.3 * inch
        c.drawString(4.5 * inch, y_pos, "Subtotal:")
        c.drawString(6.2 * inch, y_pos, doc_data["subtotal"])
        
        y_pos -= 0.3 * inch
        c.drawString(4.5 * inch, y_pos, "Tax (VAT):")
        c.drawString(6.2 * inch, y_pos, doc_data["tax"])
        
        y_pos -= 0.3 * inch
        c.setFont("Helvetica-Bold", 12)
        c.drawString(4.5 * inch, y_pos, "TOTAL (KSH):")
        c.drawString(6.2 * inch, y_pos, doc_data["total"])

        # Footer
        c.setFont("Helvetica-Oblique", 9)
        c.drawString(1 * inch, 1 * inch, doc_data["notes"])

        c.showPage()
        c.save()
        
    print(f"Generated: {filepath}")

# Execute Generation
for doc in documents:
    generate_pdf(doc)

print(f"\n✅ SUCCESS: {len(documents)} High-Fidelity Financial Documents generated in '{OUTPUT_DIR}'!")