from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime
import random
import io

from backend.app.database import get_db
from backend.app import models, schemas
from backend.app.routers.auth import get_current_user, RoleChecker
from backend.app.services.pdf_generator import generate_invoice_pdf
from backend.app.services.email_mock import send_email

router = APIRouter(prefix="/invoices", tags=["Invoice Module"])

@router.post("/", response_model=schemas.InvoiceResponse)
def generate_invoice(
    invoice_in: schemas.InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Retrieve PO details
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == invoice_in.po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    # Check if invoice already exists for this PO
    existing_inv = db.query(models.Invoice).filter(models.Invoice.po_id == invoice_in.po_id).first()
    if existing_inv:
        raise HTTPException(status_code=400, detail=f"Invoice has already been generated for this PO ({existing_inv.invoice_number}).")
        
    # Security: Vendors can only generate invoices for their own POs
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor or po.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Not authorized to generate invoice for this Purchase Order.")
            
    # Typically PO needs to be Accepted before invoice generation
    if po.status != "Accepted":
         raise HTTPException(
             status_code=400, 
             detail=f"Cannot generate invoice. Purchase Order status is '{po.status}' (must be 'Accepted' by vendor)."
         )
         
    # Perform calculations
    subtotal = po.amount
    tax_rate = invoice_in.tax_rate if invoice_in.tax_rate is not None else 18.0
    tax = subtotal * (tax_rate / 100.0)
    total = subtotal + tax
    
    # Generate unique invoice number
    year = datetime.datetime.utcnow().year
    rand_num = random.randint(1000, 9999)
    invoice_number = f"INV-{year}-{rand_num}"
    
    # Save Invoice
    invoice = models.Invoice(
        invoice_number=invoice_number,
        po_id=po.id,
        subtotal=subtotal,
        tax=tax,
        total=total,
        status="Unpaid"
    )
    db.add(invoice)
    db.flush()
    
    # Update RFQ status to 'Invoice Generated' or PO status
    rfq = db.query(models.RFQ).filter(models.RFQ.id == po.rfq_id).first()
    if rfq:
        rfq.status = "Approved" # Kept at approved, or we can mark workflow log
        
    # Log activity
    log = models.ActivityLog(
        user_id=current_user.id,
        action=f"Generated Invoice {invoice_number} for PO {po.po_number} (Total: ${total:,.2f}, Tax rate: {tax_rate}%)."
    )
    db.add(log)
    
    # Send email notification
    send_email(
        to_email=po.vendor.email,
        subject=f"VendorBridge - Invoice Generated ({invoice_number})",
        body=(
            f"Dear {po.vendor.company_name} Team,\n\n"
            f"Invoice {invoice_number} has been successfully generated for Purchase Order {po.po_number}.\n\n"
            f"Invoice Details:\n"
            f"- Subtotal: ${subtotal:,.2f}\n"
            f"- Tax (GST {tax_rate}%): ${tax:,.2f}\n"
            f"- Grand Total: ${total:,.2f}\n\n"
            f"You can download the PDF copy from the VendorBridge portal.\n\n"
            f"Best regards,\nAccounts Department\nPurchaseHub Enterprise"
        )
    )
    db.commit()
    db.refresh(invoice)
    return invoice

@router.get("/", response_model=List[schemas.InvoiceResponse])
def list_invoices(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Invoice).join(models.Invoice.po)
    
    # Role-based restriction: Vendors only see their own invoices
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor:
            return []
        query = query.filter(models.PurchaseOrder.vendor_id == vendor.id)
        
    return query.order_by(models.Invoice.generated_at.desc()).all()

@router.get("/{invoice_id}", response_model=schemas.InvoiceResponse)
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    # Vendor restriction
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor or invoice.po.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this invoice.")
            
    return invoice

@router.get("/{invoice_id}/download")
def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    invoice = db.query(models.Invoice).filter(models.Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    # Vendor restriction
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor or invoice.po.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Not authorized to download this invoice.")
            
    # Gather invoice details for PDF compiling
    rfq = db.query(models.RFQ).filter(models.RFQ.id == invoice.po.rfq_id).first()
    rfq_title = rfq.title if rfq else "Business Procurement Items"
    quantity = rfq.quantity if rfq else 1
    
    invoice_data = {
        "invoice_number": invoice.invoice_number,
        "date": invoice.generated_at.strftime("%Y-%m-%d"),
        "po_number": invoice.po.po_number,
        "vendor_name": invoice.po.vendor.company_name,
        "vendor_email": invoice.po.vendor.email,
        "vendor_phone": invoice.po.vendor.phone,
        "vendor_gst": invoice.po.vendor.gst_number,
        "rfq_title": rfq_title,
        "quantity": quantity,
        "unit_price": invoice.subtotal / quantity,
        "subtotal": invoice.subtotal,
        "tax": invoice.tax,
        "total": invoice.total
    }
    
    # Generate PDF bytes
    pdf_bytes = generate_invoice_pdf(invoice_data)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice_{invoice.invoice_number}.pdf"
        }
    )
