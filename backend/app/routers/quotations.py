from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime

from backend.app.database import get_db
from backend.app import models, schemas
from backend.app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/quotations", tags=["Quotation Management"])

def compute_quotation_status(q, rfq):
    if rfq:
        if rfq.selected_quotation_id == q.id:
            if rfq.status == "Approval Pending":
                return "Selected (Pending Approval)"
            elif rfq.status == "Approved":
                return "Won (Approved)"
            elif rfq.status == "Rejected":
                return "Rejected"
            else:
                return "Selected"
        elif rfq.selected_quotation_id is not None:
            return "Not Selected"
        else:
            return "Pending Review"
    return "Pending Review"

@router.post("/", response_model=schemas.QuotationResponse)
def submit_quotation(
    quote_in: schemas.QuotationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Vendor", "Admin", "Procurement Officer"]))
):
    # Check fields
    if quote_in.price <= 0:
        raise HTTPException(status_code=400, detail="Quotation price must be greater than 0.")
        
    if quote_in.delivery_days <= 0:
        raise HTTPException(status_code=400, detail="Delivery days must be greater than 0.")

    # Find or validate vendor
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor:
            raise HTTPException(
                status_code=403, 
                detail="Your user account is not associated with any active Vendor profile."
            )
        vendor_id = vendor.id
    else:
        if not quote_in.vendor_id:
            raise HTTPException(status_code=400, detail="vendor_id is required for administrative quotation creation.")
        vendor = db.query(models.Vendor).filter(models.Vendor.id == quote_in.vendor_id).first()
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found.")
        vendor_id = quote_in.vendor_id
        
    # Verify RFQ exists
    rfq = db.query(models.RFQ).filter(models.RFQ.id == quote_in.rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
        
    # Validate deadline for Vendor only
    if current_user.role == "Vendor":
        rfq_deadline_naive = rfq.deadline.replace(tzinfo=None)
        if datetime.datetime.utcnow() >= rfq_deadline_naive:
            raise HTTPException(status_code=400, detail="Cannot submit quotation. The bidding deadline for this RFQ has passed.")

        if rfq.status not in ["Open", "Quotation Received"]:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot submit quotation. RFQ is in status '{rfq.status}' (must be Open)."
            )
            
        if vendor not in rfq.assigned_vendors:
            raise HTTPException(
                status_code=403, 
                detail="You are not authorized to submit quotations for this RFQ (not assigned)."
            )
        
    # Check if quotation already exists for this vendor
    existing = db.query(models.Quotation).filter(
        models.Quotation.rfq_id == quote_in.rfq_id,
        models.Quotation.vendor_id == vendor_id
    ).first()
    
    if existing:
        # Instead of failing, update it
        existing.price = quote_in.price
        existing.delivery_days = quote_in.delivery_days
        existing.notes = quote_in.notes
        existing.submitted_at = datetime.datetime.utcnow()
        db.flush()
        quote = existing
    else:
        # Create new quote
        quote = models.Quotation(
            rfq_id=quote_in.rfq_id,
            vendor_id=vendor_id,
            price=quote_in.price,
            delivery_days=quote_in.delivery_days,
            notes=quote_in.notes
        )
        db.add(quote)
        db.flush()
        
    # Update RFQ status to 'Quotation Received'
    if rfq.status == "Open":
        rfq.status = "Quotation Received"
        db.flush()
        
    # Log activity
    log = models.ActivityLog(
        user_id=current_user.id,
        action=f"User '{current_user.name}' submitted/updated quotation #{quote.id} for RFQ #{rfq.id} (Price: Rs. {quote.price:,.2f})."
    )
    db.add(log)
    db.commit()
    db.refresh(quote)
    
    quote.status = compute_quotation_status(quote, rfq)
    return quote

@router.get("/", response_model=List[schemas.QuotationResponse])
def list_quotations(
    rfq_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Quotation)
    
    if rfq_id:
        if current_user.role == "Vendor":
            vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
            if not vendor:
                return []
            query = query.filter(
                models.Quotation.rfq_id == rfq_id,
                models.Quotation.vendor_id == vendor.id
            )
        else:
            query = query.filter(models.Quotation.rfq_id == rfq_id)
    else:
        if current_user.role == "Vendor":
            vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
            if not vendor:
                return []
            query = query.filter(models.Quotation.vendor_id == vendor.id)
            
    results = query.order_by(models.Quotation.price.asc()).all()
    for q in results:
        q.status = compute_quotation_status(q, q.rfq)
    return results

