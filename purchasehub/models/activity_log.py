# -*- coding: utf-8 -*-
from odoo import models, fields, api

class PurchaseHubActivityLog(models.Model):
    _name = 'purchasehub.activity.log'
    _description = 'PurchaseHub Activity Log'
    _order = 'timestamp desc'

    user_id = fields.Many2one('res.users', string='Triggered By', required=True)
    activity_type = fields.Selection([
        ('create', 'Created'),
        ('write', 'Modified'),
        ('delete', 'Deleted'),
        ('status_change', 'Status Changed'),
        ('message', 'Message Sent')
    ], string='Activity Type', required=True)
    model_name = fields.Char(string='Model', required=True)
    record_id = fields.Integer(string='Record ID', required=True)
    timestamp = fields.Datetime(string='Timestamp', default=fields.Datetime.now, required=True)
    display_name = fields.Char(string='Activity Details', compute='_compute_display_name')

    @api.depends('activity_type', 'model_name', 'record_id')
    def _compute_display_name(self):
        for log in self:
            log.display_name = f"{log.activity_type.capitalize()} on {log.model_name} (ID: {log.record_id})"
