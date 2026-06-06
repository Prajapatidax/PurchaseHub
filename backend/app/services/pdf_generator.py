from io import BytesIO
import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_invoice_pdf(invoice_data: dict) -> bytes:
    """
    Generates a PDF invoice using ReportLab Platypus.
    invoice_data should contain:
    - invoice_number: str
    - date: str
    - po_number: str
    - vendor_name: str
    - vendor_email: str
    - vendor_phone: str
    - vendor_gst: str
    - rfq_title: str
    - quantity: int
    - unit_price: float
    - subtotal: float
    - tax: float
    - total: float
    """
    buffer = BytesIO()
    # Margins: 36 points = 0.5 inch
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=letter, 
        rightMargin=40, 
        leftMargin=40, 
        topMargin=40, 
        bottomMargin=40
    )
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    brand_style = ParagraphStyle(
        'BrandName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#4F46E5') # Indigo 600
    )
    
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=30,
        alignment=2, # Right aligned
        textColor=colors.HexColor('#1F2937') # Gray 800
    )
    
    header_right_style = ParagraphStyle(
        'HeaderRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        alignment=2, # Right aligned
        textColor=colors.HexColor('#4B5563') # Gray 600
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#374151'), # Gray 700
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor('#4B5563') # Gray 600
    )

    body_bold = ParagraphStyle(
        'BodyBoldCustom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor('#1F2937')
    )

    table_header_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white
    )

    # 1. Header Table (Brand Logo & Title)
    header_data = [
        [
            Paragraph("VendorBridge", brand_style),
            Paragraph("INVOICE", title_style)
        ],
        [
            Paragraph("Procurement & Vendor ERP System", body_style),
            Paragraph(f"<b>Invoice #:</b> {invoice_data['invoice_number']}<br/><b>Date:</b> {invoice_data['date']}", header_right_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[260, 270])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (1,1), (1,1), 10),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 20))
    
    # 2. Billing & PO Information
    billing_data = [
        [
            Paragraph("<b>FROM (VENDOR):</b>", section_heading),
            Paragraph("<b>TO (BUYER):</b>", section_heading)
        ],
        [
            Paragraph(
                f"<b>{invoice_data['vendor_name']}</b><br/>"
                f"Email: {invoice_data['vendor_email']}<br/>"
                f"Phone: {invoice_data['vendor_phone']}<br/>"
                f"GSTIN: {invoice_data['vendor_gst']}",
                body_style
            ),
            Paragraph(
                "<b>PurchaseHub Enterprise Ltd.</b><br/>"
                "Corporate Procurement Division<br/>"
                "100 ERP Way, Suite 400<br/>"
                "procurement@purchasehub.com",
                body_style
            )
        ],
        [
            Spacer(1, 10),
            Spacer(1, 10)
        ],
        [
            Paragraph(f"<b>Purchase Order Reference:</b> {invoice_data['po_number']}", body_bold),
            Paragraph("<b>Payment Terms:</b> Net 30 Days", body_bold)
        ]
    ]
    billing_table = Table(billing_data, colWidths=[260, 270])
    billing_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,3), (-1,3), 10),
    ]))
    story.append(billing_table)
    story.append(Spacer(1, 25))
    
    # 3. Line Items Table
    # Table headers
    items_header = [
        Paragraph("Item Description", table_header_style),
        Paragraph("Quantity", table_header_style),
        Paragraph("Unit Price ($)", table_header_style),
        Paragraph("Amount ($)", table_header_style)
    ]
    
    # Table rows
    item_row = [
        Paragraph(invoice_data['rfq_title'], body_style),
        Paragraph(str(invoice_data['quantity']), body_style),
        Paragraph(f"{invoice_data['unit_price']:,.2f}", body_style),
        Paragraph(f"{invoice_data['subtotal']:,.2f}", body_style)
    ]
    
    items_data = [
        items_header,
        item_row,
        # Spacer row
        ["", "", "", ""],
        # Calculations
        ["", "", Paragraph("Subtotal:", body_bold), Paragraph(f"${invoice_data['subtotal']:,.2f}", body_style)],
        ["", "", Paragraph("Tax (GST 18%):", body_bold), Paragraph(f"${invoice_data['tax']:,.2f}", body_style)],
        ["", "", Paragraph("Total Amount:", body_bold), Paragraph(f"${invoice_data['total']:,.2f}", body_bold)]
    ]
    
    items_table = Table(items_data, colWidths=[280, 70, 90, 90])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4F46E5')), # Indigo header
        ('ALIGN', (1, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 8),
        
        # Grid lines for items
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#4F46E5')),
        ('LINEBELOW', (0, 1), (-1, 1), 0.5, colors.HexColor('#E5E7EB')),
        
        # Calculation section padding and borders
        ('PADDING', (2, 3), (-1, -1), 6),
        ('LINEABOVE', (2, 3), (3, 3), 0.5, colors.HexColor('#D1D5DB')),
        ('LINEBELOW', (2, 5), (3, 5), 1.5, colors.HexColor('#4F46E5')),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 40))
    
    # 4. Footer & Terms
    footer_text = (
        "<b>Terms & Conditions:</b><br/>"
        "1. Goods once sold will not be taken back.<br/>"
        "2. Please quote Invoice Number & PO Reference for all payment correspondence.<br/>"
        "3. Payment should be made directly within 30 days from invoice date.<br/><br/>"
        "<font color='#4F46E5'><b>Thank you for partnering with VendorBridge!</b></font>"
    )
    story.append(Paragraph(footer_text, body_style))
    
    # Build Document
    doc.build(story)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
