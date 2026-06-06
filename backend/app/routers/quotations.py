from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime

from backend.app.database import get_db
from backend.app import models, schemas
from backend.app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/quotations", tags=["Quotation Management"])

@router.post("/", response_model=schemas.QuotationResponse)
def submit_quotation(
    quote_in: schemas.QuotationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Vendor"]))
):
    # Check fields
    if quote_in.price <= 0:
        raise HTTPException(status_code=400, detail="Quotation price must be greater than 0.")
        
    if quote_in.delivery_days <= 0:
        raise HTTPException(status_code=400, detail="Delivery days must be greater than 0.")

    # Find the vendor profile associated with the current user
    vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
    if not vendor:
        raise HTTPException(
            status_code=403, 
            detail="Your user account is not associated with any active Vendor profile."
        )
        
    # Verify RFQ exists and is open
    rfq = db.query(models.RFQ).filter(models.RFQ.id == quote_in.rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
        
    # Validate deadline
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
        models.Quotation.vendor_id == vendor.id
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
            vendor_id=vendor.id,
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
        action=f"Vendor '{vendor.company_name}' submitted/updated a quotation for RFQ #{rfq.id} (Price: ${quote.price:,.2f})."
    )
    db.add(log)
    db.commit()
    db.refresh(quote)
    
    return quote

@router.get("/", response_model=List[schemas.QuotationResponse])
def list_quotations(
    rfq_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Quotation)
    
    if rfq_id:
        # Enforce that Vendors can only view their own quotations
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
        # Vendors see only their own quotes
        if current_user.role == "Vendor":
            vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
            if not vendor:
                return []
            query = query.filter(models.Quotation.vendor_id == vendor.id)
            
    return query.order_by(models.Quotation.price.asc()).all()

@router.get("/{quote_id}", response_model=schemas.QuotationResponse)
def get_quotation(
    quote_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    quote = db.query(models.Quotation).filter(models.Quotation.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
        
    # Restrict Vendors
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor or quote.vendor_id != vendor.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this quotation.")
            
    return quote

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
