# AI Context - PurchaseHub Odoo 18 Module

This context describes the database schema, frontend assets, security scopes, and expected behavior.

## Key Models
- `purchasehub.vendor`: Vendor profiling and grading.
- `purchasehub.rfq`: Requests for Quotations containing multiple `purchasehub.rfq.line` lines.
- `purchasehub.quotation`: Vendor quotation containing `purchasehub.quotation.line` price specifications.
- `purchasehub.approval`: Managers review mechanism for submitted quotes.
- `purchasehub.purchase.order`: Binding PO with details copied from approved quotation lines.
- `purchasehub.invoice`: Billing records linked directly to the purchase order.
- `purchasehub.activity.log`: Internal CRUD and state log tracker.

## UI & Frameworks
- **Backend ORM**: Odoo 18 ORM (Python)
- **Frontend Views**: XML form/tree/kanban/search declarations.
- **Client Actions**: Custom OWL components `purchasehub_dashboard` and `purchasehub_comparison`.
- **Reports**: QWeb PDF templates using custom CSS/Bootstrap print classes.
