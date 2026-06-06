/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onWillStart, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class PurchaseHubDashboard extends Component {
    static template = "purchasehub.DashboardTemplate";

    setup() {
        this.orm = useService("orm");
        this.actionService = useService("action");
        this.state = useState({
            stats: {},
            loading: true
        });

        onWillStart(async () => {
            await this.loadDashboardData();
        });

        onMounted(() => {
            // Give OWL template a brief moment to paint
            setTimeout(() => {
                this.renderCharts();
            }, 100);
        });
    }

    async loadDashboardData() {
        this.state.loading = true;
        try {
            this.state.stats = await this.orm.call("purchasehub.vendor", "get_dashboard_stats", []);
        } catch (error) {
            console.error("Failed to load dashboard statistics", error);
        } finally {
            this.state.loading = false;
        }
    }

    renderCharts() {
        if (this.state.loading || !this.state.stats || !this.state.stats.charts) {
            return;
        }

        const stats = this.state.stats;

        // 1. Vendor Performance Chart
        const ctxVendor = document.getElementById('chartVendorPerf');
        if (ctxVendor && window.Chart) {
            new window.Chart(ctxVendor, {
                type: 'bar',
                data: {
                    labels: stats.charts.vendor_perf.labels || [],
                    datasets: [{
                        label: 'Average Rating (out of 5)',
                        data: stats.charts.vendor_perf.data || [],
                        backgroundColor: 'rgba(47, 133, 90, 0.75)',
                        borderColor: 'rgba(47, 133, 90, 1)',
                        borderWidth: 1.5,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 5,
                            grid: { color: 'rgba(0,0,0,0.05)' }
                        },
                        x: { grid: { display: false } }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
        }

        // 2. RFQ Status Distribution Chart
        const ctxRfq = document.getElementById('chartRfqDist');
        if (ctxRfq && window.Chart) {
            new window.Chart(ctxRfq, {
                type: 'doughnut',
                data: {
                    labels: stats.charts.rfq_dist.labels || [],
                    datasets: [{
                        data: stats.charts.rfq_dist.data || [],
                        backgroundColor: [
                            'rgba(142, 148, 153, 0.8)', // Draft - Gray
                            'rgba(49, 151, 149, 0.8)',  // Sent - Teal
                            'rgba(43, 108, 176, 0.8)',  // Received - Blue
                            'rgba(74, 21, 75, 0.8)'     // Closed - Purple
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }

        // 3. Spending Analytics per Category
        const ctxSpend = document.getElementById('chartCategorySpend');
        if (ctxSpend && window.Chart) {
            new window.Chart(ctxSpend, {
                type: 'pie',
                data: {
                    labels: stats.charts.cat_spend.labels || [],
                    datasets: [{
                        data: stats.charts.cat_spend.data || [],
                        backgroundColor: [
                            '#4a154b', // Raw Materials
                            '#319795', // Services
                            '#2b6cb0', // Electronics
                            '#d69e2e', // Logistics
                            '#e53e3e'  // Office Supplies
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' }
                    }
                }
            });
        }
    }

    openVendors() {
        this.actionService.doAction("purchasehub.action_purchasehub_vendor");
    }

    openRfqs() {
        this.actionService.doAction("purchasehub.action_purchasehub_rfq");
    }

    openQuotations() {
        this.actionService.doAction("purchasehub.action_purchasehub_quotation");
    }

    openPOs() {
        this.actionService.doAction("purchasehub.action_purchasehub_purchase_order");
    }
}

registry.category("actions").add("purchasehub_dashboard", PurchaseHubDashboard);
