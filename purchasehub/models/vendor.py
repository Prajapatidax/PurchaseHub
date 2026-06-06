# -*- coding: utf-8 -*-
from odoo import models, fields, api, _

class PurchaseHubVendor(models.Model):
    _name = 'purchasehub.vendor'
    _description = 'PurchaseHub Vendor'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'company_name'

    vendor_code = fields.Char(string='Vendor Code', required=True, copy=False, readonly=True, index=True, default=lambda self: _('New'))
    company_name = fields.Char(string='Company Name', required=True, tracking=True)
    gst_number = fields.Char(string='GST Number', tracking=True)
    vendor_category = fields.Selection([
        ('raw_materials', 'Raw Materials'),
        ('services', 'Services'),
        ('electronics', 'Electronics'),
        ('logistics', 'Logistics'),
        ('office_supplies', 'Office Supplies')
    ], string='Category', default='raw_materials', required=True, tracking=True)
    contact_person = fields.Char(string='Contact Person', tracking=True)
    email = fields.Char(string='Email', required=True, tracking=True)
    phone = fields.Char(string='Phone')
    address = fields.Text(string='Address')
    rating = fields.Float(string='Rating', compute='_compute_vendor_rating', store=True, group_operator="avg")
    status = fields.Selection([
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('blacklisted', 'Blacklisted')
    ], string='Status', default='active', required=True, tracking=True)
    user_id = fields.Many2one('res.users', string='Related User', help="User account for vendor login.", tracking=True)
    quotation_ids = fields.One2many('purchasehub.quotation', 'vendor_id', string='Quotations')

    _sql_constraints = [
        ('vendor_code_uniq', 'unique(vendor_code)', 'The Vendor Code must be unique!'),
        ('email_uniq', 'unique(email)', 'The vendor email must be unique!')
    ]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('vendor_code', _('New')) == _('New'):
                vals['vendor_code'] = self.env['ir.sequence'].next_by_code('purchasehub.vendor.sequence') or _('New')
        records = super(PurchaseHubVendor, self).create(vals_list)
        for record in records:
            record._log_activity('create', 'Created new vendor %s' % record.company_name)
        return records

    def write(self, vals):
        res = super(PurchaseHubVendor, self).write(vals)
        if res:
            for record in self:
                record._log_activity('write', 'Updated vendor details')
        return res

    def unlink(self):
        for record in self:
            record._log_activity('delete', 'Deleted vendor %s' % record.company_name)
        return super(PurchaseHubVendor, self).unlink()

    @api.depends('quotation_ids', 'quotation_ids.status')
    def _compute_vendor_rating(self):
        for vendor in self:
            approved_quotes = vendor.quotation_ids.filtered(lambda q: q.status == 'approved')
            total_quotes = vendor.quotation_ids.filtered(lambda q: q.status in ['approved', 'rejected'])
            if total_quotes:
                # Basic rating calculation: approved quotations ratio out of total finished evaluations * 5 stars
                vendor.rating = round((len(approved_quotes) / len(total_quotes)) * 5.0, 1)
            else:
                vendor.rating = 5.0 # Initial default rating

    def _log_activity(self, activity_type, message):
        self.env['purchasehub.activity.log'].create({
            'user_id': self.env.user.id,
            'activity_type': activity_type,
            'model_name': self._name,
            'record_id': self.id,
            'timestamp': fields.Datetime.now()
        })
        self.message_post(body=message)

    @api.model
    def get_dashboard_stats(self):
        total_vendors = self.env['purchasehub.vendor'].search_count([])
        active_rfqs = self.env['purchasehub.rfq'].search_count([('state', 'in', ['sent', 'quotation_received'])])
        quotes_received = self.env['purchasehub.quotation'].search_count([('status', 'in', ['submitted', 'under_review', 'approved'])])
        pending_approvals = self.env['purchasehub.approval'].search_count([('state', '=', 'pending')])
        approved_quotes = self.env['purchasehub.quotation'].search_count([('status', '=', 'approved')])
        purchase_orders = self.env['purchasehub.purchase.order'].search_count([])
        invoices = self.env['purchasehub.invoice'].search_count([])
        
        po_records = self.env['purchasehub.purchase.order'].search([])
        monthly_spend = sum(po.total for po in po_records)
        
        vendors = self.env['purchasehub.vendor'].search([], limit=5, order='rating desc')
        vendor_perf_labels = [v.company_name for v in vendors]
        vendor_perf_data = [v.rating for v in vendors]
        
        rfqs = self.env['purchasehub.rfq'].search([])
        rfq_states = {'draft': 0, 'sent': 0, 'quotation_received': 0, 'closed': 0}
        for rfq in rfqs:
            if rfq.state in rfq_states:
                rfq_states[rfq.state] += 1
        
        category_spend = {}
        for po in po_records:
            cat = po.vendor_id.vendor_category or 'unassigned'
            category_spend[cat] = category_spend.get(cat, 0.0) + po.total
            
        cat_labels = [str(k).replace('_', ' ').capitalize() for k in category_spend.keys()]
        cat_data = list(category_spend.values())
        
        return {
            'total_vendors': total_vendors,
            'active_rfqs': active_rfqs,
            'quotes_received': quotes_received,
            'pending_approvals': pending_approvals,
            'approved_quotes': approved_quotes,
            'purchase_orders': purchase_orders,
            'invoices': invoices,
            'monthly_spend': round(monthly_spend, 2),
            'charts': {
                'vendor_perf': {
                    'labels': vendor_perf_labels,
                    'data': vendor_perf_data,
                },
                'rfq_dist': {
                    'labels': [k.replace('_', ' ').capitalize() for k in rfq_states.keys()],
                    'data': list(rfq_states.values()),
                },
                'cat_spend': {
                    'labels': cat_labels,
                    'data': cat_data,
                }
            }
        }

