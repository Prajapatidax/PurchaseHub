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
        Paragraph("Unit Price (Rs.)", table_header_style),
        Paragraph("Amount (Rs.)", table_header_style)
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
        ["", "", Paragraph("Subtotal:", body_bold), Paragraph(f"Rs. {invoice_data['subtotal']:,.2f}", body_style)],
        ["", "", Paragraph("Tax (GST 18%):", body_bold), Paragraph(f"Rs. {invoice_data['tax']:,.2f}", body_style)],
        ["", "", Paragraph("Total Amount:", body_bold), Paragraph(f"Rs. {invoice_data['total']:,.2f}", body_bold)]
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

def generate_po_pdf(po_data: dict) -> bytes:
    """
    Generates a PDF Purchase Order using ReportLab Platypus.
    po_data should contain:
    - po_number: str
    - date: str
    - vendor_name: str
    - vendor_email: str
    - vendor_phone: str
    - vendor_gst: str
    - rfq_title: str
    - quantity: int
    - unit_price: float
    - total: float
    """
    buffer = BytesIO()
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
    
    brand_style = ParagraphStyle(
        'POBrandName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#714B67') # Odoo Brand Purple
    )
    
    title_style = ParagraphStyle(
        'POTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        alignment=2,
        textColor=colors.HexColor('#1F2937')
    )
    
    header_right_style = ParagraphStyle(
        'POHeaderRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        alignment=2,
        textColor=colors.HexColor('#4B5563')
    )
    
    section_heading = ParagraphStyle(
        'POSectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#374151'),
        spaceAfter=6
    )
    
    body_style = ParagraphStyle(
        'POBodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor('#4B5563')
    )

    body_bold = ParagraphStyle(
        'POBodyBoldCustom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor('#1F2937')
    )

    table_header_style = ParagraphStyle(
        'POTableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white
    )

    # 1. Header
    header_data = [
        [
            Paragraph("PurchaseHub", brand_style),
            Paragraph("PURCHASE ORDER", title_style)
        ],
        [
            Paragraph("Procurement & Vendor ERP System", body_style),
            Paragraph(f"<b>PO #:</b> {po_data['po_number']}<br/><b>Date:</b> {po_data['date']}", header_right_style)
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
    
    # 2. Billing / Shipping
    billing_data = [
        [
            Paragraph("<b>ISSUED TO (VENDOR):</b>", section_heading),
            Paragraph("<b>ISSUED BY (BUYER):</b>", section_heading)
        ],
        [
            Paragraph(
                f"<b>{po_data['vendor_name']}</b><br/>"
                f"Email: {po_data['vendor_email']}<br/>"
                f"Phone: {po_data['vendor_phone']}<br/>"
                f"GSTIN: {po_data['vendor_gst']}",
                body_style
            ),
            Paragraph(
                "<b>PurchaseHub Enterprise Ltd.</b><br/>"
                "Corporate Procurement Division<br/>"
                "100 ERP Way, Suite 400<br/>"
                "procurement@purchasehub.com",
                body_style
            )
        ]
    ]
    billing_table = Table(billing_data, colWidths=[260, 270])
    billing_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(billing_table)
    story.append(Spacer(1, 25))
    
    # 3. Line Items
    items_header = [
        Paragraph("Item / Product Specification", table_header_style),
        Paragraph("Quantity", table_header_style),
        Paragraph("Unit Price (Rs.)", table_header_style),
        Paragraph("Total Amount (Rs.)", table_header_style)
    ]
    
    item_row = [
        Paragraph(po_data['rfq_title'], body_style),
        Paragraph(str(po_data['quantity']), body_style),
        Paragraph(f"{po_data['unit_price']:,.2f}", body_style),
        Paragraph(f"{po_data['total']:,.2f}", body_style)
    ]
    
    items_data = [
        items_header,
        item_row,
        ["", "", "", ""],
        ["", "", Paragraph("Grand Total:", body_bold), Paragraph(f"Rs. {po_data['total']:,.2f}", body_bold)]
    ]
    
    items_table = Table(items_data, colWidths=[280, 70, 90, 90])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#714B67')), # Brand Purple header
        ('ALIGN', (1, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 8),
        ('LINEBELOW', (0, 0), (-1, 0), 1, colors.HexColor('#714B67')),
        ('LINEBELOW', (0, 1), (-1, 1), 0.5, colors.HexColor('#E5E7EB')),
        ('LINEABOVE', (2, 3), (3, 3), 0.5, colors.HexColor('#D1D5DB')),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 40))
    
    # 4. Footer
    footer_text = (
        "<b>Terms & Conditions:</b><br/>"
        "1. Please supply the items as per the agreed technical specifications and lead time.<br/>"
        "2. All shipments should reference the above Purchase Order Number.<br/>"
        "3. Invoices must be submitted via the ERP portal upon successful delivery.<br/><br/>"
        "<font color='#714B67'><b>Thank you for your business!</b></font>"
    )
    story.append(Paragraph(footer_text, body_style))
    
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes

def generate_procurement_report_pdf(report_data: dict) -> bytes:
    buffer = BytesIO()
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
    
    brand_style = ParagraphStyle(
        'RepBrandName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#714B67') # Odoo Brand Purple
    )
    
    title_style = ParagraphStyle(
        'RepTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        alignment=2,
        textColor=colors.HexColor('#1F2937')
    )
    
    header_right_style = ParagraphStyle(
        'RepHeaderRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        alignment=2,
        textColor=colors.HexColor('#4B5563')
    )
    
    section_heading = ParagraphStyle(
        'RepSectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=colors.HexColor('#714B67'),
        spaceAfter=6,
        spaceBefore=15
    )
    
    body_style = ParagraphStyle(
        'RepBodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor('#4B5563')
    )

    body_bold = ParagraphStyle(
        'RepBodyBoldCustom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=14,
        textColor=colors.HexColor('#1F2937')
    )

    table_header_style = ParagraphStyle(
        'RepTableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white
    )

    # 1. Header
    header_data = [
        [
            Paragraph("PurchaseHub", brand_style),
            Paragraph("PROCUREMENT REPORT", title_style)
        ],
        [
            Paragraph("Enterprise Procurement Module", body_style),
            Paragraph(f"<b>Date Generated:</b> {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M')}", header_right_style)
        ]
    ]
    header_table = Table(header_data, colWidths=[260, 270])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (1,1), (1,1), 10),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 15))
    
    # 2. KPI Section
    story.append(Paragraph("Key Performance Metrics", section_heading))
    kpi_data = [
        [
            Paragraph("<b>Total Vendors Registered:</b>", body_style),
            Paragraph(str(report_data['kpis']['total_vendors']), body_style),
            Paragraph("<b>Active Bidding RFQs:</b>", body_style),
            Paragraph(str(report_data['kpis']['active_rfqs']), body_style)
        ],
        [
            Paragraph("<b>Pending Manager Approvals:</b>", body_style),
            Paragraph(str(report_data['kpis']['pending_approvals']), body_style),
            Paragraph("<b>Purchase Orders Issued:</b>", body_style),
            Paragraph(str(report_data['kpis']['purchase_orders']), body_style)
        ],
        [
            Paragraph("<b>Invoices Generated:</b>", body_style),
            Paragraph(str(report_data['kpis']['invoices_generated']), body_style),
            Paragraph("<b>Accumulated Total Spend:</b>", body_bold),
            Paragraph(f"Rs. {report_data['kpis']['total_spend']:,.2f}", body_bold)
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[150, 100, 150, 110])
    kpi_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F9FAFB')),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('LINEABOVE', (0,0), (-1,0), 0.5, colors.HexColor('#E5E7EB')),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 15))
    
    # 3. Category Spend Section
    story.append(Paragraph("Procurement Spend by Category", section_heading))
    cat_header = [
        Paragraph("Product/Service Category", table_header_style),
        Paragraph("Total Spend Amount (Rs.)", table_header_style)
    ]
    cat_rows = []
    for item in report_data['category_spend']:
        cat_rows.append([
            Paragraph(item['category'], body_style),
            Paragraph(f"Rs. {item['spend']:,.2f}", body_style)
        ])
    
    cat_table_data = [cat_header] + (cat_rows if cat_rows else [["No spend recorded", "Rs. 0.00"]])
    cat_table = Table(cat_table_data, colWidths=[260, 250])
    cat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#714B67')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
    ]))
    story.append(cat_table)
    story.append(Spacer(1, 15))
    
    # 4. Vendor Performance Section
    story.append(Paragraph("Corporate Vendor Performance Ledger", section_heading))
    vendor_header = [
        Paragraph("Vendor Company Name", table_header_style),
        Paragraph("Quality Rating (0-5)", table_header_style),
        Paragraph("Quotes Submitted", table_header_style),
        Paragraph("Reliability Index", table_header_style)
    ]
    vendor_rows = []
    for item in report_data['vendor_performance']:
        score = item['rating'] * 20
        vendor_rows.append([
            Paragraph(item['company_name'], body_style),
            Paragraph(f"{item['rating']:.1f} / 5.0", body_style),
            Paragraph(f"{item['quote_count']} Bids", body_style),
            Paragraph(f"{score:.0f}%", body_bold)
        ])
        
    vendor_table_data = [vendor_header] + (vendor_rows if vendor_rows else [["No vendors listed", "-", "-", "-"]])
    vendor_table = Table(vendor_table_data, colWidths=[180, 110, 110, 110])
    vendor_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#714B67')),
        ('PADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
    ]))
    story.append(vendor_table)
    
    # Build Document
    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
