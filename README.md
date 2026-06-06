# PurchaseHub ERP module

PurchaseHub is an Odoo-inspired ERP module designed to streamline corporate procurement workflows by managing RFQs, vendor bids, manager approvals, purchase orders, and invoicing.

---

## 1. Documentation Index

To understand the architecture and operational details, please consult the respective documentation files:

- [**Project Summary & Architecture**](project_summary.md): High-level system design and folder tree layout.
- [**Brief Details & Workflow Guide**](brief_details.md): Business workflow states, user roles mapping, and permissions.
- [**REST API Specifications**](api_info.md): API routes list, HTTP verbs, and access guards.
- [**Database Schema Specifications**](database.md): Relational SQLite design, tables, columns, and foreign keys.
- [**Frontend Architecture Specifications**](frontend.md): SPA lifecycle, customized Web Components, routing, and Recharts integration.
- [**Backend Architecture Specifications**](backend.md): FastAPI modules, authentication cryptography, PDF rendering, and mock mail services.

---

## 2. Installation & Quick Start

Follow these steps to run the application locally on your machine.

### Prerequisites
- Python 3.10+ installed
- Pip package manager

### Step 1: Install Backend Dependencies
Clone the repository and install all required modules listed in the backend folder:
```cmd
pip install -r backend/requirements.txt
```

### Step 2: Seed the Database
Initialize and seed the SQLite database with Indian localizations, company records, and demo transactions:
```cmd
python seed_data.py
```
This drops any existing schema and instantiates `vendorbridge.db` with clean, seeded records.

### Step 3: Launch the FastAPI Web Server
Run Uvicorn to start the API and serve the static files:
```cmd
python backend/app/main.py
```
Or use the standard Uvicorn command from the root directory:
```cmd
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```
Open your web browser and navigate to `http://localhost:8000/login` to access the application.

---

## 3. Demo Accounts & Testing

### Demo Quick Logins
The login screen includes quick-fill buttons for demo accounts:
- **Procurement Officer**: `officer@vendorbridge.com` / `officerpassword`
- **Finance Manager**: `manager@vendorbridge.com` / `managerpassword`
- **Vendor Partner (Dell India)**: `bids@dell.com` / `dellpassword`
- **Vendor Partner (HP India)**: `partners@hp.com` / `hppassword`

### Running Integration Tests
Execute the end-to-end Python test suite to verify endpoint security, validations, calculations, and PDF compiles:
```cmd
python test_procurement_lifecycle.py
```
This executes all 8 lifecycle tests and prints mock SMTP outbound email logs.
