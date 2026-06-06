# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError

class PurchaseHubPurchaseOrder(models.Model):
    _name = 'purchasehub.purchase.order'
    _description = 'Purchase Order'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'po_number'

    po_number = fields.Char(string='PO Number', required=True, copy=False, readonly=True, index=True, default=lambda self: _('New'))
    approved_quotation_id = fields.Many2one('purchasehub.quotation', string='Approved Quotation', required=True, tracking=True)
    vendor_id = fields.Many2one('purchasehub.vendor', string='Vendor', required=True, tracking=True)
    subtotal = fields.Float(string='Subtotal', compute='_compute_totals', store=True, tracking=True)
    tax = fields.Float(string='Tax (18% GST)', compute='_compute_totals', store=True, tracking=True)
    total = fields.Float(string='Total Amount', compute='_compute_totals', store=True, tracking=True)
    status = fields.Selection([
        ('draft', 'Draft PO'),
        ('confirmed', 'Confirmed'),
        ('done', 'Done'),
        ('cancelled', 'Cancelled')
    ], string='Status', default='draft', required=True, tracking=True)
    line_ids = fields.One2many('purchasehub.purchase.order.line', 'po_id', string='PO Lines', copy=True)
    invoice_ids = fields.One2many('purchasehub.invoice', 'purchase_order_id', string='Invoices')

    @api.depends('line_ids.price_subtotal')
    def _compute_totals(self):
        for po in self:
            po.subtotal = sum(line.price_subtotal for line in po.line_ids)
            po.tax = po.subtotal * 0.18
            po.total = po.subtotal + po.tax

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('po_number', _('New')) == _('New'):
                vals['po_number'] = self.env['ir.sequence'].next_by_code('purchasehub.po.sequence') or _('New')
        records = super(PurchaseHubPurchaseOrder, self).create(vals_list)
        for record in records:
            record._log_activity('create', 'Created PO %s' % record.po_number)
        return records

    def write(self, vals):
        res = super(PurchaseHubPurchaseOrder, self).write(vals)
        if res:
            for record in self:
                record._log_activity('write', 'Updated PO details')
        return res

    def unlink(self):
        for record in self:
            if record.status != 'draft':
                raise UserError(_("You can only delete purchase orders in Draft state."))
            record._log_activity('delete', 'Deleted PO %s' % record.po_number)
        return super(PurchaseHubPurchaseOrder, self).unlink()

    def action_confirm(self):
        self.ensure_one()
        if self.status != 'draft':
            raise UserError(_("PO is not in Draft state."))
        
        self.status = 'confirmed'
        self._log_activity('status_change', 'PO Confirmed')

        # Generate Invoice Automatically
        invoice_vals = {
            'purchase_order_id': self.id,
            'invoice_date': fields.Date.context_today(self),
            'subtotal': self.subtotal,
            'tax': self.tax,
            'grand_total': self.total,
            'payment_status': 'unpaid'
        }
        invoice = self.env['purchasehub.invoice'].create(invoice_vals)

        # Copy lines to Invoice lines
        for line in self.line_ids:
            self.env['purchasehub.invoice.line'].create({
                'invoice_id': invoice.id,
                'product_id': line.product_id.id,
                'description': line.description,
                'quantity': line.quantity,
                'price_unit': line.price_unit,
                'price_subtotal': line.price_subtotal
            })

        # Send PO confirmation email
        template = self.env.ref('purchasehub.email_template_po_confirmation', raise_if_not_found=False)
        if template and self.vendor_id.email:
            template.send_mail(self.id, force_send=True)

        return {
            'name': _('Invoice Generated'),
            'view_mode': 'form',
            'res_model': 'purchasehub.invoice',
            'res_id': invoice.id,
            'type': 'ir.actions.act_window',
        }

    def action_cancel(self):
        self.ensure_one()
        self.status = 'cancelled'
        self._log_activity('status_change', 'PO Cancelled')
        return True

    def action_done(self):
        self.ensure_one()
        self.status = 'done'
        self._log_activity('status_change', 'PO Completed (Done)')
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


class PurchaseHubPurchaseOrderLine(models.Model):
    _name = 'purchasehub.purchase.order.line'
    _description = 'Purchase Order Line'

    po_id = fields.Many2one('purchasehub.purchase.order', string='PO', ondelete='cascade', required=True)
    product_id = fields.Many2one('product.product', string='Product', required=True)
    description = fields.Char(string='Description')
    quantity = fields.Float(string='Quantity', required=True)
    price_unit = fields.Float(string='Unit Price', required=True)
    price_subtotal = fields.Float(string='Subtotal', compute='_compute_price_subtotal', store=True)

    @api.depends('quantity', 'price_unit')
    def _compute_price_subtotal(self):
        for line in self:
            line.price_subtotal = line.quantity * line.price_unit
