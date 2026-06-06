# -*- coding: utf-8 -*-
from odoo.tests import common
from odoo.exceptions import UserError

class TestPurchaseHubWorkflow(common.TransactionCase):

    def setUp(self):
        super(TestPurchaseHubWorkflow, self).setUp()
        self.VendorModel = self.env['purchasehub.vendor']
        self.RfqModel = self.env['purchasehub.rfq']
        self.QuotationModel = self.env['purchasehub.quotation']
        
        # Create products
        self.product_steel = self.env['product.product'].create({
            'name': 'Steel Plate',
            'type': 'consu'
        })
        self.product_wire = self.env['product.product'].create({
            'name': 'Copper Wire',
            'type': 'consu'
        })
        
        # Create vendors
        self.vendor_a = self.VendorModel.create({
            'company_name': 'Supplier A Corp',
            'email': 'suppliera@example.com'
        })
        self.vendor_b = self.VendorModel.create({
            'company_name': 'Supplier B Corp',
            'email': 'supplierb@example.com'
        })

    def test_full_procurement_lifecycle(self):
        """Test complete workflow: RFQ -> Quotation -> Approval -> PO -> Invoice"""
        
        # 1. Create RFQ
        rfq = self.RfqModel.create({
            'title': 'Office Wiring Materials',
            'deadline': '2026-12-31 18:00:00',
            'vendor_ids': [(6, 0, [self.vendor_a.id, self.vendor_b.id])],
            'line_ids': [
                (0, 0, {'product_id': self.product_steel.id, 'quantity': 10}),
                (0, 0, {'product_id': self.product_wire.id, 'quantity': 25})
            ]
        })
        self.assertEqual(rfq.state, 'draft')
        
        # 2. Send RFQ
        rfq.action_send_rfq()
        self.assertEqual(rfq.state, 'sent', "RFQ state should transition to Sent")

        # 3. Create Quotations for Vendor A and Vendor B
        quote_a = self.QuotationModel.create({
            'vendor_id': self.vendor_a.id,
            'rfq_id': rfq.id,
            'delivery_days': 5,
            'notes': 'Quick shipping'
        })
        # Trigger onchange to prefill lines from RFQ
        quote_a._onchange_rfq_id()
        
        # Set unit prices
        for line in quote_a.line_ids:
            if line.product_id == self.product_steel:
                line.price_unit = 100.0
            else:
                line.price_unit = 20.0
        
        # Compute subtotal
        quote_a._compute_quotation_amount()
        self.assertEqual(quote_a.quotation_amount, (10 * 100.0) + (25 * 20.0)) # 1500.0

        # Submit quote A
        quote_a.action_submit()
        self.assertEqual(quote_a.status, 'submitted')
        self.assertEqual(rfq.state, 'quotation_received')

        # Create Quote B
        quote_b = self.QuotationModel.create({
            'vendor_id': self.vendor_b.id,
            'rfq_id': rfq.id,
            'delivery_days': 10,
            'notes': 'Standard shipping'
        })
        quote_b._onchange_rfq_id()
        for line in quote_b.line_ids:
            if line.product_id == self.product_steel:
                line.price_unit = 120.0
            else:
                line.price_unit = 18.0
        quote_b._compute_quotation_amount()
        quote_b.action_submit()
        self.assertEqual(quote_b.status, 'submitted')

        # 4. Approve Quotation A (Acme / Supplier A)
        action = quote_a.action_approve()
        
        # Verify Quote states
        self.assertEqual(quote_a.status, 'approved', "Selected quotation must be approved")
        self.assertEqual(quote_b.status, 'rejected', "Competing quotation must be automatically rejected")
        self.assertEqual(rfq.state, 'closed', "RFQ should be closed after approval")

        # Verify PO generation
        self.assertTrue(action and action.get('res_id'), "Approve action should return PO form redirection")
        po = self.env['purchasehub.purchase.order'].browse(action['res_id'])
        self.assertEqual(po.vendor_id, self.vendor_a)
        self.assertEqual(po.subtotal, 1500.0)
        self.assertEqual(po.status, 'draft')

        # 5. Confirm Purchase Order
        invoice_action = po.action_confirm()
        self.assertEqual(po.status, 'confirmed')
        
        # Verify Invoice generation
        self.assertTrue(invoice_action and invoice_action.get('res_id'), "Confirm PO action should return Invoice redirection")
        invoice = self.env['purchasehub.invoice'].browse(invoice_action['res_id'])
        self.assertEqual(invoice.purchase_order_id, po)
        self.assertEqual(invoice.payment_status, 'unpaid')

        # 6. Pay Invoice
        invoice.action_register_payment()
        self.assertEqual(invoice.payment_status, 'paid')
        
        # Verify activities are logged
        logs = self.env['purchasehub.activity.log'].search([('model_name', '=', 'purchasehub.invoice'), ('record_id', '=', invoice.id)])
        self.assertTrue(logs, "Log records should register invoice state changes")
