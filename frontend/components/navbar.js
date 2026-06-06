class ErpNavbar extends HTMLElement {
    static get observedAttributes() {
        return ['page-title'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'page-title' && oldValue !== newValue) {
            const titleEl = this.querySelector('#view-title');
            if (titleEl) titleEl.textContent = newValue;
        }
    }

    connectedCallback() {
        this.render();
    }

    render() {
        const title = this.getAttribute('page-title') || 'Dashboard';
        const companyName = localStorage.getItem('settings_company_name') || 'My Company (San Francisco)';

        this.innerHTML = `
            <header class="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 sticky top-0 z-30 w-full">
                <div class="flex items-center space-x-6 flex-1">
                    <!-- Dashboard Search Bar -->
                    <div class="relative w-64 max-w-sm">
                        <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                            <i class="fa-solid fa-magnifying-glass text-sm"></i>
                        </span>
                        <input type="text" id="global-search-input" placeholder="Search..." class="pl-9 pr-3 py-1.5 w-full text-xs rounded-full border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#714B67] transition-all">
                    </div>
                    
                    <h2 class="text-md font-semibold text-slate-700" id="view-title">${title}</h2>
                </div>
                
                <!-- Navbar Actions -->
                <div class="flex items-center space-x-6">
                    <!-- Company Switcher -->
                    <div class="flex items-center space-x-2 border-r border-slate-200 pr-4">
                        <i class="fa-solid fa-building text-slate-400 text-xs"></i>
                        <span class="text-xs font-medium text-slate-600" id="navbar-company-name">${companyName}</span>
                    </div>

                    <!-- Emails Log Modal trigger -->
                    <button onclick="openEmailsModal()" class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 relative transition-colors" title="System Audit Emails">
                        <i class="fa-solid fa-envelope-open-text text-md"></i>
                        <span id="emails-count-badge" class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold hidden">0</span>
                    </button>

                    <!-- Notifications -->
                    <div class="relative">
                        <button class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 relative transition-colors" id="btn-toggle-notifications" onclick="toggleNotifications()">
                            <i class="fa-solid fa-bell text-md"></i>
                            <span id="notif-dot" class="absolute top-1 right-1 bg-[#714B67] rounded-full w-2 h-2 ring-2 ring-white hidden"></span>
                        </button>
                        <!-- Notifications Panel -->
                        <div id="notifications-panel" class="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-30 hidden py-2 max-h-96 overflow-y-auto">
                            <h3 class="px-4 py-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">Activities</h3>
                            <div id="notifications-list" class="divide-y divide-slate-100">
                                <!-- Generated list items -->
                                <p class="text-xs text-slate-400 text-center py-4">No recent activities.</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Avatar Indicator -->
                    <div class="flex items-center space-x-2">
                        <div class="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center relative">
                            <i class="fa-solid fa-user text-slate-400"></i>
                            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white"></span>
                        </div>
                    </div>
                </div>
            </header>
        `;
    }
}

customElements.define('erp-navbar', ErpNavbar);
