# -*- coding: utf-8 -*-
from odoo import models, fields, api, _

class PurchaseHubQuotationComparison(models.TransientModel):
    _name = 'purchasehub.quotation.comparison'
    _description = 'Quotation Comparison Wizard'

    rfq_id = fields.Many2one('purchasehub.rfq', string='RFQ', required=True)
    quotation_ids = fields.Many2many('purchasehub.quotation', string='Quotations')
    recommended_quotation_id = fields.Many2one('purchasehub.quotation', string='Recommended Quotation', compute='_compute_recommendation')
    recommendation_reason = fields.Text(string='Recommendation Reason', compute='_compute_recommendation')

    @api.model
    def default_get(self, fields_list):
        res = super(PurchaseHubQuotationComparison, self).default_get(fields_list)
        active_id = self.env.context.get('active_id')
        if active_id and self.env.context.get('active_model') == 'purchasehub.rfq':
            rfq = self.env['purchasehub.rfq'].browse(active_id)
            res['rfq_id'] = rfq.id
            quotes = self.env['purchasehub.quotation'].search([
                ('rfq_id', '=', rfq.id),
                ('status', 'in', ['submitted', 'under_review'])
            ])
            res['quotation_ids'] = [(6, 0, quotes.ids)]
        return res

    @api.depends('rfq_id', 'quotation_ids')
    def _compute_recommendation(self):
        for rec in self:
            if not rec.quotation_ids:
                rec.recommended_quotation_id = False
                rec.recommendation_reason = _("No submitted or under-review quotations available for comparison.")
                continue

            prices = [q.quotation_amount for q in rec.quotation_ids if q.quotation_amount > 0]
            deliveries = [q.delivery_days for q in rec.quotation_ids if q.delivery_days > 0]
            
            lowest_price = min(prices) if prices else 1.0
            fastest_delivery = min(deliveries) if deliveries else 1.0

            best_score = -1
            best_q = False

            for q in rec.quotation_ids:
                price_factor = lowest_price / q.quotation_amount if q.quotation_amount > 0 else 1.0
                delivery_factor = fastest_delivery / q.delivery_days if q.delivery_days > 0 else 1.0
                rating_factor = q.vendor_id.rating / 5.0 if q.vendor_id.rating > 0 else 1.0

                score = (price_factor * 0.5) + (delivery_factor * 0.25) + (rating_factor * 0.25)
                if score > best_score:
                    best_score = score
                    best_q = q

            if best_q:
                rec.recommended_quotation_id = best_q.id
                rec.recommendation_reason = _(
                    "Vendor '%s' is recommended (Score: %d%%) based on:\n"
                    "- Quotation Amount: %s (Lowest in scope: %s)\n"
                    "- Delivery Lead Time: %d Days (Fastest in scope: %d Days)\n"
                    "- Supplier Rating: %.1f / 5.0"
                ) % (
                    best_q.vendor_id.company_name,
                    int(best_score * 100),
                    best_q.quotation_amount,
                    lowest_price,
                    best_q.delivery_days,
                    fastest_delivery,
                    best_q.vendor_id.rating
                )
            else:
                rec.recommended_quotation_id = False
                rec.recommendation_reason = _("Could not determine recommendation.")

    def action_approve_recommended(self):
        self.ensure_one()
        if self.recommended_quotation_id:
            return self.recommended_quotation_id.action_approve()
        return True
