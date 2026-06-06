# PurchaseHub - Procurement & Vendor Management ERP

PurchaseHub is an Odoo 18 module designed for modern procurement workflows. It enables organizations to register and rate vendors, issue RFQs, receive vendor quotations, compare quotes side-by-side via a dynamic OWL comparison engine, route approvals through managers, generate purchase orders and invoices, and track analytics on an OWL dashboard.

## Module Structure

- `models/`: Database models including Vendor, RFQ, Quotation, Approval, Purchase Order, Invoice, and Activity Log.
- `views/`: Forms, Lists, Kanbans, and OWL Action declarations.
- `security/`: User groups (Admin, Officer, Manager, Vendor) and record access control rules.
- `data/`: Automated sequences (VND, RFQ, QT, APR, PO, INV) and mail templates.
- `static/src/`: Javascript OWL Components, XML layouts, and SCSS styles.
- `reports/`: Customized paper formats and QWeb printable PDF reports.
- `wizard/`: Quotation comparison wizard for back-office compatibility.
- `controllers/`: Portal and general web routing endpoints.
- `tests/`: Automated unit and security tests.

## Installation & Setup

1. Copy the `purchasehub` directory into your Odoo `addons` path.
2. Restart Odoo server and enable developer mode.
3. Update the app list and install the "PurchaseHub" module.
4. Load demo data for a pre-populated experience.
