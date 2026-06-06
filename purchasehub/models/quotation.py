# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError

class PurchaseHubQuotation(models.Model):
    _name = 'purchasehub.quotation'
    _description = 'Vendor Quotation'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'quotation_number'

    quotation_number = fields.Char(string='Quotation Number', required=True, copy=False, readonly=True, index=True, default=lambda self: _('New'))
    vendor_id = fields.Many2one('purchasehub.vendor', string='Vendor', required=True, tracking=True)
    rfq_id = fields.Many2one('purchasehub.rfq', string='RFQ', required=True, tracking=True)
    quotation_amount = fields.Float(string='Quotation Amount', compute='_compute_quotation_amount', store=True, tracking=True)
    delivery_days = fields.Integer(string='Delivery Lead Time (Days)', default=7, required=True, tracking=True)
    notes = fields.Text(string='Notes')
    submission_date = fields.Datetime(string='Submission Date', default=fields.Datetime.now, tracking=True)
    status = fields.Selection([
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('under_review', 'Under Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], string='Status', default='draft', required=True, tracking=True)
    line_ids = fields.One2many('purchasehub.quotation.line', 'quotation_id', string='Quotation Lines', copy=True)
    company_id = fields.Many2one('res.company', string='Company', default=lambda self: self.env.company)
    currency_id = fields.Many2one('res.currency', string='Currency', default=lambda self: self.env.company.currency_id)

    @api.depends('line_ids.price_subtotal')
    def _compute_quotation_amount(self):
        for rec in self:
            rec.quotation_amount = sum(line.price_subtotal for line in rec.line_ids)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('quotation_number', _('New')) == _('New'):
                vals['quotation_number'] = self.env['ir.sequence'].next_by_code('purchasehub.quotation.sequence') or _('New')
        records = super(PurchaseHubQuotation, self).create(vals_list)
        for record in records:
            record._log_activity('create', 'Created Quotation %s' % record.quotation_number)
        return records

    def write(self, vals):
        res = super(PurchaseHubQuotation, self).write(vals)
        if res:
            for record in self:
                record._log_activity('write', 'Updated Quotation details')
        return res

    def unlink(self):
        for record in self:
            if record.status not in ['draft', 'rejected']:
                raise UserError(_("You can only delete quotations in Draft or Rejected state."))
            record._log_activity('delete', 'Deleted Quotation %s' % record.quotation_number)
        return super(PurchaseHubQuotation, self).unlink()

    @api.onchange('rfq_id')
    def _onchange_rfq_id(self):
        if self.rfq_id:
            # Prefill quotation lines from RFQ lines
            lines = []
            for rfq_line in self.rfq_id.line_ids:
                lines.append((0, 0, {
                    'rfq_line_id': rfq_line.id,
                    'product_id': rfq_line.product_id.id,
                    'quantity': rfq_line.quantity,
                    'price_unit': 0.0
                }))
            self.line_ids = lines

    def action_submit(self):
        self.ensure_one()
        if self.status != 'draft':
            raise UserError(_("Quotation is not in Draft state."))
        if not self.line_ids:
            raise UserError(_("Please add quotation lines before submitting."))
        if any(line.price_unit <= 0.0 for line in self.line_ids):
            raise UserError(_("All items must have a unit price greater than 0."))
        
        self.status = 'submitted'
        self.submission_date = fields.Datetime.now()
        self._log_activity('status_change', 'Quotation submitted')

        # Automatically move RFQ state to quotation_received if it is in sent state
        if self.rfq_id.state == 'sent':
            self.rfq_id.state = 'quotation_received'

        # Notify Procurement Officer
        template = self.env.ref('purchasehub.email_template_quotation_submission', raise_if_not_found=False)
        if template and self.rfq_id.procurement_officer.partner_id.email:
            template.send_mail(self.id, force_send=True)
        return True

    def action_under_review(self):
        self.ensure_one()
        if self.status != 'submitted':
            raise UserError(_("Only submitted quotations can be set to Under Review."))
        self.status = 'under_review'
        self._log_activity('status_change', 'Quotation set to Under Review')
        return True

    def action_approve(self):
        self.ensure_one()
        if self.status not in ['submitted', 'under_review']:
            raise UserError(_("Only submitted or under review quotations can be approved."))
        
        self.status = 'approved'
        self._log_activity('status_change', 'Quotation Approved')

        # Log an Approval record
        self.env['purchasehub.approval'].create({
            'quotation_id': self.id,
            'approver_id': self.env.user.id,
            'remarks': 'Approved automatically via quotation comparison or workflow action.',
            'approval_date': fields.Datetime.now(),
            'state': 'approved'
        })

        # Generate Purchase Order
        po_vals = {
            'approved_quotation_id': self.id,
            'vendor_id': self.vendor_id.id,
            'subtotal': self.quotation_amount,
            'tax': self.quotation_amount * 0.18, # 18% standard GST estimation
            'total': self.quotation_amount * 1.18,
            'status': 'draft'
        }
        po = self.env['purchasehub.purchase.order'].create(po_vals)

        # Copy lines to Purchase Order lines
        for line in self.line_ids:
            self.env['purchasehub.purchase.order.line'].create({
                'po_id': po.id,
                'product_id': line.product_id.id,
                'description': line.product_id.display_name,
                'quantity': line.quantity,
                'price_unit': line.price_unit,
                'price_subtotal': line.price_subtotal
            })

        # Reject all other quotations for the same RFQ
        other_quotes = self.rfq_id.quotation_ids.filtered(lambda q: q.id != self.id and q.status in ['draft', 'submitted', 'under_review'])
        for q in other_quotes:
            q.status = 'rejected'
            q._log_activity('status_change', 'Quotation rejected because another quote was approved')

        # Close the RFQ
        self.rfq_id.state = 'closed'

        # Notify Vendor of Approval
        template = self.env.ref('purchasehub.email_template_approval_status', raise_if_not_found=False)
        if template and self.vendor_id.email:
            template.send_mail(self.id, force_send=True)
            
        return {
            'name': _('Purchase Order'),
            'view_mode': 'form',
            'res_model': 'purchasehub.purchase.order',
            'res_id': po.id,
            'type': 'ir.actions.act_window',
        }

    def action_reject(self):
        self.ensure_one()
        if self.status not in ['submitted', 'under_review']:
            raise UserError(_("Only submitted or under review quotations can be rejected."))
        
        self.status = 'rejected'
        self._log_activity('status_change', 'Quotation Rejected')

        # Log a Rejected Approval record
        self.env['purchasehub.approval'].create({
            'quotation_id': self.id,
            'approver_id': self.env.user.id,
            'remarks': 'Rejected via workflow action.',
            'approval_date': fields.Datetime.now(),
            'state': 'rejected'
        })

        # Notify Vendor of Rejection
        template = self.env.ref('purchasehub.email_template_approval_status', raise_if_not_found=False)
        if template and self.vendor_id.email:
            template.send_mail(self.id, force_send=True)
        return True

    def _log_activity(self, activity_type, message):
        self.env['purchasehub.activity.log'].create({
            'user_id': self.env.user.id,
            'activity_type': activity_type,
            'model_name': self._name,
            'record_id': self.id,
            'timestamp': fields.Datetime.now()
        })
        self.message_post(body=message)


class PurchaseHubQuotationLine(models.Model):
    _name = 'purchasehub.quotation.line'
    _description = 'Vendor Quotation Line'

    quotation_id = fields.Many2one('purchasehub.quotation', string='Quotation', ondelete='cascade', required=True)
    rfq_line_id = fields.Many2one('purchasehub.rfq.line', string='RFQ Line', required=True)
    product_id = fields.Many2one('product.product', string='Product', required=True)
    quantity = fields.Float(string='Quantity', required=True)
    price_unit = fields.Float(string='Unit Price', required=True, default=0.0)
    price_subtotal = fields.Float(string='Subtotal', compute='_compute_price_subtotal', store=True)

    @api.depends('quantity', 'price_unit')
    def _compute_price_subtotal(self):
        for line in self:
            line.price_subtotal = line.quantity * line.price_unit
