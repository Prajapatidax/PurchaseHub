# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError

class PurchaseHubRFQ(models.Model):
    _name = 'purchasehub.rfq'
    _description = 'Request For Quotation'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'rfq_number'

    rfq_number = fields.Char(string='RFQ Number', required=True, copy=False, readonly=True, index=True, default=lambda self: _('New'))
    title = fields.Char(string='Title', required=True, tracking=True)
    description = fields.Text(string='Description')
    deadline = fields.Datetime(string='Deadline', required=True, tracking=True)
    procurement_officer = fields.Many2one('res.users', string='Procurement Officer', default=lambda self: self.env.user, required=True, tracking=True)
    vendor_ids = fields.Many2many('purchasehub.vendor', 'rfq_vendor_rel', 'rfq_id', 'vendor_id', string='Assigned Vendors', tracking=True)
    state = fields.Selection([
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('quotation_received', 'Quotation Received'),
        ('closed', 'Closed')
    ], string='Status', default='draft', required=True, tracking=True)
    line_ids = fields.One2many('purchasehub.rfq.line', 'rfq_id', string='RFQ Lines', copy=True)
    quotation_ids = fields.One2many('purchasehub.quotation', 'rfq_id', string='Quotations')
    quotation_count = fields.Integer(string='Quotations Count', compute='_compute_quotation_count')

    @api.depends('quotation_ids')
    def _compute_quotation_count(self):
        for rfq in self:
            rfq.quotation_count = len(rfq.quotation_ids)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('rfq_number', _('New')) == _('New'):
                vals['rfq_number'] = self.env['ir.sequence'].next_by_code('purchasehub.rfq.sequence') or _('New')
        records = super(PurchaseHubRFQ, self).create(vals_list)
        for record in records:
            record._log_activity('create', 'Created RFQ %s' % record.rfq_number)
        return records

    def write(self, vals):
        res = super(PurchaseHubRFQ, self).write(vals)
        if res:
            for record in self:
                record._log_activity('write', 'Updated RFQ details')
        return res

    def unlink(self):
        for record in self:
            if record.state != 'draft':
                raise UserError(_("You can only delete RFQs that are in Draft state."))
            record._log_activity('delete', 'Deleted RFQ %s' % record.rfq_number)
        return super(PurchaseHubRFQ, self).unlink()

    def action_send_rfq(self):
        self.ensure_one()
        if not self.vendor_ids:
            raise UserError(_("Please assign at least one vendor before sending."))
        if not self.line_ids:
            raise UserError(_("Please add at least one item line to this RFQ."))
        
        self.state = 'sent'
        self._log_activity('status_change', 'RFQ sent to vendors')

        # Send invitation emails to vendors
        template = self.env.ref('purchasehub.email_template_rfq_invitation', raise_if_not_found=False)
        if template:
            for vendor in self.vendor_ids:
                # We render email context for each vendor
                if vendor.email:
                    # Pass vendor as context to personalize greeting
                    template.with_context(vendor_id=vendor.id).send_mail(self.id, force_send=True)
        return True

    def action_receive_quotations(self):
        self.ensure_one()
        self.state = 'quotation_received'
        self._log_activity('status_change', 'Quotations received phase')
        return True

    def action_close(self):
        self.ensure_one()
        self.state = 'closed'
        self._log_activity('status_change', 'RFQ closed')
        return True

    def action_compare_quotations(self):
        self.ensure_one()
        # Open client action for side-by-side comparison
        return {
            'type': 'ir.actions.client',
            'tag': 'purchasehub_comparison',
            'name': _('Compare Quotations - %s') % self.rfq_number,
            'context': {
                'active_id': self.id,
                'rfq_id': self.id,
            }
        }

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
    def get_comparison_data(self, rfq_id):
        rfq = self.browse(rfq_id)
        if not rfq.exists():
            return {}
        
        quotations = self.env['purchasehub.quotation'].search([
            ('rfq_id', '=', rfq_id),
            ('status', 'in', ['submitted', 'under_review', 'approved', 'rejected'])
        ])
        
        rfq_lines = []
        for line in rfq.line_ids:
            rfq_lines.append({
                'id': line.id,
                'product_name': line.product_id.display_name,
                'quantity': line.quantity,
            })
            
        quotes_data = []
        for q in quotations:
            line_prices = {}
            for line in q.line_ids:
                line_prices[line.rfq_line_id.id] = {
                    'price_unit': line.price_unit,
                    'price_subtotal': line.price_subtotal,
                }
                
            quotes_data.append({
                'id': q.id,
                'quotation_number': q.quotation_number,
                'vendor_name': q.vendor_id.company_name,
                'vendor_rating': q.vendor_id.rating,
                'quotation_amount': q.quotation_amount,
                'delivery_days': q.delivery_days,
                'status': q.status,
                'notes': q.notes or '',
                'line_prices': line_prices,
            })
            
        return {
            'rfq_number': rfq.rfq_number,
            'rfq_title': rfq.title,
            'rfq_lines': rfq_lines,
            'quotations': quotes_data,
        }



class PurchaseHubRFQLine(models.Model):
    _name = 'purchasehub.rfq.line'
    _description = 'Request For Quotation Line'

    rfq_id = fields.Many2one('purchasehub.rfq', string='RFQ', ondelete='cascade', required=True)
    product_id = fields.Many2one('product.product', string='Product', required=True)
    description = fields.Char(string='Description')
    quantity = fields.Float(string='Quantity', default=1.0, required=True)

    @api.onchange('product_id')
    def _onchange_product_id(self):
        if self.product_id:
            self.description = self.product_id.display_name
