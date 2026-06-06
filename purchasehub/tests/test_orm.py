# -*- coding: utf-8 -*-
from odoo.tests import common
from odoo.exceptions import ValidationError
from psycopg2 import IntegrityError

class TestPurchaseHubORM(common.TransactionCase):

    def setUp(self):
        super(TestPurchaseHubORM, self).setUp()
        self.VendorModel = self.env['purchasehub.vendor']
        self.RfqModel = self.env['purchasehub.rfq']
        
        # Test product
        self.product_steel = self.env['product.product'].create({
            'name': 'Test Steel Plate',
            'type': 'consu'
        })

    def test_01_vendor_creation_and_sequence(self):
        """Test vendor sequence number and defaults on creation"""
        vendor = self.VendorModel.create({
            'company_name': 'Alpha Supplies Ltd',
            'email': 'alpha@example.com',
            'vendor_category': 'raw_materials'
        })
        self.assertTrue(vendor.vendor_code.startswith('VND'))
        self.assertEqual(vendor.rating, 5.0, "Initial vendor rating should default to 5.0")
        self.assertEqual(vendor.status, 'active', "Default status should be active")

    def test_02_rfq_creation_and_sequence(self):
        """Test RFQ sequence number generation"""
        rfq = self.RfqModel.create({
            'title': 'Test Q3 Procurement',
            'deadline': '2026-12-31 12:00:00',
            'line_ids': [(0, 0, {
                'product_id': self.product_steel.id,
                'quantity': 10
            })]
        })
        self.assertTrue(rfq.rfq_number.startswith('RFQ'))
        self.assertEqual(rfq.state, 'draft')
        self.assertEqual(len(rfq.line_ids), 1)

    def test_03_unique_email_constraint(self):
        """Test unique email constraint on Vendor model"""
        self.VendorModel.create({
            'company_name': 'Vendor One',
            'email': 'duplicate@example.com',
        })
        # Attempting to create another vendor with the same email should fail
        with self.assertRaises(Exception):
            self.VendorModel.create({
                'company_name': 'Vendor Two',
                'email': 'duplicate@example.com',
            })
