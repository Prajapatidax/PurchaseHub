from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import datetime
import random

from backend.app.database import get_db
from backend.app import models, schemas
from backend.app.routers.auth import get_current_user, RoleChecker
from backend.app.services.email_mock import send_email

router = APIRouter(prefix="/approvals", tags=["Approval Workflow"])

@router.post("/{rfq_id}", response_model=schemas.ApprovalResponse)
def submit_approval(
    rfq_id: int,
    approval_in: schemas.ApprovalCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Manager"]))
):
    rfq = db.query(models.RFQ).filter(models.RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
        
    if rfq.status != "Approval Pending":
        raise HTTPException(
            status_code=400, 
            detail=f"RFQ is in status '{rfq.status}'. Only RFQs in 'Approval Pending' can be approved/rejected."
        )
        
    if not rfq.selected_quotation_id:
        raise HTTPException(
            status_code=400, 
            detail="Cannot approve RFQ. No winning quotation has been selected."
        )
        
    # Create approval record
    approval = models.Approval(
        rfq_id=rfq_id,
        manager_id=current_user.id,
        remarks=approval_in.remarks,
        status=approval_in.status
    )
    db.add(approval)
    db.flush()
    
    # Update RFQ status based on approval
    if approval_in.status == "Approved":
        rfq.status = "Approved"
        db.flush()
        
        # Get winning quotation details
        winning_quote = db.query(models.Quotation).filter(models.Quotation.id == rfq.selected_quotation_id).first()
        if not winning_quote:
            raise HTTPException(status_code=500, detail="Winning quotation record not found.")
            
        # 1. AUTO-GENERATE PURCHASE ORDER
        year = datetime.datetime.utcnow().year
        rand_num = random.randint(1000, 9999)
        po_number = f"PO-{year}-{rand_num}"
        
        po = models.PurchaseOrder(
            po_number=po_number,
            rfq_id=rfq.id,
            vendor_id=winning_quote.vendor_id,
            amount=winning_quote.price,
            status="Generated"
        )
        db.add(po)
        db.flush()
        
        # 2. AUTO-GENERATE ACTIVITY LOGS
        log_rfq = models.ActivityLog(
            user_id=current_user.id,
            action=f"Manager {current_user.name} APPROVED RFQ #{rfq.id}. Remarks: {approval_in.remarks}"
        )
        log_po = models.ActivityLog(
            user_id=None, # System generated
            action=f"System generated Purchase Order {po_number} for Vendor '{winning_quote.vendor.company_name}' (Amount: Rs. {winning_quote.price:,.2f})."
        )
        db.add(log_rfq)
        db.add(log_po)
        
        # 3. NOTIFY VENDOR BY EMAIL
        send_email(
            to_email=winning_quote.vendor.email,
            subject=f"VendorBridge - Purchase Order Issued ({po_number})",
            body=(
                f"Dear {winning_quote.vendor.company_name} Team,\n\n"
                f"We are pleased to inform you that your quotation for RFQ #{rfq.id} ({rfq.title}) has been approved!\n\n"
                f"We have generated Purchase Order {po_number} for the amount of Rs. {winning_quote.price:,.2f}.\n"
                f"Please log in to the Vendor Portal to accept the PO and submit your invoice.\n\n"
                f"Thank you,\nProcurement Team\nPurchaseHub Enterprise"
            )
        )
        
    else: # Rejected
        rfq.status = "Rejected"
        db.flush()
        
        log = models.ActivityLog(
            user_id=current_user.id,
            action=f"Manager {current_user.name} REJECTED RFQ #{rfq.id}. Remarks: {approval_in.remarks}"
        )
        db.add(log)
        
        # Notify creator (Procurement Officer) by email
        send_email(
            to_email=rfq.creator.email,
            subject=f"RFQ #{rfq.id} Rejected by Manager",
            body=(
                f"Hi {rfq.creator.name},\n\n"
                f"RFQ #{rfq.id} '{rfq.title}' has been rejected by Manager {current_user.name}.\n\n"
                f"Remarks: {approval_in.remarks}\n\n"
                f"Please review the RFQ and modify/resubmit if needed."
            )
        )
        
    db.commit()
    db.refresh(approval)
    return approval

@router.get("/history/{rfq_id}", response_model=List[schemas.ApprovalResponse])
def get_rfq_approval_history(
    rfq_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Retrieve all approvals related to this RFQ
    return db.query(models.Approval).filter(models.Approval.rfq_id == rfq_id).order_by(models.Approval.approved_at.desc()).all()
