# -*- coding: utf-8 -*-
from odoo.tests import common
from odoo.exceptions import AccessError

class TestPurchaseHubSecurity(common.TransactionCase):

    def setUp(self):
        super(TestPurchaseHubSecurity, self).setUp()
        self.VendorModel = self.env['purchasehub.vendor']
        self.RfqModel = self.env['purchasehub.rfq']
        
        # Groups
        self.group_vendor = self.env.ref('purchasehub.group_vendor')
        self.group_officer = self.env.ref('purchasehub.group_officer')
        
        # Create user accounts for testing
        self.user_vendor_1 = self.env['res.users'].create({
            'name': 'Demo Vendor User 1',
            'login': 'vendoruser1',
            'email': 'vendor1@example.com',
            'groups_id': [(6, 0, [self.group_vendor.id])]
        })
        self.user_vendor_2 = self.env['res.users'].create({
            'name': 'Demo Vendor User 2',
            'login': 'vendoruser2',
            'email': 'vendor2@example.com',
            'groups_id': [(6, 0, [self.group_vendor.id])]
        })
        self.user_officer = self.env['res.users'].create({
            'name': 'Demo Officer User',
            'login': 'officeruser',
            'email': 'officer@example.com',
            'groups_id': [(6, 0, [self.group_officer.id])]
        })

        # Create vendor records mapped to these users
        self.vendor_1 = self.VendorModel.create({
            'company_name': 'Supplier One Ltd',
            'email': 'vendor1@example.com',
            'user_id': self.user_vendor_1.id
        })
        self.vendor_2 = self.VendorModel.create({
            'company_name': 'Supplier Two Ltd',
            'email': 'vendor2@example.com',
            'user_id': self.user_vendor_2.id
        })

    def test_vendor_record_rule_isolation(self):
        """Test record rule isolates vendors from viewing each other's profiles"""
        # User 1 looks for vendor 2 profile
        VendorModel_user1 = self.VendorModel.with_user(self.user_vendor_1)
        
        # Should be able to read own profile
        own_profile = VendorModel_user1.search([('id', '=', self.vendor_1.id)])
        self.assertTrue(own_profile)

        # Should NOT be able to read other vendor's profile
        other_profile = VendorModel_user1.search([('id', '=', self.vendor_2.id)])
        self.assertFalse(other_profile, "Vendor 1 should not see Vendor 2 profile due to record rules")

    def test_officer_access_all(self):
        """Test that procurement officers can view all vendors"""
        VendorModel_officer = self.VendorModel.with_user(self.user_officer)
        all_vendors = VendorModel_officer.search([])
        self.assertIn(self.vendor_1, all_vendors)
        self.assertIn(self.vendor_2, all_vendors)