@router.get("/{quote_id}", response_model=schemas.QuotationResponse)
def get_quotation(
    quote_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    quote = db.query(models.Quotation).filter(models.Quotation.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
        
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor or quote.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this quotation.")
            
    quote.status = compute_quotation_status(quote, quote.rfq)
    return quote

@router.put("/{quote_id}", response_model=schemas.QuotationResponse)
def update_quotation(
    quote_id: int,
    quote_in: schemas.QuotationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    quote = db.query(models.Quotation).filter(models.Quotation.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
        
    # Check permissions
    is_admin_officer = current_user.role in ["Admin", "Procurement Officer"]
    is_owner_vendor = False
    
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if vendor and quote.vendor_id == vendor.id:
            is_owner_vendor = True
            
    if not (is_admin_officer or is_owner_vendor):
        raise HTTPException(status_code=403, detail="Not authorized to edit this quotation.")
        
    # Validations
    if quote_in.price is not None and quote_in.price <= 0:
        raise HTTPException(status_code=400, detail="Quotation price must be greater than 0.")
    if quote_in.delivery_days is not None and quote_in.delivery_days <= 0:
        raise HTTPException(status_code=400, detail="Delivery days must be greater than 0.")
        
    rfq = db.query(models.RFQ).filter(models.RFQ.id == quote.rfq_id).first()
    if is_owner_vendor and rfq:
        # Check deadline for vendor
        rfq_deadline_naive = rfq.deadline.replace(tzinfo=None)
        if datetime.datetime.utcnow() >= rfq_deadline_naive:
            raise HTTPException(status_code=400, detail="Cannot edit quotation. The bidding deadline for this RFQ has passed.")
            
    # Update fields
    update_data = quote_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(quote, field, value)
        
    db.flush()
    
    log = models.ActivityLog(
        user_id=current_user.id,
        action=f"Updated Quotation #{quote.id} (Price: Rs. {quote.price:,.2f}) for RFQ #{quote.rfq_id}."
    )
    db.add(log)
    db.commit()
    db.refresh(quote)
    
    quote.status = compute_quotation_status(quote, rfq)
    return quote

@router.delete("/{quote_id}")
def delete_quotation(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    quote = db.query(models.Quotation).filter(models.Quotation.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
        
    # Check permissions
    is_admin_officer = current_user.role in ["Admin", "Procurement Officer"]
    is_owner_vendor = False
    
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if vendor and quote.vendor_id == vendor.id:
            is_owner_vendor = True
            
    if not (is_admin_officer or is_owner_vendor):
        raise HTTPException(status_code=403, detail="Not authorized to delete this quotation.")
        
    # Block deletion if selected as the winning bid
    rfq = db.query(models.RFQ).filter(models.RFQ.id == quote.rfq_id).first()
    if rfq and rfq.selected_quotation_id == quote.id:
        raise HTTPException(status_code=400, detail="Cannot delete this quotation as it is selected as the winning bid.")
        
    db.delete(quote)
    
    log = models.ActivityLog(
        user_id=current_user.id,
        action=f"Deleted Quotation #{quote_id} for RFQ #{quote.rfq_id}."
    )
    db.add(log)
    db.commit()
    return {"message": f"Quotation #{quote_id} deleted successfully."}

@router.post("/select-winner")
def select_winning_quotation(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer"]))
):
    rfq_id = payload.get("rfq_id")
    quote_id = payload.get("quote_id")
    
    if not rfq_id or not quote_id:
        raise HTTPException(status_code=400, detail="rfq_id and quote_id are required.")
        
    rfq = db.query(models.RFQ).filter(models.RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
        
    quote = db.query(models.Quotation).filter(models.Quotation.id == quote_id).first()
    if not quote or quote.rfq_id != rfq_id:
        raise HTTPException(status_code=404, detail="Quotation not found or does not belong to this RFQ.")
        
    # Set winner and status
    rfq.selected_quotation_id = quote_id
    rfq.status = "Approval Pending"
    db.flush()
    
    # Audit log
    log = models.ActivityLog(
        user_id=current_user.id,
        action=f"Selected Quotation #{quote_id} from Vendor '{quote.vendor.company_name}' as winner for RFQ #{rfq.id}. Status changed to Approval Pending."
    )
    db.add(log)
    db.commit()
    
    return {
        "message": "Winning quotation selected and submitted for Approval.",
        "rfq_id": rfq.id,
        "status": rfq.status,
        "selected_quotation_id": rfq.selected_quotation_id
    }
