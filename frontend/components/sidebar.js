class ErpSidebar extends HTMLElement {
    static get observedAttributes() {
        return ['active-item'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'active-item' && oldValue !== newValue) {
            this.updateActiveItem(newValue);
        }
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const activeItem = this.getAttribute('active-item') || 'dashboard';
        const role = localStorage.getItem('role') || 'Admin';
        const userName = localStorage.getItem('user_name') || 'Administrator';
        
        let profileIcon = 'fa-user-tie';
        if (role === 'Vendor') profileIcon = 'fa-building';
        else if (role === 'Manager') profileIcon = 'fa-user-gear';

        this.innerHTML = `
            <aside class="sidebar-container flex flex-col z-20 shrink-0 h-full">
                <!-- Sidebar Header -->
                <div class="h-16 flex items-center px-6 border-b border-slate-200 shrink-0 bg-slate-50">
                    <div class="flex items-center space-x-3">
                        <div class="w-8 h-8 rounded-lg bg-[#714B67] flex items-center justify-center text-white font-bold text-lg shadow-sm">PH</div>
                        <span class="font-semibold text-slate-800 text-lg tracking-wide">PurchaseHub</span>
                    </div>
                </div>
                
                <!-- User Profile Block -->
                <a href="/profile" class="p-4 border-b border-slate-200 bg-slate-50 flex items-center space-x-3 hover:bg-slate-100 transition-colors">
                    <div class="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center border border-slate-300 shadow-sm shrink-0">
                        <i class="fa-solid ${profileIcon} text-lg" id="profile-role-icon"></i>
                    </div>
                    <div class="overflow-hidden">
                        <div class="text-sm font-semibold text-slate-800 truncate" id="profile-name">${userName}</div>
                        <div class="text-[10px] text-slate-500 font-bold uppercase tracking-wider" id="profile-role">${role}</div>
                    </div>
                </a>
                
                <!-- Navigation Links -->
                <nav class="flex-1 py-4 space-y-0.5 overflow-y-auto" id="sidebar-nav">
                    <!-- Dashboard Group -->
                    <a href="/dashboard" class="nav-link" data-nav="dashboard">
                        <i class="fa-solid fa-chart-pie w-5 text-center text-base mr-3"></i>
                        <span>Dashboard</span>
                    </a>

                    <!-- Procurement Group Header -->
                    <div class="px-6 pt-4 pb-1 text-[10px] font-bold text-slate-450 uppercase tracking-wider">Procurement</div>
                    
                    <a href="/rfqs" class="nav-link" data-nav="rfqs">
                        <i class="fa-solid fa-file-signature w-5 text-center text-base mr-3"></i>
                        <span>RFQs</span>
                    </a>

                    <!-- Show portal for Vendor, else standard quotations -->
                    ${role === 'Vendor' ? `
                        <a href="/quotations" class="nav-link" data-nav="quotations">
                            <i class="fa-solid fa-door-open w-5 text-center text-base mr-3"></i>
                            <span>Quotations</span>
                        </a>
                    ` : `
                        <a href="/quotations" class="nav-link" data-nav="quotations">
                            <i class="fa-solid fa-scale-balanced w-5 text-center text-base mr-3"></i>
                            <span>Quotations</span>
                        </a>
                        <a href="/comparison" class="nav-link" data-nav="comparison">
                            <i class="fa-solid fa-code-compare w-5 text-center text-base mr-3"></i>
                            <span>Comparison</span>
                        </a>
                    `}

                    ${role !== 'Vendor' ? `
                        <a href="/approvals" class="nav-link" data-nav="approvals">
                            <i class="fa-solid fa-clipboard-check w-5 text-center text-base mr-3"></i>
                            <span>Approvals</span>
                        </a>
                    ` : ''}

                    <!-- Vendor Management Header -->
                    <div class="px-6 pt-4 pb-1 text-[10px] font-bold text-slate-450 uppercase tracking-wider">Vendor Management</div>
                    <a href="/vendors" class="nav-link" data-nav="vendors">
                        <i class="fa-solid fa-building-user w-5 text-center text-base mr-3"></i>
                        <span>Vendors</span>
                    </a>

                    <!-- Orders Group -->
                    <div class="px-6 pt-4 pb-1 text-[10px] font-bold text-slate-450 uppercase tracking-wider">Orders</div>
                    <a href="/purchase-orders" class="nav-link" data-nav="purchase-orders">
                        <i class="fa-solid fa-file-invoice-dollar w-5 text-center text-base mr-3"></i>
                        <span>Purchase Orders</span>
                    </a>
                    
                    <a href="/invoices" class="nav-link" data-nav="invoices">
                        <i class="fa-solid fa-file-invoice w-5 text-center text-base mr-3"></i>
                        <span>Invoices</span>
                    </a>

                    <!-- Analytics Group -->
                    ${role !== 'Vendor' && role !== 'Manager' ? `
                        <div class="px-6 pt-4 pb-1 text-[10px] font-bold text-slate-450 uppercase tracking-wider">Analytics</div>
                        <a href="/reports" class="nav-link" data-nav="reports">
                            <i class="fa-solid fa-chart-line w-5 text-center text-base mr-3"></i>
                            <span>Reports</span>
                        </a>
                    ` : ''}

                    <!-- Administration Group -->
                    ${role === 'Admin' || role === 'Procurement Officer' ? `
                        <div class="px-6 pt-4 pb-1 text-[10px] font-bold text-slate-450 uppercase tracking-wider">Administration</div>
                        <a href="/activity-logs" class="nav-link" data-nav="activity-logs">
                            <i class="fa-solid fa-clock-rotate-left w-5 text-center text-base mr-3"></i>
                            <span>Activity Logs</span>
                        </a>
                        <a href="/settings" class="nav-link" data-nav="settings">
                            <i class="fa-solid fa-gears w-5 text-center text-base mr-3"></i>
                            <span>Settings</span>
                        </a>
                    ` : ''}
                </nav>
                
                <!-- Sidebar Footer -->
                <div class="p-4 border-t border-slate-200 bg-slate-50 shrink-0 flex justify-between items-center text-xs text-slate-500">
                    <span>v18.0 (Enterprise)</span>
                    <button onclick="handleLogout()" class="text-slate-500 hover:text-red-600 font-semibold flex items-center transition-colors">
                        <i class="fa-solid fa-power-off mr-1"></i> Sign Out
                    </button>
                </div>
            </aside>
        `;
        this.updateActiveItem(activeItem);
    }

    updateActiveItem(active) {
        this.querySelectorAll('.nav-link').forEach(link => {
            const nav = link.getAttribute('data-nav');
            if (nav === active) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
}

customElements.define('erp-sidebar', ErpSidebar);
