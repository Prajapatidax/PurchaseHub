# -*- coding: utf-8 -*-
from odoo import http, fields
from odoo.http import request

class PurchaseHubPortalController(http.Controller):

    @http.route('/purchasehub/api/rfqs', type='json', auth='user', methods=['POST'])
    def get_assigned_rfqs(self):
        user = request.env.user
        vendor = request.env['purchasehub.vendor'].search([('user_id', '=', user.id)], limit=1)
        if not vendor:
            return {'error': 'No vendor profile associated with this user account.'}
            
        rfqs = request.env['purchasehub.rfq'].search([('vendor_ids', 'in', vendor.id)])
        rfq_list = []
        for rfq in rfqs:
            rfq_list.append({
                'id': rfq.id,
                'rfq_number': rfq.rfq_number,
                'title': rfq.title,
                'deadline': rfq.deadline.isoformat() if rfq.deadline else None,
                'state': rfq.state
            })
        return {'rfqs': rfq_list}

    @http.route('/purchasehub/api/submit_quote', type='json', auth='user', methods=['POST'])
    def api_submit_quotation(self, **post):
        """
        API submission for quotation
        POST Payload Structure:
        {
            "rfq_id": 1,
            "delivery_days": 5,
            "notes": "Expedited shipping",
            "items": [
                {"rfq_line_id": 1, "price_unit": 150.0},
                {"rfq_line_id": 2, "price_unit": 45.0}
            ]
        }
        """
        user = request.env.user
        vendor = request.env['purchasehub.vendor'].search([('user_id', '=', user.id)], limit=1)
        if not vendor:
            return {'status': 'error', 'message': 'User is not associated with a vendor profile.'}

        rfq_id = post.get('rfq_id')
        rfq = request.env['purchasehub.rfq'].browse(rfq_id)
        if not rfq.exists():
            return {'status': 'error', 'message': 'RFQ not found.'}
            
        if vendor not in rfq.vendor_ids:
            return {'status': 'error', 'message': 'You are not assigned to quote for this RFQ.'}

        if rfq.state == 'closed':
            return {'status': 'error', 'message': 'RFQ is closed.'}

        # Create Quotation
        quote_vals = {
            'vendor_id': vendor.id,
            'rfq_id': rfq.id,
            'delivery_days': post.get('delivery_days', 7),
            'notes': post.get('notes', ''),
            'status': 'draft'
        }
        quote = request.env['purchasehub.quotation'].create(quote_vals)

        # Create lines
        items = post.get('items', [])
        for item in items:
            rfq_line_id = item.get('rfq_line_id')
            rfq_line = request.env['purchasehub.rfq.line'].browse(rfq_line_id)
            if rfq_line.rfq_id.id != rfq.id:
                continue
            request.env['purchasehub.quotation.line'].create({
                'quotation_id': quote.id,
                'rfq_line_id': rfq_line.id,
                'product_id': rfq_line.product_id.id,
                'quantity': rfq_line.quantity,
                'price_unit': float(item.get('price_unit', 0.0))
            })

        # Submit Quotation
        quote.action_submit()

        return {
            'status': 'success',
            'quotation_id': quote.id,
            'quotation_number': quote.quotation_number
        }
