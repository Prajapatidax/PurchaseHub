import os
import sys
import unittest
import datetime
from fastapi.testclient import TestClient

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.app.main import app
from backend.app.database import engine, SessionLocal, Base
from backend.app import models, security
from seed_data import seed_database

class TestProcurementLifecycle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Seed the database to ensure clean, consistent state
        seed_database()
        cls.client = TestClient(app)
        cls.db = SessionLocal()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def get_token(self, email, password):
        response = self.client.post("/api/auth/login", json={"email": email, "password": password})
        self.assertEqual(response.status_code, 200)
        return response.json()["access_token"]

    def test_01_authentication_flow(self):
        print("\n--- Running Test 01: Authentication Flow ---")
        # 1. Invalid login
        response = self.client.post("/api/auth/login", json={"email": "admin@vendorbridge.com", "password": "wrongpassword"})
        self.assertEqual(response.status_code, 401)
        self.assertIn("detail", response.json())

        # 2. Valid Admin login
        admin_token = self.get_token("admin@vendorbridge.com", "adminpassword")
        self.assertTrue(admin_token)

        # 3. Forgot Password -> Reset Password Flow
        # Mock calling forgot-password
        response = self.client.post("/api/auth/forgot-password", json={"email": "officer@vendorbridge.com"})
        self.assertEqual(response.status_code, 200)
        
        # Check that we can reset the password with mock_reset_token
        reset_payload = {
            "email": "officer@vendorbridge.com",
            "token": "mock_reset_token",
            "new_password": "newofficerpassword"
        }
        response = self.client.post("/api/auth/reset-password", json=reset_payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Password has been reset successfully.")

        # Test login with new password
        new_token = self.get_token("officer@vendorbridge.com", "newofficerpassword")
        self.assertTrue(new_token)

        # Revert password back for officer to keep tests isolated/repeatable
        reset_payload["new_password"] = "officerpassword"
        response = self.client.post("/api/auth/reset-password", json=reset_payload)
        self.assertEqual(response.status_code, 200)

    def test_02_vendor_duplicate_and_status_validations(self):
        print("\n--- Running Test 02: Vendor Duplication and Status Flow ---")
        admin_token = self.get_token("admin@vendorbridge.com", "adminpassword")
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Try to create duplicate vendor (same email)
        dup_email_payload = {
            "company_name": "Unique Name LLC",
            "gst_number": "GST-UQ999999",
            "category": "IT Hardware",
            "email": "bids@dell.com",  # Already exists in seeds
            "phone": "+1 (800) 111-2222",
            "address": "123 Main St"
        }
        response = self.client.post("/api/vendors/", json=dup_email_payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("email is already registered", response.json()["detail"])

        # 2. Try to create duplicate vendor (same company_name)
        dup_name_payload = {
            "company_name": "Dell Technologies",  # Already exists in seeds
            "gst_number": "GST-UQ999999",
            "category": "IT Hardware",
            "email": "unique@dell.com",
            "phone": "+1 (800) 111-2222",
            "address": "123 Main St"
        }
        response = self.client.post("/api/vendors/", json=dup_name_payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("company name is already registered", response.json()["detail"])

        # 3. Try to create duplicate vendor (same GSTIN)
        dup_gst_payload = {
            "company_name": "Unique Name LLC",
            "gst_number": "GST-DL849203",  # Already exists in seeds (Dell)
            "category": "IT Hardware",
            "email": "unique@dell.com",
            "phone": "+1 (800) 111-2222",
            "address": "123 Main St"
        }
        response = self.client.post("/api/vendors/", json=dup_gst_payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("GSTIN number is already registered", response.json()["detail"])

        # 4. Try updating an existing vendor to a duplicate company_name
        hp_vendor = self.db.query(models.Vendor).filter(models.Vendor.company_name == "HP Enterprise").first()
        self.assertIsNotNone(hp_vendor)
        
        update_payload = {
            "company_name": "Dell Technologies"  # Try to rename HP Enterprise to Dell Technologies
        }
        response = self.client.put(f"/api/vendors/{hp_vendor.id}", json=update_payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("company name is already registered", response.json()["detail"])

        # 5. Successfully update vendor status to Suspended and verify
        update_status_payload = {
            "status": "Suspended"
        }
        response = self.client.put(f"/api/vendors/{hp_vendor.id}", json=update_status_payload, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "Suspended")

        # Set status back to Active
        update_status_payload["status"] = "Active"
        response = self.client.put(f"/api/vendors/{hp_vendor.id}", json=update_status_payload, headers=headers)
        self.assertEqual(response.status_code, 200)

    def test_03_rfq_validations(self):
        print("\n--- Running Test 03: RFQ Creation Validations ---")
        officer_token = self.get_token("officer@vendorbridge.com", "officerpassword")
        headers = {"Authorization": f"Bearer {officer_token}"}

        # 1. Invalid quantity (<= 0)
        rfq_payload = {
            "title": "Test RFQ Keyboard",
            "description": "High quality keyboards",
            "quantity": 0,
            "deadline": (datetime.datetime.utcnow() + datetime.timedelta(days=7)).isoformat(),
            "assigned_vendor_ids": []
        }
        response = self.client.post("/api/rfqs/", json=rfq_payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("quantity must be greater than 0", response.json()["detail"])

        # 2. Invalid deadline (in past)
        rfq_payload["quantity"] = 100
        rfq_payload["deadline"] = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat()
        response = self.client.post("/api/rfqs/", json=rfq_payload, headers=headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("deadline must be in the future", response.json()["detail"])

        # 3. Valid RFQ creation
        dell = self.db.query(models.Vendor).filter(models.Vendor.company_name == "Dell Technologies").first()
        hp = self.db.query(models.Vendor).filter(models.Vendor.company_name == "HP Enterprise").first()
        
        rfq_payload["deadline"] = (datetime.datetime.utcnow() + datetime.timedelta(days=5)).isoformat()
        rfq_payload["assigned_vendor_ids"] = [dell.id, hp.id]
        response = self.client.post("/api/rfqs/", json=rfq_payload, headers=headers)
        self.assertEqual(response.status_code, 200)
        
        rfq_data = response.json()
        self.assertEqual(rfq_data["status"], "Draft")
        self.assertEqual(len(rfq_data["assigned_vendors"]), 2)

    def test_04_quotation_validations_and_submission(self):
        print("\n--- Running Test 04: Quotation Submission Validations ---")
        # Let's create an open RFQ first
        officer_token = self.get_token("officer@vendorbridge.com", "officerpassword")
        officer_headers = {"Authorization": f"Bearer {officer_token}"}
        
        dell = self.db.query(models.Vendor).filter(models.Vendor.company_name == "Dell Technologies").first()
        
        rfq_payload = {
            "title": "RFQ for Monitored Bid",
            "description": "50 Dell Monitors",
            "quantity": 50,
            "deadline": (datetime.datetime.utcnow() + datetime.timedelta(days=2)).isoformat(),
            "assigned_vendor_ids": [dell.id]
        }
        rfq_resp = self.client.post("/api/rfqs/", json=rfq_payload, headers=officer_headers)
        self.assertEqual(rfq_resp.status_code, 200)
        rfq_id = rfq_resp.json()["id"]

        # Publish the RFQ (change status to Open)
        update_rfq_resp = self.client.put(f"/api/rfqs/{rfq_id}", json={"status": "Open"}, headers=officer_headers)
        self.assertEqual(update_rfq_resp.status_code, 200)
        self.assertEqual(update_rfq_resp.json()["status"], "Open")

        # Now, bid as Dell Vendor
        dell_token = self.get_token("bids@dell.com", "dellpassword")
        dell_headers = {"Authorization": f"Bearer {dell_token}"}

        # 1. Invalid price (<= 0)
        quote_payload = {
            "rfq_id": rfq_id,
            "price": 0,
            "delivery_days": 5,
            "notes": "Testing price validation"
        }
        response = self.client.post("/api/quotations/", json=quote_payload, headers=dell_headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("price must be greater than 0", response.json()["detail"])

        # 2. Invalid delivery days (<= 0)
        quote_payload["price"] = 25000.0
        quote_payload["delivery_days"] = 0
        response = self.client.post("/api/quotations/", json=quote_payload, headers=dell_headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Delivery days must be greater than 0", response.json()["detail"])

        # 3. Successful bid submission
        quote_payload["delivery_days"] = 7
        response = self.client.post("/api/quotations/", json=quote_payload, headers=dell_headers)
        self.assertEqual(response.status_code, 200)
        quote_id = response.json()["id"]
        self.assertTrue(quote_id)

        # 4. Bid after deadline validation:
        # Move RFQ deadline in DB to past to simulate deadline expiration
        rfq = self.db.query(models.RFQ).filter(models.RFQ.id == rfq_id).first()
        rfq.deadline = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
        self.db.commit()

        # Attempt to bid again
        response = self.client.post("/api/quotations/", json=quote_payload, headers=dell_headers)
        self.assertEqual(response.status_code, 400)
        self.assertIn("deadline for this RFQ has passed", response.json()["detail"])

    def test_05_procurement_workflow_to_po_and_invoice(self):
        print("\n--- Running Test 05: Complete Workflow (RFQ -> Bid -> Approvals -> PO -> Invoice) ---")
        # 1. Create a fresh RFQ by Procurement Officer
        officer_token = self.get_token("officer@vendorbridge.com", "officerpassword")
        officer_headers = {"Authorization": f"Bearer {officer_token}"}
        
        dell = self.db.query(models.Vendor).filter(models.Vendor.company_name == "Dell Technologies").first()
        hp = self.db.query(models.Vendor).filter(models.Vendor.company_name == "HP Enterprise").first()
        
        rfq_payload = {
            "title": "Corporate Laptops Batch A",
            "description": "Enterprise Core i7 laptops",
            "quantity": 10,
            "deadline": (datetime.datetime.utcnow() + datetime.timedelta(days=3)).isoformat(),
            "assigned_vendor_ids": [dell.id, hp.id]
        }
        rfq_resp = self.client.post("/api/rfqs/", json=rfq_payload, headers=officer_headers)
        self.assertEqual(rfq_resp.status_code, 200)
        rfq_id = rfq_resp.json()["id"]

        # Publish the RFQ
        self.client.put(f"/api/rfqs/{rfq_id}", json={"status": "Open"}, headers=officer_headers)

        # 2. Dell submits a bid quotation
        dell_token = self.get_token("bids@dell.com", "dellpassword")
        dell_headers = {"Authorization": f"Bearer {dell_token}"}
        dell_quote_payload = {
            "rfq_id": rfq_id,
            "price": 12000.0,
            "delivery_days": 5,
            "notes": "Premium Latitude laptops"
        }
        dell_quote_resp = self.client.post("/api/quotations/", json=dell_quote_payload, headers=dell_headers)
        self.assertEqual(dell_quote_resp.status_code, 200)
        dell_quote_id = dell_quote_resp.json()["id"]

        # 3. HP submits a bid quotation
        hp_token = self.get_token("partners@hp.com", "hppassword")
        hp_headers = {"Authorization": f"Bearer {hp_token}"}
        hp_quote_payload = {
            "rfq_id": rfq_id,
            "price": 11500.0,
            "delivery_days": 6,
            "notes": "EliteBook commercial models"
        }
        hp_quote_resp = self.client.post("/api/quotations/", json=hp_quote_payload, headers=hp_headers)
        self.assertEqual(hp_quote_resp.status_code, 200)
        hp_quote_id = hp_quote_resp.json()["id"]

        # 4. Procurement Officer selects HP as the winner
        select_resp = self.client.post("/api/quotations/select-winner", json={
            "rfq_id": rfq_id,
            "quote_id": hp_quote_id
        }, headers=officer_headers)
        self.assertEqual(select_resp.status_code, 200)
        self.assertEqual(select_resp.json()["status"], "Approval Pending")

        # 5. Manager approves the selection
        manager_token = self.get_token("manager@vendorbridge.com", "managerpassword")
        manager_headers = {"Authorization": f"Bearer {manager_token}"}
        
        approval_payload = {
            "remarks": "Approved. HP Quote fits our budget and specifications.",
            "status": "Approved"
        }
        approve_resp = self.client.post(f"/api/approvals/{rfq_id}", json=approval_payload, headers=manager_headers)
        self.assertEqual(approve_resp.status_code, 200)
        self.assertEqual(approve_resp.json()["status"], "Approved")

        # Verify that Purchase Order was auto-generated
        po = self.db.query(models.PurchaseOrder).filter(models.PurchaseOrder.rfq_id == rfq_id).first()
        self.assertIsNotNone(po)
        self.assertEqual(po.status, "Generated")
        self.assertEqual(po.amount, 11500.0)
        self.assertEqual(po.vendor_id, hp.id)

        # 6. Test PO Download (PDF)
        po_download_resp = self.client.get(f"/api/purchase-orders/{po.id}/download", headers=manager_headers)
        self.assertEqual(po_download_resp.status_code, 200)
        self.assertEqual(po_download_resp.headers["content-type"], "application/pdf")
        self.assertTrue(len(po_download_resp.content) > 0)

        # 7. Vendor (HP) accepts the PO
        accept_payload = {"status": "Accepted"}
        accept_resp = self.client.put(f"/api/purchase-orders/{po.id}/status", json=accept_payload, headers=hp_headers)
        self.assertEqual(accept_resp.status_code, 200)
        self.assertEqual(accept_resp.json()["status"], "Accepted")

        # 8. Vendor (HP) generates an Invoice for the PO with 18% GST tax rate
        invoice_payload = {
            "po_id": po.id,
            "tax_rate": 18.0
        }
        invoice_resp = self.client.post("/api/invoices/", json=invoice_payload, headers=hp_headers)
        self.assertEqual(invoice_resp.status_code, 200)
        
        invoice_data = invoice_resp.json()
        self.assertEqual(invoice_data["subtotal"], 11500.0)
        self.assertEqual(invoice_data["tax"], 11500.0 * 0.18)
        self.assertEqual(invoice_data["total"], 11500.0 + (11500.0 * 0.18))
        self.assertEqual(invoice_data["status"], "Unpaid")
        invoice_id = invoice_data["id"]

        # Try to generate invoice again for the same PO (expects 400 bad request)
        invoice_resp_dup = self.client.post("/api/invoices/", json=invoice_payload, headers=hp_headers)
        self.assertEqual(invoice_resp_dup.status_code, 400)
        self.assertIn("Invoice has already been generated", invoice_resp_dup.json()["detail"])

        # 9. Download Invoice PDF
        inv_download_resp = self.client.get(f"/api/invoices/{invoice_id}/download", headers=hp_headers)
        self.assertEqual(inv_download_resp.status_code, 200)
        self.assertEqual(inv_download_resp.headers["content-type"], "application/pdf")
        self.assertTrue(len(inv_download_resp.content) > 0)

    def test_06_reports_and_analytics_exports(self):
        print("\n--- Running Test 06: Reports Dashboard and Exports ---")
        admin_token = self.get_token("admin@vendorbridge.com", "adminpassword")
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Fetch reports analytics JSON
        response = self.client.get("/api/reports/", headers=headers)
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn("kpis", data)
        self.assertIn("category_spend", data)
        self.assertIn("vendor_performance", data)
        self.assertIn("monthly_spend", data)
        
        # Verify KPI counters
        kpis = data["kpis"]
        self.assertGreaterEqual(kpis["total_vendors"], 3)
        self.assertGreaterEqual(kpis["total_spend"], 0.0)

        # 2. Export CSV report
        csv_response = self.client.get("/api/reports/export/csv", headers=headers)
        self.assertEqual(csv_response.status_code, 200)
        self.assertEqual(csv_response.headers["content-type"], "text/csv; charset=utf-8")
        csv_data = csv_response.text
        self.assertIn("KEY PERFORMANCE METRICS", csv_data)
        self.assertIn("SPEND BY CATEGORY", csv_data)
        self.assertIn("VENDOR PERFORMANCE LEDGER", csv_data)

        # 3. Export PDF report
        pdf_response = self.client.get("/api/reports/export/pdf", headers=headers)
        self.assertEqual(pdf_response.status_code, 200)
        self.assertEqual(pdf_response.headers["content-type"], "application/pdf")
        self.assertTrue(len(pdf_response.content) > 0)

    def test_07_activity_logs_and_audit(self):
        print("\n--- Running Test 07: Activity Logs Audit ---")
        admin_token = self.get_token("admin@vendorbridge.com", "adminpassword")
        headers = {"Authorization": f"Bearer {admin_token}"}

        response = self.client.get("/api/reports/activity-logs", headers=headers)
        self.assertEqual(response.status_code, 200)
        logs = response.json()
        self.assertTrue(len(logs) > 0)
        
        # Check that some expected actions are logged
        actions = [log["action"] for log in logs]
        self.assertTrue(any("APPROVED RFQ" in act or "UPDATED" in act or "PO" in act or "Invoice" in act for act in actions))
        print(f"Verified {len(logs)} activity logs. Last action: {logs[0]['action']}")

    def test_08_quotations_crud_and_status(self):
        print("\n--- Running Test 08: Quotations Ledger CRUD and Status Verification ---")
        officer_token = self.get_token("officer@vendorbridge.com", "officerpassword")
        officer_headers = {"Authorization": f"Bearer {officer_token}"}
        
        # 1. Fetch vendor and RFQ for manual quote creation
        dell = self.db.query(models.Vendor).filter(models.Vendor.company_name == "Dell Technologies").first()
        rfq = self.db.query(models.RFQ).filter(models.RFQ.title == "Corporate Laptops Batch A").first()
        self.assertIsNotNone(dell)
        self.assertIsNotNone(rfq)

        # 2. Create quotation manually by Procurement Officer
        create_payload = {
            "rfq_id": rfq.id,
            "vendor_id": dell.id,
            "price": 13500.0,
            "delivery_days": 8,
            "notes": "Officially created quotation on behalf of Dell"
        }
        create_resp = self.client.post("/api/quotations/", json=create_payload, headers=officer_headers)
        self.assertEqual(create_resp.status_code, 200)
        quote_data = create_resp.json()
        quote_id = quote_data["id"]
        self.assertEqual(quote_data["price"], 13500.0)
        self.assertEqual(quote_data["status"], "Not Selected")

        # 3. Retrieve single quotation & verify dynamic status
        get_resp = self.client.get(f"/api/quotations/{quote_id}", headers=officer_headers)
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()["status"], "Not Selected")

        # 4. Update quotation using PUT
        update_payload = {
            "price": 13000.0,
            "delivery_days": 7,
            "notes": "Updated proposal price details"
        }
        update_resp = self.client.put(f"/api/quotations/{quote_id}", json=update_payload, headers=officer_headers)
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["price"], 13000.0)
        self.assertEqual(update_resp.json()["delivery_days"], 7)

        # 5. Verify security: another vendor cannot edit or delete this quotation
        hp_token = self.get_token("partners@hp.com", "hppassword")
        hp_headers = {"Authorization": f"Bearer {hp_token}"}
        bad_edit_resp = self.client.put(f"/api/quotations/{quote_id}", json=update_payload, headers=hp_headers)
        self.assertEqual(bad_edit_resp.status_code, 403)

        bad_delete_resp = self.client.delete(f"/api/quotations/{quote_id}", headers=hp_headers)
        self.assertEqual(bad_delete_resp.status_code, 403)

        # 6. Delete quotation using DELETE
        delete_resp = self.client.delete(f"/api/quotations/{quote_id}", headers=officer_headers)
        self.assertEqual(delete_resp.status_code, 200)
        self.assertEqual(delete_resp.json()["message"], f"Quotation #{quote_id} deleted successfully.")

        # 7. Check that it is deleted
        get_deleted_resp = self.client.get(f"/api/quotations/{quote_id}", headers=officer_headers)
        self.assertEqual(get_deleted_resp.status_code, 404)

if __name__ == "__main__":
    unittest.main()
