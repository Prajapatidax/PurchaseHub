# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError

class PurchaseHubInvoice(models.Model):
    _name = 'purchasehub.invoice'
    _description = 'Supplier Invoice'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'invoice_number'

    invoice_number = fields.Char(string='Invoice Number', required=True, copy=False, readonly=True, index=True, default=lambda self: _('New'))
    purchase_order_id = fields.Many2one('purchasehub.purchase.order', string='Purchase Order', required=True, tracking=True)
    invoice_date = fields.Date(string='Invoice Date', default=fields.Date.context_today, required=True, tracking=True)
    subtotal = fields.Float(string='Subtotal', compute='_compute_totals', store=True, tracking=True)
    tax = fields.Float(string='Tax (18% GST)', compute='_compute_totals', store=True, tracking=True)
    grand_total = fields.Float(string='Grand Total', compute='_compute_totals', store=True, tracking=True)
    payment_status = fields.Selection([
        ('unpaid', 'Unpaid'),
        ('partially_paid', 'Partially Paid'),
        ('paid', 'Paid')
    ], string='Payment Status', default='unpaid', required=True, tracking=True)
    line_ids = fields.One2many('purchasehub.invoice.line', 'invoice_id', string='Invoice Lines', copy=True)

    @api.depends('line_ids.price_subtotal')
    def _compute_totals(self):
        for rec in self:
            rec.subtotal = sum(line.price_subtotal for line in rec.line_ids)
            rec.tax = rec.subtotal * 0.18
            rec.grand_total = rec.subtotal + rec.tax

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('invoice_number', _('New')) == _('New'):
                vals['invoice_number'] = self.env['ir.sequence'].next_by_code('purchasehub.invoice.sequence') or _('New')
        records = super(PurchaseHubInvoice, self).create(vals_list)
        for record in records:
            record._log_activity('create', 'Created Invoice %s' % record.invoice_number)
        return records

    def write(self, vals):
        res = super(PurchaseHubInvoice, self).write(vals)
        if res:
            for record in self:
                record._log_activity('write', 'Updated Invoice details')
        return res

    def unlink(self):
        for record in self:
            if record.payment_status != 'unpaid':
                raise UserError(_("You can only delete unpaid invoices."))
            record._log_activity('delete', 'Deleted Invoice %s' % record.invoice_number)
        return super(PurchaseHubInvoice, self).unlink()

    def action_register_payment(self):
        self.ensure_one()
        self.payment_status = 'paid'
        self._log_activity('status_change', 'Invoice paid')
        return True

    def action_register_partial_payment(self):
        self.ensure_one()
        self.payment_status = 'partially_paid'
        self._log_activity('status_change', 'Invoice partially paid')
        return True

    def action_send_invoice(self):
        self.ensure_one()
        # Trigger email delivery of the invoice PDF
        template = self.env.ref('purchasehub.email_template_invoice_delivery', raise_if_not_found=False)
        if template and self.purchase_order_id.vendor_id.email:
            template.send_mail(self.id, force_send=True)
            self._log_activity('message', 'Invoice emailed to vendor')
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


class PurchaseHubInvoiceLine(models.Model):
    _name = 'purchasehub.invoice.line'
    _description = 'Invoice Line'

    invoice_id = fields.Many2one('purchasehub.invoice', string='Invoice', ondelete='cascade', required=True)
    product_id = fields.Many2one('product.product', string='Product', required=True)
    description = fields.Char(string='Description')
    quantity = fields.Float(string='Quantity', required=True)
    price_unit = fields.Float(string='Unit Price', required=True)
    price_subtotal = fields.Float(string='Subtotal', compute='_compute_price_subtotal', store=True)

    @api.depends('quantity', 'price_unit')
    def _compute_price_subtotal(self):
        for line in self:
            line.price_subtotal = line.quantity * line.price_unit
