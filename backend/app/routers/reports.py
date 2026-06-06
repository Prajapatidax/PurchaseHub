from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict
import datetime
from collections import defaultdict

from backend.app.database import get_db
from backend.app import models, schemas
from backend.app.routers.auth import get_current_user, RoleChecker
from backend.app.services.email_mock import get_sent_emails

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/", response_model=schemas.ReportsResponse)
def get_reports_and_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer", "Manager"]))
):
    # 1. Calculate KPIs
    total_vendors = db.query(models.Vendor).count()
    active_rfqs = db.query(models.RFQ).filter(models.RFQ.status.in_(["Open", "Quotation Received", "Approval Pending"])).count()
    pending_approvals = db.query(models.RFQ).filter(models.RFQ.status == "Approval Pending").count()
    total_pos = db.query(models.PurchaseOrder).count()
    total_invoices = db.query(models.Invoice).count()
    
    # Calculate Total Spend (sum of all PO amounts)
    spend_res = db.query(func.sum(models.PurchaseOrder.amount)).scalar()
    total_spend = float(spend_res) if spend_res is not None else 0.0
    
    kpis = {
        "total_vendors": total_vendors,
        "active_rfqs": active_rfqs,
        "pending_approvals": pending_approvals,
        "purchase_orders": total_pos,
        "invoices_generated": total_invoices,
        "total_spend": total_spend
    }
    
    # 2. Spend by Month (fetch all POs and group in Python to maintain database portability)
    pos = db.query(models.PurchaseOrder.created_at, models.PurchaseOrder.amount).all()
    monthly_map = defaultdict(float)
    
    # Default initial months to show on chart even if empty
    today = datetime.datetime.utcnow()
    for i in range(5, -1, -1):
        prev_month = today - datetime.timedelta(days=i*30)
        month_str = prev_month.strftime("%b %Y")
        monthly_map[month_str] = 0.0
        
    for po_created, po_amount in pos:
        month_str = po_created.strftime("%b %Y")
        monthly_map[month_str] += po_amount
        
    monthly_spend = [
        {"month": m, "spend": s} for m, s in sorted(
            monthly_map.items(), 
            key=lambda x: datetime.datetime.strptime(x[0], "%b %Y")
        )
    ]
    
    # 3. Spend by Category
    # Join PurchaseOrder -> Vendor
    category_res = db.query(
        models.Vendor.category, 
        func.sum(models.PurchaseOrder.amount)
    ).join(models.PurchaseOrder.vendor).group_by(models.Vendor.category).all()
    
    category_spend = []
    # If no data, populate a mock category so the frontend displays a chart
    if not category_res:
         category_spend = [{"category": "IT Hardware", "spend": 0.0}]
    else:
         for cat, amt in category_res:
              category_spend.append({"category": cat or "General", "spend": float(amt) if amt is not None else 0.0})
              
    # 4. Vendor Performance
    vendors = db.query(models.Vendor).all()
    vendor_performance = []
    for vendor in vendors:
        quote_count = db.query(models.Quotation).filter(models.Quotation.vendor_id == vendor.id).count()
        vendor_performance.append({
            "company_name": vendor.company_name,
            "rating": vendor.rating,
            "quote_count": quote_count
        })
        
    return {
        "kpis": kpis,
        "monthly_spend": monthly_spend,
        "vendor_performance": vendor_performance,
        "category_spend": category_spend
    }

# Helper endpoint to view activities & audits
@router.get("/activity-logs", response_model=List[schemas.ActivityLogResponse])
def get_activity_logs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer", "Manager"]))
):
    return db.query(models.ActivityLog).order_by(models.ActivityLog.timestamp.desc()).limit(100).all()

# Helper endpoint to retrieve sent mock emails
@router.get("/mock-emails")
def get_system_mock_emails(
    current_user: models.User = Depends(RoleChecker(["Admin", "Procurement Officer"]))
):
    return get_sent_emails()
