# REST API Specifications

The PurchaseHub backend is powered by FastAPI, exposing REST endpoints with Role-Based Access Control (RBAC). All endpoints except authentication routes expect a JSON Web Token (JWT) in the `Authorization: Bearer <TOKEN>` header.

---

## 1. Authentication (`/api/auth`)

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/auth/signup` | POST | Public | Register a new user. If the role is `Vendor`, it automatically instantiates a vendor profile. |
| `/auth/login` | POST | Public | Authenticate credentials and return JWT access token, user role, and user meta. |
| `/auth/forgot-password` | POST | Public | Trigger recovery flow by sending a password reset mock email with a token. |
| `/auth/reset-password` | POST | Public | Update user's password using the mock token received. |
| `/auth/me` | GET | Authenticated | Validate the current token and return user details. |

---

## 2. Vendor Registry (`/api/vendors`)

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/vendors/` | GET | Admin, Procurement, Manager, Vendor | Retrieve list of registered vendor companies. Vendors only see their own company. |
| `/vendors/` | POST | Admin, Procurement | Create a new vendor profile. Requires unique Company Name, email, and GSTIN. |
| `/vendors/{vendor_id}` | GET | Authenticated | Fetch details of a single vendor company. |
| `/vendors/{vendor_id}` | PUT | Admin, Procurement, Vendor (Owner) | Modify vendor details (category, phone, rating, address, status). |
| `/vendors/{vendor_id}` | DELETE | Admin, Procurement | Delete a vendor profile. |

---

## 3. Request for Quotations (`/api/rfqs`)

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/rfqs/` | GET | Authenticated | List RFQs. Filterable by status. Vendors only see RFQs assigned to them. |
| `/rfqs/` | POST | Admin, Procurement | Create a new RFQ in `Draft` state and assign to specific vendor IDs. |
| `/rfqs/{rfq_id}` | GET | Authenticated | Fetch details of a single RFQ. |
| `/rfqs/{rfq_id}` | PUT | Admin, Procurement | Update RFQ title, description, quantity, deadline, or status (e.g. publish by changing status to `Open`). |
| `/rfqs/{rfq_id}` | DELETE | Admin, Procurement | Delete an RFQ. |

---

## 4. Quotations Bids (`/api/quotations`)

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/quotations/` | GET | Authenticated | List submitted bids. Procurement Officers see all bids. Vendors only see their own. |
| `/quotations/` | POST | Admin, Procurement, Vendor | Submit a quotation price, delivery lead time, and notes for an open RFQ. |
| `/quotations/{quote_id}` | GET | Authenticated | Retrieve a single quotation. |
| `/quotations/{quote_id}` | PUT | Admin, Procurement, Vendor (Owner) | Update quote pricing or delivery days (only allowed if bidding deadline is in future). |
| `/quotations/{quote_id}` | DELETE | Admin, Procurement, Vendor (Owner) | Delete a quotation bid. |
| `/quotations/select-winner` | POST | Admin, Procurement | Select a winning quote for an RFQ, moving status to `Approval Pending`. |

---

## 5. Approvals (`/api/approvals`)

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/approvals/{rfq_id}` | POST | Admin, Manager | Approve or reject the selected winning quote. Approval automatically triggers Purchase Order generation. |
| `/approvals/history/{rfq_id}` | GET | Authenticated | Fetch remarks and status changes log for an RFQ's approval lifecycle. |

---

## 6. Purchase Orders (`/api/purchase-orders`)

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/purchase-orders/` | GET | Authenticated | List POs. Vendors are restricted to their company's POs. |
| `/purchase-orders/{po_id}` | GET | Authenticated | Fetch details of a single Purchase Order. |
| `/purchase-orders/{po_id}/status` | PUT | Admin, Vendor (Partner) | Update PO status (e.g., vendor accepts/rejects generated PO). |
| `/purchase-orders/{po_id}/download` | GET | Authenticated | Compile and stream the official Purchase Order document as a PDF. |

---

## 7. Invoices (`/api/invoices`)

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/invoices/` | GET | Authenticated | List invoices. Vendors are restricted to their own invoices. |
| `/invoices/` | POST | Admin, Vendor | Generate an Invoice from an accepted PO, applying standard tax rate (e.g. 18.0% GST). |
| `/invoices/{invoice_id}` | GET | Authenticated | Fetch details of a single invoice. |
| `/invoices/{invoice_id}/download` | GET | Authenticated | Compile and stream the official Invoice document as a PDF. |

---

## 8. Reports & Audits (`/api/reports`)

| Endpoint | Method | Role Allowed | Description |
|---|---|---|---|
| `/reports/` | GET | Admin, Procurement, Manager | Fetch core KPI parameters (Spend amount, active RFQs, vendor rating metrics, charts). |
| `/reports/activity-logs` | GET | Admin, Procurement, Manager | Retrieve the system audit trail logs. |
| `/reports/mock-emails` | GET | Admin, Procurement | Retrieve SMTP sent emails logs for auditing mock notifications. |
| `/reports/export/csv` | GET | Admin, Procurement, Manager | Stream dynamic CSV file of metrics and category spends. |
| `/reports/export/pdf` | GET | Admin, Procurement, Manager | Compile and stream standard PDF Executive Procurement Report. |
