import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Table, Text
from sqlalchemy.orm import relationship
from backend.app.database import Base

# Association table for RFQ and Vendor assignment
rfq_vendor_association = Table(
    "rfq_vendor_association",
    Base.metadata,
    Column("rfq_id", Integer, ForeignKey("rfqs.id", ondelete="CASCADE"), primary_key=True),
    Column("vendor_id", Integer, ForeignKey("vendors.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False) # Admin, Procurement Officer, Manager, Vendor
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    rfqs_created = relationship("RFQ", back_populates="creator")
    approvals = relationship("Approval", back_populates="manager")
    logs = relationship("ActivityLog", back_populates="user")

class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    gst_number = Column(String, nullable=False)
    category = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    address = Column(Text, nullable=False)
    rating = Column(Float, default=0.0)
    status = Column(String, default="Active") # Active, Pending, Suspended
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    quotations = relationship("Quotation", back_populates="vendor")
    purchase_orders = relationship("PurchaseOrder", back_populates="vendor")
    rfqs = relationship("RFQ", secondary=rfq_vendor_association, back_populates="assigned_vendors")

class RFQ(Base):
    __tablename__ = "rfqs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False)
    deadline = Column(DateTime, nullable=False)
    status = Column(String, default="Draft") # Draft, Open, Quotation Received, Approval Pending, Approved, Rejected
    attachment_name = Column(String, nullable=True)
    attachment_url = Column(String, nullable=True)
    selected_quotation_id = Column(Integer, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="rfqs_created")
    assigned_vendors = relationship("Vendor", secondary=rfq_vendor_association, back_populates="rfqs")
    quotations = relationship("Quotation", back_populates="rfq", cascade="all, delete-orphan")
    approvals = relationship("Approval", back_populates="rfq", cascade="all, delete-orphan")
    purchase_orders = relationship("PurchaseOrder", back_populates="rfq", cascade="all, delete-orphan")

class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    price = Column(Float, nullable=False)
    delivery_days = Column(Integer, nullable=False)
    notes = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    rfq = relationship("RFQ", back_populates="quotations")
    vendor = relationship("Vendor", back_populates="quotations")

class Approval(Base):
    __tablename__ = "approvals"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    remarks = Column(Text, nullable=True)
    status = Column(String, nullable=False) # Approved, Rejected
    approved_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    rfq = relationship("RFQ", back_populates="approvals")
    manager = relationship("User", back_populates="approvals")

class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String, unique=True, index=True, nullable=False)
    rfq_id = Column(Integer, ForeignKey("rfqs.id", ondelete="CASCADE"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(String, default="Generated") # Generated, Sent, Accepted
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    rfq = relationship("RFQ", back_populates="purchase_orders")
    vendor = relationship("Vendor", back_populates="purchase_orders")
    invoices = relationship("Invoice", back_populates="po", cascade="all, delete-orphan")

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String, unique=True, index=True, nullable=False)
    po_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    subtotal = Column(Float, nullable=False)
    tax = Column(Float, nullable=False)
    total = Column(Float, nullable=False)
    status = Column(String, default="Unpaid") # Paid, Unpaid, Overdue
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    po = relationship("PurchaseOrder", back_populates="invoices")

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="logs")
