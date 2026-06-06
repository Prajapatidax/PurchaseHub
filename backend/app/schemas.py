from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field

# Token Schema
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_name: str
    user_id: int

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: Optional[bool] = False

# User Schemas
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    company_name: Optional[str] = None  # Relevant if registering a vendor user

class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Vendor Schemas
class VendorBase(BaseModel):
    company_name: str
    gst_number: str
    category: str
    email: EmailStr
    phone: str
    address: str
    rating: float = 0.0
    status: str = "Active"

class VendorCreate(BaseModel):
    company_name: str
    gst_number: str
    category: str
    email: EmailStr
    phone: str
    address: str

class VendorUpdate(BaseModel):
    company_name: Optional[str] = None
    gst_number: Optional[str] = None
    category: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    rating: Optional[float] = None
    status: Optional[str] = None

class VendorResponse(VendorBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class RFQBase(BaseModel):
    title: str
    description: str
    quantity: int
    deadline: datetime
    status: str
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None

class RFQCreate(BaseModel):
    title: str
    description: str
    quantity: int
    deadline: datetime
    assigned_vendor_ids: Optional[List[int]] = []
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None

class RFQUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    quantity: Optional[int] = None
    deadline: Optional[datetime] = None
    status: Optional[str] = None
    assigned_vendor_ids: Optional[List[int]] = None
    attachment_name: Optional[str] = None
    attachment_url: Optional[str] = None

class RFQResponse(RFQBase):
    id: int
    created_by: int
    created_at: datetime
    creator: UserResponse
    assigned_vendors: List[VendorResponse] = []

    class Config:
        from_attributes = True

# Quotation Schemas
class QuotationBase(BaseModel):
    price: float
    delivery_days: int
    notes: Optional[str] = None

class QuotationCreate(BaseModel):
    rfq_id: int
    price: float
    delivery_days: int
    notes: Optional[str] = None

class QuotationResponse(QuotationBase):
    id: int
    rfq_id: int
    vendor_id: int
    submitted_at: datetime
    vendor: VendorResponse

    class Config:
        from_attributes = True

# Approval Schemas
class ApprovalCreate(BaseModel):
    remarks: Optional[str] = None
    status: str  # Approved, Rejected

class ApprovalResponse(BaseModel):
    id: int
    rfq_id: int
    manager_id: int
    remarks: Optional[str] = None
    status: str
    approved_at: datetime
    manager: UserResponse

    class Config:
        from_attributes = True

# Purchase Order Schemas
class POResponse(BaseModel):
    id: int
    po_number: str
    rfq_id: int
    vendor_id: int
    amount: float
    status: str
    created_at: datetime
    vendor: VendorResponse

    class Config:
        from_attributes = True

# Invoice Schemas
class InvoiceCreate(BaseModel):
    po_id: int
    tax_rate: Optional[float] = 18.0  # Percentage, e.g. 18% GST

class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    po_id: int
    subtotal: float
    tax: float
    total: float
    status: str
    generated_at: datetime
    po: POResponse

    class Config:
        from_attributes = True

# Activity Log Schema
class ActivityLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    action: str
    timestamp: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# Report Schemas
class KPIResponse(BaseModel):
    total_vendors: int
    active_rfqs: int
    pending_approvals: int
    purchase_orders: int
    invoices_generated: int
    total_spend: float

class MonthlySpendTrendItem(BaseModel):
    month: str
    spend: float

class VendorPerformanceItem(BaseModel):
    company_name: str
    rating: float
    quote_count: int

class SpendByCategoryItem(BaseModel):
    category: str
    spend: float

class ReportsResponse(BaseModel):
    kpis: KPIResponse
    monthly_spend: List[MonthlySpendTrendItem]
    vendor_performance: List[VendorPerformanceItem]
    category_spend: List[SpendByCategoryItem]
