from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.database import get_db
from backend.app import models, schemas
from backend.app.routers.auth import get_current_user, RoleChecker

router = APIRouter(prefix="/vendors", tags=["Vendor Management"])

@router.get("/", response_model=List[schemas.VendorResponse])
def list_vendors(
    search: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Any logged in user can view vendors
    query = db.query(models.Vendor)
    if search:
        query = query.filter(models.Vendor.company_name.ilike(f"%{search}%"))
    if category:
        query = query.filter(models.Vendor.category.ilike(f"%{category}%"))
    if status:
        query = query.filter(models.Vendor.status == status)
        
    return query.all()

@router.get("/{vendor_id}", response_model=schemas.VendorResponse)
def get_vendor(
    vendor_id: int, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor

@router.post("/", response_model=schemas.VendorResponse)
def create_vendor(
    vendor_in: schemas.VendorCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer"]))
):
    # Check if duplicate email
    dup = db.query(models.Vendor).filter(models.Vendor.email == vendor_in.email).first()
    if dup:
        raise HTTPException(status_code=400, detail="Vendor email is already registered.")

    vendor = models.Vendor(**vendor_in.dict())
    db.add(vendor)
    db.flush()
    
    # Audit log
    log = models.ActivityLog(
        user_id=current_user.id, 
        action=f"Created new Vendor profile: {vendor.company_name}"
    )
    db.add(log)
    db.commit()
    db.refresh(vendor)
    return vendor

@router.put("/{vendor_id}", response_model=schemas.VendorResponse)
def update_vendor(
    vendor_id: int,
    vendor_in: schemas.VendorUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    # Restrict edits to Admin, Procurement Officer, or if it's the vendor's own profile matching their email
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    is_authorized = (current_user.role in ["Admin", "Procurement Officer"]) or \
                    (current_user.role == "Vendor" and current_user.email == vendor.email)
                    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized to edit this vendor profile.")
        
    update_data = vendor_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vendor, field, value)
        
    db.flush()
    
    log = models.ActivityLog(
        user_id=current_user.id, 
        action=f"Updated Vendor profile '{vendor.company_name}' details."
    )
    db.add(log)
    db.commit()
    db.refresh(vendor)
    return vendor

@router.delete("/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer"]))
):
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    company_name = vendor.company_name
    db.delete(vendor)
    
    log = models.ActivityLog(
        user_id=current_user.id, 
        action=f"Deleted Vendor profile: {company_name}"
    )
    db.add(log)
    db.commit()
    return {"message": f"Vendor '{company_name}' deleted successfully."}

@router.post("/{vendor_id}/rate")
def rate_vendor(
    vendor_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer", "Manager"]))
):
    rating = payload.get("rating")
    if rating is None or not (0.0 <= float(rating) <= 5.0):
        raise HTTPException(status_code=400, detail="Rating must be a float between 0.0 and 5.0")
        
    vendor = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
        
    vendor.rating = float(rating)
    db.flush()
    
    log = models.ActivityLog(
        user_id=current_user.id,
        action=f"Updated rating for Vendor '{vendor.company_name}' to {rating}"
    )
    db.add(log)
    db.commit()
    return {"message": f"Rating updated to {rating}", "vendor_id": vendor_id, "rating": vendor.rating}
