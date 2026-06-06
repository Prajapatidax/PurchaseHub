/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillStart, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class PurchaseHubComparison extends Component {
    static template = "purchasehub.ComparisonTemplate";

    setup() {
        this.orm = useService("orm");
        this.actionService = useService("action");
        this.notification = useService("notification");
        
        // Retrieve RFQ ID from action context
        const context = this.props.action.context || {};
        this.rfqId = context.rfq_id || this.props.action.params?.rfq_id || null;

        this.state = useState({
            rfqData: {},
            sortedQuotations: [],
            sortBy: 'price', // price, delivery, rating
            filterStatus: 'all', // all, approved, submitted, under_review
            loading: true,
            highlights: {
                lowestPriceId: null,
                fastestDeliveryId: null,
                highestRatingId: null,
                recommendedId: null
            }
        });

        onWillStart(async () => {
            if (this.rfqId) {
                await this.loadComparisonData();
            } else {
                this.state.loading = false;
                console.error("No RFQ ID provided in action context.");
            }
        });
    }

    async loadComparisonData() {
        this.state.loading = true;
        try {
            const data = await this.orm.call("purchasehub.rfq", "get_comparison_data", [this.rfqId]);
            this.state.rfqData = data;
            if (data.quotations && data.quotations.length > 0) {
                this.calculateHighlights(data.quotations);
                this.applySortingAndFiltering();
            } else {
                this.state.sortedQuotations = [];
            }
        } catch (error) {
            console.error("Failed to load quotation comparison data", error);
        } finally {
            this.state.loading = false;
        }
    }

    calculateHighlights(quotations) {
        if (!quotations || quotations.length === 0) return;

        let lowestPrice = Infinity;
        let lowestPriceId = null;
        let fastestDelivery = Infinity;
        let fastestDeliveryId = null;
        let highestRating = -1;
        let highestRatingId = null;

        // Find min/max values
        quotations.forEach(q => {
            if (q.quotation_amount < lowestPrice) {
                lowestPrice = q.quotation_amount;
                lowestPriceId = q.id;
            }
            if (q.delivery_days < fastestDelivery) {
                fastestDelivery = q.delivery_days;
                fastestDeliveryId = q.id;
            }
            if (q.vendor_rating > highestRating) {
                highestRating = q.vendor_rating;
                highestRatingId = q.id;
            }
        });

        this.state.highlights.lowestPriceId = lowestPriceId;
        this.state.highlights.fastestDeliveryId = fastestDeliveryId;
        this.state.highlights.highestRatingId = highestRatingId;

        // Calculate recommendation score:
        // Score = (MinPrice/Price * 0.5) + (MinDelivery/Delivery * 0.25) + (Rating/5.0 * 0.25)
        let bestScore = -1;
        let recommendedId = null;

        quotations.forEach(q => {
            const priceFactor = lowestPrice > 0 ? (lowestPrice / q.quotation_amount) : 1.0;
            const deliveryFactor = fastestDelivery > 0 ? (fastestDelivery / q.delivery_days) : 1.0;
            const ratingFactor = q.vendor_rating / 5.0;

            const score = (priceFactor * 0.5) + (deliveryFactor * 0.25) + (ratingFactor * 0.25);
            q.score = Math.round(score * 100);

            if (score > bestScore) {
                bestScore = score;
                recommendedId = q.id;
            }
        });

        this.state.highlights.recommendedId = recommendedId;
    }

    applySortingAndFiltering() {
        let list = [...(this.state.rfqData.quotations || [])];

        // Filter
        if (this.state.filterStatus !== 'all') {
            list = list.filter(q => q.status === this.state.filterStatus);
        }

        // Sort
        list.sort((a, b) => {
            if (this.state.sortBy === 'price') {
                return a.quotation_amount - b.quotation_amount;
            } else if (this.state.sortBy === 'delivery') {
                return a.delivery_days - b.delivery_days;
            } else if (this.state.sortBy === 'rating') {
                return b.vendor_rating - a.vendor_rating; // Higher rating first
            } else if (this.state.sortBy === 'recommendation') {
                return b.score - a.score; // Higher score first
            }
            return 0;
        });

        this.state.sortedQuotations = list;
    }

    setSortBy(field) {
        this.state.sortBy = field;
        this.applySortingAndFiltering();
    }

    setFilterStatus(status) {
        this.state.filterStatus = status;
        this.applySortingAndFiltering();
    }

    async approveQuotation(quoteId) {
        this.state.loading = true;
        try {
            const actionResult = await this.orm.call("purchasehub.quotation", "action_approve", [quoteId]);
            this.notification.add("Quotation Approved Successfully! Purchase Order Generated.", {
                type: "success",
                title: "Success"
            });
            // Redirect to PO form view
            if (actionResult && actionResult.type === 'ir.actions.act_window') {
                this.actionService.doAction(actionResult);
            } else {
                await this.loadComparisonData();
            }
        } catch (error) {
            this.notification.add(error.message || "Failed to approve quotation.", {
                type: "danger",
                title: "Error"
            });
            await this.loadComparisonData();
        }
    }

    async rejectQuotation(quoteId) {
        this.state.loading = true;
        try {
            await this.orm.call("purchasehub.quotation", "action_reject", [quoteId]);
            this.notification.add("Quotation Rejected.", {
                type: "warning",
                title: "Quotation Rejected"
            });
            await this.loadComparisonData();
        } catch (error) {
            this.notification.add(error.message || "Failed to reject quotation.", {
                type: "danger",
                title: "Error"
            });
            await this.loadComparisonData();
        }
    }

    goBack() {
        this.actionService.doAction({
            type: "ir.actions.act_window",
            res_model: "purchasehub.rfq",
            res_id: this.rfqId,
            views: [[false, "form"]],
            target: "current"
        });
    }
}

registry.category("actions").add("purchasehub_comparison", PurchaseHubComparison);
