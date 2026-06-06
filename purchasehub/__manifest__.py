# -*- coding: utf-8 -*-
{
    'name': 'PurchaseHub - Procurement & Vendor Management ERP',
    'version': '18.0.1.0.0',
    'summary': 'Centralized procurement, RFQ lifecycle, vendor quotes, approvals, POs, invoices, QWeb reports, and OWL analytics dashboard.',
    'description': """
PurchaseHub ERP
================
Centralized Procurement & Vendor Management ERP built for Odoo 18.
Key Features:
- Vendor Management & Rating
- RFQ Lifecycle (draft -> sent -> quotation_received -> closed)
- Vendor Quotation Submission (including line items)
- OWL-based Side-by-Side Quotation Comparison Engine
- Multilevel Manager Approval Workflow
- Automatic Purchase Order and Invoice Generation
- Activity Logging & Mail Automation (PDF attachments)
- OWL-based Enterprise Analytics Dashboard
- QWeb Custom PDF Reports
    """,
    'category': 'Inventory/Purchase',
    'author': 'Antigravity Odoo Architect',
    'depends': ['base', 'mail', 'portal', 'web', 'product'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'data/sequence_data.xml',
        'data/mail_templates.xml',
        'reports/report_paperformat.xml',
        'reports/reports.xml',
        'reports/vendor_report.xml',
        'reports/rfq_report.xml',
        'reports/quotation_report.xml',
        'reports/approval_report.xml',
        'reports/purchase_order_report.xml',
        'reports/invoice_report.xml',
        'reports/summary_report.xml',
        'wizard/quotation_comparison_views.xml',
        'views/vendor_views.xml',
        'views/rfq_views.xml',
        'views/quotation_views.xml',
        'views/approval_views.xml',
        'views/purchase_order_views.xml',
        'views/invoice_views.xml',
        'views/activity_log_views.xml',
        'views/dashboard_views.xml',
        'views/menus.xml',
    ],
    'demo': [
        'demo/demo.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'purchasehub/static/src/scss/purchasehub.scss',
            'purchasehub/static/src/js/dashboard.js',
            'purchasehub/static/src/js/comparison.js',
            'purchasehub/static/src/xml/dashboard.xml',
            'purchasehub/static/src/xml/comparison.xml',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
