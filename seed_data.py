import datetime
from backend.app.database import engine, SessionLocal, Base
from backend.app import models, security

def seed_database():
    print("Initializing Database Seeding...")
    
    # Drop and recreate all tables to ensure clean slate
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # 1. CREATE USERS
        print("Creating User Accounts...")
        users = [
            models.User(
                name="System Administrator",
                email="admin@vendorbridge.com",
                password_hash=security.hash_password("adminpassword"),
                role="Admin"
            ),
            models.User(
                name="Sarah Jenkins (Procurement)",
                email="officer@vendorbridge.com",
                password_hash=security.hash_password("officerpassword"),
                role="Procurement Officer"
            ),
            models.User(
                name="Marcus Vance (Finance Manager)",
                email="manager@vendorbridge.com",
                password_hash=security.hash_password("managerpassword"),
                role="Manager"
            ),
            # Vendor Users
            models.User(
                name="Dell Enterprise Account",
                email="bids@dell.com",
                password_hash=security.hash_password("dellpassword"),
                role="Vendor"
            ),
            models.User(
                name="HP Corporate Sales",
                email="partners@hp.com",
                password_hash=security.hash_password("hppassword"),
                role="Vendor"
            ),
            models.User(
                name="Lenovo Business Bids",
                email="enterprise@lenovo.com",
                password_hash=security.hash_password("lenovopassword"),
                role="Vendor"
            )
        ]
        db.add_all(users)
        db.flush() # Populate User IDs
        
        officer_id = users[1].id
        manager_id = users[2].id
        dell_user_id = users[3].id
        hp_user_id = users[4].id
        lenovo_user_id = users[5].id

        # 2. CREATE VENDORS
        print("Creating Vendor Profiles...")
        vendors = [
            models.Vendor(
                company_name="Dell Technologies",
                gst_number="GST-DL849203",
                category="IT Hardware",
                email="bids@dell.com",
                phone="+1 (800) 555-1234",
                address="One Dell Way, Round Rock, TX 78682, USA",
                rating=4.8,
                status="Active"
            ),
            models.Vendor(
                company_name="HP Enterprise",
                gst_number="GST-HP203948",
                category="IT Infrastructure",
                email="partners@hp.com",
                phone="+1 (800) 555-5678",
                address="1701 E Mossy Oaks Rd, Spring, TX 77389, USA",
                rating=4.9,
                status="Active"
            ),
            models.Vendor(
                company_name="Lenovo Business",
                gst_number="GST-LN482910",
                category="IT Hardware",
                email="enterprise@lenovo.com",
                phone="+1 (800) 555-9012",
                address="8001 Development Dr, Morrisville, NC 27560, USA",
                rating=4.7,
                status="Active"
            )
        ]
        db.add_all(vendors)
        db.flush() # Populate Vendor IDs
        
        dell_vendor = vendors[0]
        hp_vendor = vendors[1]
        lenovo_vendor = vendors[2]

        # 3. CREATE RFQ
        print("Creating RFQ '50 Business Laptops'...")
        deadline_date = datetime.datetime.utcnow() + datetime.timedelta(days=14)
        rfq = models.RFQ(
            title="50 Business Laptops",
            description=(
                "Requirement for 50 high-performance enterprise business laptops for our engineering division.\n"
                "Minimum Specifications:\n"
                "- Intel Core i7 or AMD Ryzen 7 processor (latest gen)\n"
                "- 32GB DDR5 RAM\n"
                "- 1TB NVMe PCIe SSD\n"
                "- 14-inch Full HD display with webcam\n"
                "- Backlit keyboard, fingerprint reader\n"
                "- 3-Year On-Site Support Warranty"
            ),
            quantity=50,
            deadline=deadline_date,
            status="Approved", # Starts as Approved with PO generated
            attachment_name="Engineering_Laptop_Specs_v1.pdf",
            attachment_url="https://vendorbridge-assets.s3.amazonaws.com/specs/Engineering_Laptop_Specs_v1.pdf",
            created_by=officer_id
        )
        
        # Link assigned vendors
        rfq.assigned_vendors = [dell_vendor, hp_vendor, lenovo_vendor]
        db.add(rfq)
        db.flush()

        # 4. CREATE VENDOR QUOTATIONS
        print("Submitting Quotations (Dell, HP, Lenovo)...")
        quotes = [
            models.Quotation(
                rfq_id=rfq.id,
                vendor_id=dell_vendor.id,
                price=50000.0,
                delivery_days=10,
                notes="Dell Latitude 5440 Enterprise Edition. Meets all specs. Includes ProSupport Plus warranty.",
                submitted_at=datetime.datetime.utcnow() - datetime.timedelta(days=2)
            ),
            models.Quotation(
                rfq_id=rfq.id,
                vendor_id=hp_vendor.id,
                price=47000.0,
                delivery_days=7,
                notes="HP EliteBook 840 G10 Business Laptop. Matches requirements. Offer includes free premium laptop sleeves.",
                submitted_at=datetime.datetime.utcnow() - datetime.timedelta(days=2, hours=4)
            ),
            models.Quotation(
                rfq_id=rfq.id,
                vendor_id=lenovo_vendor.id,
                price=49000.0,
                delivery_days=12,
                notes="Lenovo ThinkPad T14 Gen 4. Carbon fiber design. Renowned reliability and keyboard.",
                submitted_at=datetime.datetime.utcnow() - datetime.timedelta(days=1)
            )
        ]
        db.add_all(quotes)
        db.flush() # Populate Quote IDs
        
        dell_quote = quotes[0]
        hp_quote = quotes[1]
        lenovo_quote = quotes[2]
        
        # Procurement Officer selects HP as winner
        rfq.selected_quotation_id = hp_quote.id
        db.flush()

        # 5. CREATE APPROVAL RECORD
        print("Creating Manager Approval for HP Enterprise...")
        approval = models.Approval(
            rfq_id=rfq.id,
            manager_id=manager_id,
            remarks="HP Enterprise matches all engineering specifications, offers the lowest bid ($47,000) and the fastest delivery timeline (7 days). Approved.",
            status="Approved",
            approved_at=datetime.datetime.utcnow() - datetime.timedelta(hours=18)
        )
        db.add(approval)
        db.flush()

        # 6. CREATE PURCHASE ORDER
        print("Creating Purchase Order...")
        po = models.PurchaseOrder(
            po_number="PO-2026-1049",
            rfq_id=rfq.id,
            vendor_id=hp_vendor.id,
            amount=47000.0,
            status="Accepted", # Accepted to allow invoice generation in seed
            created_at=datetime.datetime.utcnow() - datetime.timedelta(hours=17)
        )
        db.add(po)
        db.flush()

        # 7. CREATE INVOICE
        print("Generating Invoice...")
        invoice = models.Invoice(
            invoice_number="INV-2026-9281",
            po_id=po.id,
            subtotal=47000.0,
            tax=8460.0, # 18% GST of 47,000
            total=55460.0,
            status="Unpaid",
            generated_at=datetime.datetime.utcnow() - datetime.timedelta(hours=16)
        )
        db.add(invoice)
        db.flush()

        # 8. ACTIVITY LOGS (AUDIT TRAIL)
        print("Populating Activity Logs...")
        logs = [
            models.ActivityLog(user_id=officer_id, action="Created RFQ #1: '50 Business Laptops' and assigned Dell, HP, and Lenovo.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=3)),
            models.ActivityLog(user_id=dell_user_id, action="Vendor 'Dell Technologies' submitted Quotation for RFQ #1 ($50,000.00).", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=2)),
            models.ActivityLog(user_id=hp_user_id, action="Vendor 'HP Enterprise' submitted Quotation for RFQ #1 ($47,000.00).", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=2, hours=4)),
            models.ActivityLog(user_id=lenovo_user_id, action="Vendor 'Lenovo Business' submitted Quotation for RFQ #1 ($49,000.00).", timestamp=datetime.datetime.utcnow() - datetime.timedelta(days=1)),
            models.ActivityLog(user_id=officer_id, action="Procurement Officer selected HP Enterprise's quotation ($47,000.00) as the winner and submitted it for Manager Approval.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=20)),
            models.ActivityLog(user_id=manager_id, action="Manager Marcus Vance approved RFQ #1. Remarks: HP matches all specs, offers the lowest bid and fastest delivery.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=18)),
            models.ActivityLog(user_id=None, action="System automatically generated Purchase Order PO-2026-1049 for HP Enterprise.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=17)),
            models.ActivityLog(user_id=hp_user_id, action="Vendor 'HP Enterprise' accepted Purchase Order PO-2026-1049.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=16, minutes=30)),
            models.ActivityLog(user_id=hp_user_id, action="Vendor 'HP Enterprise' generated Invoice INV-2026-9281 for PO PO-2026-1049.", timestamp=datetime.datetime.utcnow() - datetime.timedelta(hours=16))
        ]
        db.add_all(logs)
        
        db.commit()
        print("Database Seed Completed Successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
