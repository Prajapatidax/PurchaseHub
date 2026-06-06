# -*- coding: utf-8 -*-
from odoo import models, fields, api, _

class PurchaseHubApproval(models.Model):
    _name = 'purchasehub.approval'
    _description = 'Procurement Approval'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'approval_number'

    approval_number = fields.Char(string='Approval Number', required=True, copy=False, readonly=True, index=True, default=lambda self: _('New'))
    quotation_id = fields.Many2one('purchasehub.quotation', string='Quotation', required=True, tracking=True)
    approver_id = fields.Many2one('res.users', string='Approver', required=True, default=lambda self: self.env.user, tracking=True)
    remarks = fields.Text(string='Remarks', tracking=True)
    approval_date = fields.Datetime(string='Approval Date', default=fields.Datetime.now, tracking=True)
    state = fields.Selection([
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], string='State', default='pending', required=True, tracking=True)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('approval_number', _('New')) == _('New'):
                vals['approval_number'] = self.env['ir.sequence'].next_by_code('purchasehub.approval.sequence') or _('New')
        records = super(PurchaseHubApproval, self).create(vals_list)
        for record in records:
            record._log_activity('create', 'Created Approval %s' % record.approval_number)
        return records

    def write(self, vals):
        res = super(PurchaseHubApproval, self).write(vals)
        if res:
            for record in self:
                record._log_activity('write', 'Updated Approval details')
        return res

    def _log_activity(self, activity_type, message):
        self.env['purchasehub.activity.log'].create({
            'user_id': self.env.user.id,
            'activity_type': activity_type,
            'model_name': self._name,
            'record_id': self.id,
            'timestamp': fields.Datetime.now()
        })
        self.message_post(body=message)
