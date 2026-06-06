from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.database import get_db
from backend.app import models, schemas
from backend.app.routers.auth import get_current_user, RoleChecker
from backend.app.services.pdf_generator import generate_po_pdf

router = APIRouter(prefix="/purchase-orders", tags=["Purchase Orders"])

@router.get("/", response_model=List[schemas.POResponse])
def list_purchase_orders(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.PurchaseOrder)
    
    # Role-based restriction: Vendors only see POs issued to them
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor:
            return []
        query = query.filter(models.PurchaseOrder.vendor_id == vendor.id)
        
    if status_filter:
        query = query.filter(models.PurchaseOrder.status == status_filter)
        
    return query.order_by(models.PurchaseOrder.created_at.desc()).all()

@router.get("/{po_id}", response_model=schemas.POResponse)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    # Vendor restriction
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor or po.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this Purchase Order.")
            
    return po

@router.put("/{po_id}/status")
def update_po_status(
    po_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_status = payload.get("status")
    if new_status not in ["Generated", "Sent", "Accepted"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be 'Generated', 'Sent', or 'Accepted'.")
        
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    # Permission check:
    # Procurement Officers can change to Sent.
    # Vendors can change to Accepted (accepting the PO).
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor or po.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this Purchase Order.")
        if new_status != "Accepted":
            raise HTTPException(status_code=400, detail="Vendors are only allowed to set status to 'Accepted'.")
    elif current_user.role not in ["Admin", "Procurement Officer"]:
        raise HTTPException(status_code=403, detail="Not authorized to update PO status.")
        
    old_status = po.status
    po.status = new_status
    db.flush()
    
    log = models.ActivityLog(
        user_id=current_user.id,
        action=f"Purchase Order {po.po_number} status updated from '{old_status}' to '{new_status}'."
    )
    db.add(log)
    db.commit()
    
    return {"message": "Purchase Order status updated successfully.", "po_id": po.id, "status": po.status}

@router.get("/{po_id}/download")
def download_po_pdf(
    po_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
        
    # Vendor restriction
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor or po.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Not authorized to download this Purchase Order.")
            
    # Gather PO details for PDF compiling
    rfq = db.query(models.RFQ).filter(models.RFQ.id == po.rfq_id).first()
    rfq_title = rfq.title if rfq else "Business Procurement Items"
    quantity = rfq.quantity if rfq else 1
    
    po_data = {
        "po_number": po.po_number,
        "date": po.created_at.strftime("%Y-%m-%d"),
        "vendor_name": po.vendor.company_name,
        "vendor_email": po.vendor.email,
        "vendor_phone": po.vendor.phone,
        "vendor_gst": po.vendor.gst_number,
        "rfq_title": rfq_title,
        "quantity": quantity,
        "unit_price": po.amount / quantity,
        "total": po.amount
    }
    
    pdf_bytes = generate_po_pdf(po_data)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=purchase_order_{po.po_number}.pdf"
        }
    )
