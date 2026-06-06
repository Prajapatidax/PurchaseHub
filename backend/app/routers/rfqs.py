from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import datetime

from backend.app.database import get_db
from backend.app import models, schemas
from backend.app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/rfqs", tags=["RFQ Management"])

@router.get("/", response_model=List[schemas.RFQResponse])
def list_rfqs(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.RFQ)
    
    # Role-based filtering: Vendors only see RFQs they are assigned to
    if current_user.role == "Vendor":
        # Find the vendor profile matching the user's email
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor:
            return [] # Unregistered vendor user sees nothing
        query = query.join(models.RFQ.assigned_vendors).filter(models.Vendor.id == vendor.id)
        
    if status_filter:
        query = query.filter(models.RFQ.status == status_filter)
        
    return query.order_by(models.RFQ.created_at.desc()).all()

@router.get("/{rfq_id}", response_model=schemas.RFQResponse)
def get_rfq(
    rfq_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    rfq = db.query(models.RFQ).filter(models.RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
        
    # Vendor permission check
    if current_user.role == "Vendor":
        vendor = db.query(models.Vendor).filter(models.Vendor.email == current_user.email).first()
        if not vendor or vendor not in rfq.assigned_vendors:
            raise HTTPException(status_code=403, detail="You are not authorized to view this RFQ.")
            
    return rfq

@router.post("/", response_model=schemas.RFQResponse)
def create_rfq(
    rfq_in: schemas.RFQCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer"]))
):
    # Prepare base RFQ fields
    rfq_data = rfq_in.dict(exclude={"assigned_vendor_ids"})
    rfq = models.RFQ(
        **rfq_data,
        status="Draft",
        created_by=current_user.id
    )
    
    # Assign vendors if list provided
    if rfq_in.assigned_vendor_ids:
        vendors = db.query(models.Vendor).filter(models.Vendor.id.in_(rfq_in.assigned_vendor_ids)).all()
        rfq.assigned_vendors = vendors
        
    db.add(rfq)
    db.flush()
    
    log = models.ActivityLog(
        user_id=current_user.id, 
        action=f"Created RFQ #{rfq.id}: '{rfq.title}' with {len(rfq.assigned_vendors)} assigned vendors."
    )
    db.add(log)
    db.commit()
    db.refresh(rfq)
    return rfq

@router.put("/{rfq_id}", response_model=schemas.RFQResponse)
def update_rfq(
    rfq_id: int,
    rfq_in: schemas.RFQUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer"]))
):
    rfq = db.query(models.RFQ).filter(models.RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
        
    update_data = rfq_in.dict(exclude_unset=True, exclude={"assigned_vendor_ids"})
    for field, value in update_data.items():
        setattr(rfq, field, value)
        
    # Update vendor assignments if provided
    if rfq_in.assigned_vendor_ids is not None:
        vendors = db.query(models.Vendor).filter(models.Vendor.id.in_(rfq_in.assigned_vendor_ids)).all()
        rfq.assigned_vendors = vendors
        
    db.flush()
    
    log = models.ActivityLog(
        user_id=current_user.id, 
        action=f"Updated RFQ #{rfq.id} details (Status: {rfq.status})."
    )
    db.add(log)
    db.commit()
    db.refresh(rfq)
    return rfq

@router.delete("/{rfq_id}")
def delete_rfq(
    rfq_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer"]))
):
    rfq = db.query(models.RFQ).filter(models.RFQ.id == rfq_id).first()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
        
    rfq_title = rfq.title
    db.delete(rfq)
    
    log = models.ActivityLog(
        user_id=current_user.id, 
        action=f"Deleted RFQ #{rfq_id}: '{rfq_title}'"
    )
    db.add(log)
    db.commit()
    return {"message": f"RFQ #{rfq_id} deleted successfully."}
