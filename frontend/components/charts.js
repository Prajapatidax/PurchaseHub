// Odoo ERP Reusable Analytics Components

// 1. KPI Analytics Widget: <erp-analytics-card title="Total Spend" value="$0.00" trend="+12%"></erp-analytics-card>
class ErpAnalyticsCard extends HTMLElement {
    static get observedAttributes() { return ['value', 'trend', 'subtitle']; }
    attributeChangedCallback() { this.render(); }
    connectedCallback() { this.render(); }
    render() {
        const title = this.getAttribute('title') || '';
        const value = this.getAttribute('value') || 'Rs. 0.00';
        const trend = this.getAttribute('trend') || '';
        const icon = this.getAttribute('icon') || '';
        const subtitle = this.getAttribute('subtitle') || '';

        let rightHtml = '';
        if (trend) {
            const isNegative = trend.startsWith('-');
            const colorClass = isNegative ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50';
            const iconClass = isNegative ? 'fa-arrow-down' : 'fa-arrow-up';
            rightHtml = `<span class="${colorClass} text-[10px] font-bold px-1.5 py-0.5 rounded-full"><i class="fa-solid ${iconClass} mr-0.5"></i>${trend}</span>`;
        } else if (icon) {
            rightHtml = `<i class="fa-solid ${icon} text-[#714B67] text-sm opacity-60"></i>`;
        }

        this.innerHTML = `
            <div class="kpi-card flex flex-col justify-between h-full bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-start">
                    <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">${title}</span>
                    ${rightHtml}
                </div>
                <div class="mt-4">
                    <h3 class="text-xl font-bold text-slate-800 transition-all duration-300" id="card-value-display">${value}</h3>
                    ${subtitle ? `<span class="text-[10px] text-slate-400 mt-0.5 block">${subtitle}</span>` : ''}
                </div>
            </div>
        `;
    }
}
customElements.define('erp-analytics-card', ErpAnalyticsCard);

// 2. Chart Embed Panel: <erp-chart-card title="Spend Trends" chart-id="trend-container" height="350"></erp-chart-card>
class ErpChartCard extends HTMLElement {
    connectedCallback() {
        const title = this.getAttribute('title') || '';
        const chartId = this.getAttribute('chart-id') || 'recharts-container';
        const height = this.getAttribute('height') || '350';
        
        this.className = "block bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col";
        this.style.height = `${height}px`;
        this.innerHTML = `
            <h3 class="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">${title}</h3>
            <div id="${chartId}" class="flex-1 w-full h-full min-h-[150px]">
                <!-- Dynamic chart injection -->
            </div>
        `;
    }
}
customElements.define('erp-chart-card', ErpChartCard);

// ================= React Recharts Adpaters =================
window.renderSpendTrendChart = function(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = window.Recharts;
    const element = React.createElement(
        ResponsiveContainer,
        { width: "100%", height: "100%" },
        React.createElement(
            LineChart,
            { data: data, margin: { top: 10, right: 10, left: -15, bottom: 0 } },
            React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "#F3F4F6" }),
            React.createElement(XAxis, { dataKey: "month", tick: { fill: '#6B7280', fontSize: 10 } }),
            React.createElement(YAxis, { tick: { fill: '#6B7280', fontSize: 10 } }),
            React.createElement(Tooltip, {
                contentStyle: {
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '11px'
                }
            }),
            React.createElement(Line, {
                type: "monotone",
                dataKey: "spend",
                stroke: "#714B67",
                strokeWidth: 2,
                activeDot: { r: 6 },
                name: "Spend (Rs.)"
            })
        )
    );
    
    const root = ReactDOM.createRoot(container);
    root.render(element);
    return root;
};

window.renderSpendCategoryChart = function(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } = window.Recharts;
    const COLORS = ['#714B67', '#875A7B', '#B08EAA', '#3B82F6', '#22C55E', '#F59E0B'];
    
    const element = React.createElement(
        ResponsiveContainer,
        { width: "100%", height: "100%" },
        React.createElement(
            PieChart,
            {},
            React.createElement(
                Pie,
                {
                    data: data,
                    cx: "50%",
                    cy: "50%",
                    innerRadius: 60,
                    outerRadius: 85,
                    paddingAngle: 3,
                    dataKey: "spend",
                    nameKey: "category"
                },
                data.map((entry, index) => 
                    React.createElement(Cell, { key: `cell-${index}`, fill: COLORS[index % COLORS.length] })
                )
            ),
            React.createElement(Tooltip, {
                contentStyle: {
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '11px'
                },
                formatter: (value) => `Rs. ${value.toLocaleString()}`
            }),
            React.createElement(Legend, {
                verticalAlign: "bottom",
                height: 36,
                iconSize: 10,
                iconType: "circle",
                wrapperStyle: { fontSize: '11px', color: '#4B5563' }
            })
        )
    );
    
    const root = ReactDOM.createRoot(container);
    root.render(element);
    return root;
};

window.renderVendorPerformanceChart = function(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } = window.Recharts;
    const element = React.createElement(
        ResponsiveContainer,
        { width: "100%", height: "100%" },
        React.createElement(
            BarChart,
            { data: data, margin: { top: 10, right: 10, left: -20, bottom: 0 } },
            React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: "#F3F4F6" }),
            React.createElement(XAxis, { dataKey: "company_name", tick: { fill: '#6B7280', fontSize: 10 } }),
            React.createElement(YAxis, { domain: [0, 5], tick: { fill: '#6B7280', fontSize: 10 } }),
            React.createElement(Tooltip, {
                contentStyle: {
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '11px'
                }
            }),
            React.createElement(
                Bar,
                { dataKey: "rating", name: "Quality Rating", fill: "#714B67", radius: [4, 4, 0, 0] },
                data.map((entry, index) => 
                    React.createElement(Cell, { key: `cell-${index}`, fill: entry.rating >= 4.5 ? '#714B67' : '#B08EAA' })
                )
            )
        )
    );
    
    const root = ReactDOM.createRoot(container);
    root.render(element);
    return root;
};

window.renderApprovalStatsChart = function(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    const { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } = window.Recharts;
    const COLORS = ['#714B67', '#875A7B', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6'];
    
    const element = React.createElement(
        ResponsiveContainer,
        { width: "100%", height: "100%" },
        React.createElement(
            PieChart,
            {},
            React.createElement(
                Pie,
                {
                    data: data,
                    cx: "50%",
                    cy: "50%",
                    innerRadius: 60,
                    outerRadius: 85,
                    paddingAngle: 3,
                    dataKey: "value",
                    nameKey: "status"
                },
                data.map((entry, index) => 
                    React.createElement(Cell, { key: `cell-${index}`, fill: COLORS[index % COLORS.length] })
                )
            ),
            React.createElement(Tooltip, {
                contentStyle: {
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '11px'
                }
            }),
            React.createElement(Legend, {
                verticalAlign: "bottom",
                height: 36,
                iconSize: 10,
                iconType: "circle",
                wrapperStyle: { fontSize: '11px', color: '#4B5563' }
            })
        )
    );
    
    const root = ReactDOM.createRoot(container);
    root.render(element);
    return root;
};
