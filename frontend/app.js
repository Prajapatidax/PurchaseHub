// VendorBridge ERP - Frontend Application Controller

// Global App State
const state = {
    token: localStorage.getItem('token') || sessionStorage.getItem('token') || null,
    user: null,
    activeView: 'dashboard',
    charts: {
        spendTrend: null,
        spendCategory: null,
        spendTrendFull: null,
        spendCategoryFull: null
    },
    cachedVendors: [],
    emails: []
};

// ================= API FETCH CLIENT WRAPPER =================
async function apiRequest(endpoint, options = {}) {
    const url = `/api${endpoint}`;
    
    // Set headers
    const headers = options.headers || {};
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    if (!(options.body instanceof FormData) && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    
    options.headers = headers;
    
    try {
        const response = await fetch(url, options);
        
        // Handle unauthorized session
        if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/signup') {
            showToast('Session expired. Please log in again.', 'error');
            handleLogout();
            return null;
        }
        
        // Handle PDF downloads
        if (endpoint.endsWith('/download')) {
             return response;
        }
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'API operation failed');
        }
        return data;
    } catch (error) {
        console.error(`API Error on ${endpoint}:`, error);
        showToast(error.message, 'error');
        return null;
    }
}

// ================= INITIALIZATION & AUTHENTICATION =================
document.addEventListener('DOMContentLoaded', async () => {
    // Register Hash change listener for routing
    window.addEventListener('hashchange', handleRouting);
    
    // Wire up form handlers
    document.getElementById('login-form').addEventListener('submit', handleLoginSubmit);
    document.getElementById('signup-form').addEventListener('submit', handleSignupSubmit);
    document.getElementById('forgot-form').addEventListener('submit', handleForgotSubmit);
    
    // Wire up modal handlers
    document.getElementById('vendor-form').addEventListener('submit', handleVendorSubmit);
    document.getElementById('rfq-form').addEventListener('submit', handleRFQSubmit);
    document.getElementById('quote-form').addEventListener('submit', handleQuoteSubmit);
    document.getElementById('approval-form').addEventListener('submit', handleApprovalSubmit);
    document.getElementById('invoice-form').addEventListener('submit', handleInvoiceSubmit);

    // Auth screen tab switches
    document.getElementById('go-to-signup').addEventListener('click', (e) => {
        e.preventDefault();
        showAuthView('signup');
    });
    document.getElementById('go-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        showAuthView('login');
    });
    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        showAuthView('forgot');
    });
    document.getElementById('forgot-back-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        showAuthView('login');
    });
    
    // Check if token exists, validate user session
    if (state.token) {
        const valid = await validateSession();
        if (valid) {
            setupUIForRole();
            handleRouting();
            startNotificationPoller();
        } else {
            showLoginModal();
        }
    } else {
        showLoginModal();
    }
});

async function validateSession() {
    const user = await apiRequest('/auth/me');
    if (user) {
        state.user = user;
        document.getElementById('profile-name').textContent = user.name;
        document.getElementById('profile-role').textContent = user.role;
        return true;
    }
    return false;
}

function showLoginModal() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('app-layout').classList.add('hidden');
    showAuthView('login');
}

function showAuthView(view) {
    document.getElementById('login-form-view').classList.add('hidden');
    document.getElementById('signup-form-view').classList.add('hidden');
    document.getElementById('forgot-form-view').classList.add('hidden');
    
    if (view === 'login') {
        document.getElementById('login-form-view').classList.remove('hidden');
    } else if (view === 'signup') {
        document.getElementById('signup-form-view').classList.remove('hidden');
        toggleCompanyField();
    } else if (view === 'forgot') {
        document.getElementById('forgot-form-view').classList.remove('hidden');
    }
}

function toggleCompanyField() {
    const roleSelect = document.getElementById('signup-role');
    const companyContainer = document.getElementById('signup-company-container');
    const companyInput = document.getElementById('signup-company');
    
    if (roleSelect.value === 'Vendor') {
        companyContainer.classList.remove('hidden');
        companyInput.setAttribute('required', 'true');
    } else {
        companyContainer.classList.add('hidden');
        companyInput.removeAttribute('required');
    }
}

// Demo Autofill Helper
function autofillLogin(email, password) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
    showToast('Credentials autofilled! Click Sign In.', 'info');
}

async function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('login-remember').checked;
    
    const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: { email, password, remember_me: rememberMe }
    });
    
    if (result) {
        state.token = result.access_token;
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('token', result.access_token);
        
        state.user = {
            id: result.user_id,
            name: result.user_name,
            role: result.role,
            email: email
        };
        
        document.getElementById('profile-name').textContent = result.user_name;
        document.getElementById('profile-role').textContent = result.role;
        
        showToast(`Welcome back, ${result.user_name}!`, 'success');
        
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-layout').classList.remove('hidden');
        
        setupUIForRole();
        window.location.hash = '#dashboard';
        handleRouting();
        startNotificationPoller();
    }
}

async function handleSignupSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const role = document.getElementById('signup-role').value;
    const companyName = document.getElementById('signup-company').value;
    const password = document.getElementById('signup-password').value;
    
    const result = await apiRequest('/auth/signup', {
        method: 'POST',
        body: { name, email, role, company_name: companyName || null, password }
    });
    
    if (result) {
        showToast('Registration successful! Please log in.', 'success');
        showAuthView('login');
        document.getElementById('login-email').value = email;
        document.getElementById('login-password').value = '';
    }
}

async function handleForgotSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    
    const result = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { email }
    });
    
    if (result) {
        showToast(result.message, 'success');
        showAuthView('login');
    }
}

function handleLogout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    
    // Reset charts
    Object.keys(state.charts).forEach(key => {
        if (state.charts[key]) {
            state.charts[key].destroy();
            state.charts[key] = null;
        }
    });
    
    showLoginModal();
}

// Set up UI views permissions based on roles
function setupUIForRole() {
    const role = state.user.role;
    
    // Sidebar elements
    const navVendors = document.getElementById('nav-vendors');
    const navRFQs = document.getElementById('nav-rfqs');
    const navVendorPortal = document.getElementById('nav-vendor-portal');
    const navComparison = document.getElementById('nav-comparison');
    const navApprovals = document.getElementById('nav-approvals');
    const navAudit = document.getElementById('nav-audit');
    const navAnalytics = document.getElementById('nav-analytics');
    const btnAddVendor = document.getElementById('btn-add-vendor');
    const btnCreateRFQ = document.getElementById('btn-create-rfq');
    const btnAddInvoice = document.getElementById('btn-add-invoice');
    const quickActions = document.getElementById('procurement-actions');
    
    // Hide everything by default
    navVendors.classList.remove('hidden');
    navRFQs.classList.remove('hidden');
    navVendorPortal.classList.add('hidden');
    navComparison.classList.remove('hidden');
    navApprovals.classList.remove('hidden');
    navAudit.classList.remove('hidden');
    navAnalytics.classList.remove('hidden');
    
    if (role === 'Vendor') {
        // Vendor gets Vendor Portal and POs/Invoices, hides comparisons, audit trail, reports
        navVendorPortal.classList.remove('hidden');
        navComparison.classList.add('hidden');
        navApprovals.classList.add('hidden');
        navAudit.classList.add('hidden');
        navAnalytics.classList.add('hidden');
        
        // Hide Admin modifications
        if (btnAddVendor) btnAddVendor.classList.add('hidden');
        if (btnCreateRFQ) btnCreateRFQ.classList.add('hidden');
        if (btnAddInvoice) btnAddInvoice.classList.add('hidden');
        if (quickActions) quickActions.classList.add('hidden');
    } else if (role === 'Manager') {
        // Manager approves but cannot modify vendors/RFQs directly
        navComparison.classList.add('hidden');
        navVendorPortal.classList.add('hidden');
        if (btnAddVendor) btnAddVendor.classList.add('hidden');
        if (btnCreateRFQ) btnCreateRFQ.classList.add('hidden');
        if (btnAddInvoice) btnAddInvoice.classList.add('hidden');
        if (quickActions) quickActions.classList.add('hidden');
    } else {
        // Admin & Procurement Officer get full capabilities
        navVendorPortal.classList.add('hidden');
        if (btnAddVendor) btnAddVendor.classList.remove('hidden');
        if (btnCreateRFQ) btnCreateRFQ.classList.remove('hidden');
        if (btnAddInvoice) btnAddInvoice.classList.remove('hidden');
        if (quickActions) quickActions.classList.remove('hidden');
    }
}


// ================= ROUTING CONTROLLER =================
function handleRouting() {
    const hash = window.location.hash || '#dashboard';
    const viewName = hash.substring(1);
    
    // Enforce role guards
    if (state.user) {
        const role = state.user.role;
        if (role === 'Vendor' && ['comparison', 'approvals', 'analytics', 'audit-trail'].includes(viewName)) {
            window.location.hash = '#dashboard';
            return;
        }
        if (role === 'Manager' && ['comparison', 'vendor-portal'].includes(viewName)) {
             window.location.hash = '#dashboard';
             return;
        }
    }
    
    // Toggle active link styles
    document.querySelectorAll('#sidebar-nav .nav-link').forEach(link => {
        if (link.getAttribute('href') === hash) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
    
    // Toggle view visibility
    document.querySelectorAll('.view-pane').forEach(pane => {
        pane.classList.add('hidden');
    });
    
    const targetPane = document.getElementById(`view-${viewName}`);
    if (targetPane) {
        targetPane.classList.remove('hidden');
        
        // Update Title bar
        const titleMap = {
            'dashboard': 'Enterprise Dashboard Overview',
            'vendors': 'Vendor Partner Registry',
            'rfqs': 'RFQ Bidding & Procurement',
            'vendor-portal': 'Vendor Portal Dashboard',
            'comparison': 'Quotation Comparison Panel',
            'approvals': 'Manager Approval Workflows',
            'purchase-orders': 'Purchase Order Ledger',
            'invoices': 'Invoice Management',
            'analytics': 'Reports & Spend Analytics',
            'audit-trail': 'System Audits & Compliance Logs'
        };
        document.getElementById('view-title').textContent = titleMap[viewName] || 'VendorBridge';
        
        // Trigger view loader
        triggerViewLoader(viewName);
    }
}

function triggerViewLoader(viewName) {
    switch (viewName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'vendors':
            loadVendors();
            break;
        case 'rfqs':
            loadRFQs();
            break;
        case 'vendor-portal':
            loadVendorPortal();
            break;
        case 'comparison':
            loadComparisonRFQs();
            break;
        case 'approvals':
            loadApprovals();
            break;
        case 'purchase-orders':
            loadPurchaseOrders();
            break;
        case 'invoices':
            loadInvoices();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'audit-trail':
            loadAuditLogs();
            break;
    }
}

// ================= VIEW DATA LOADERS =================

// 1. Load Dashboard
async function loadDashboard() {
    const reports = await apiRequest('/reports/');
    if (!reports) return;
    
    const { kpis, monthly_spend, category_spend } = reports;
    
    // Set KPIs
    document.getElementById('kpi-spend').textContent = `$${kpis.total_spend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('kpi-vendors').textContent = kpis.total_vendors;
    document.getElementById('kpi-rfqs').textContent = kpis.active_rfqs;
    document.getElementById('kpi-approvals').textContent = kpis.pending_approvals;
    document.getElementById('kpi-pos').textContent = kpis.purchase_orders;
    document.getElementById('kpi-invoices').textContent = kpis.invoices_generated;
    
    // 1.1 Spend Trend Chart
    const monthlyLabels = monthly_spend.map(x => x.month);
    const monthlyData = monthly_spend.map(x => x.spend);
    
    if (state.charts.spendTrend) state.charts.spendTrend.destroy();
    
    const ctxTrend = document.getElementById('chart-spend-trend').getContext('2d');
    state.charts.spendTrend = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: monthlyLabels,
            datasets: [{
                label: 'Procurement Spend ($)',
                data: monthlyData,
                borderColor: '#4f46e5', // Indigo-600
                backgroundColor: 'rgba(79, 70, 229, 0.05)',
                fill: true,
                tension: 0.3,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
    
    // 1.2 Spend Category Chart
    const categoryLabels = category_spend.map(x => x.category);
    const categoryData = category_spend.map(x => x.spend);
    
    if (state.charts.spendCategory) state.charts.spendCategory.destroy();
    
    const ctxCat = document.getElementById('chart-spend-category').getContext('2d');
    state.charts.spendCategory = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: categoryLabels,
            datasets: [{
                data: categoryData,
                backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#64748b'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 10 } }
                }
            }
        }
    });
}

// 2. Load Vendor Profiles
async function loadVendors() {
    const vendors = await apiRequest('/vendors/');
    if (!vendors) return;
    
    state.cachedVendors = vendors;
    
    renderVendorsTable(vendors);
}

function renderVendorsTable(vendors) {
    const tbody = document.querySelector('#vendors-table tbody');
    tbody.innerHTML = '';
    
    if (vendors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No vendor profiles found.</td></tr>`;
        return;
    }
    
    const role = state.user.role;
    const userEmail = state.user.email;
    
    vendors.forEach(v => {
        const ratingStars = getStarsHTML(v.rating);
        const ratingSelector = ['Admin', 'Procurement Officer', 'Manager'].includes(role) 
            ? `<button onclick="editRating(${v.id}, ${v.rating})" class="ml-1 text-slate-400 hover:text-brand-500" title="Change Rating"><i class="fa-solid fa-pen text-[10px]"></i></button>`
            : '';
            
        // Can edit only if Admin/Procurement officer, or Vendor is editing their own matching company
        const canEdit = ['Admin', 'Procurement Officer'].includes(role) || (role === 'Vendor' && v.email === userEmail);
        
        const actionsHTML = canEdit 
            ? `<div class="flex justify-end space-x-2">
                 <button onclick="editVendor(${v.id})" class="text-indigo-600 hover:text-indigo-900 font-semibold text-xs"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                 ${['Admin', 'Procurement Officer'].includes(role) ? `<button onclick="deleteVendor(${v.id})" class="text-rose-600 hover:text-rose-900 font-semibold text-xs"><i class="fa-solid fa-trash"></i> Delete</button>` : ''}
               </div>`
            : `<span class="text-slate-400 text-xs">View Only</span>`;
            
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/50 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-semibold text-slate-900">${v.company_name}</td>
            <td class="py-4 px-6">${v.gst_number}</td>
            <td class="py-4 px-6"><span class="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded">${v.category}</span></td>
            <td class="py-4 px-6">
                <div class="text-xs text-slate-500">${v.email}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">${v.phone}</div>
            </td>
            <td class="py-4 px-6">
                <div class="flex items-center text-amber-500">
                    ${ratingStars}
                    <span class="ml-1.5 text-xs text-slate-600 font-medium">${v.rating.toFixed(1)}</span>
                    ${ratingSelector}
                </div>
            </td>
            <td class="py-4 px-6">
                <span class="badge-status badge-status-${v.status.toLowerCase()}">${v.status}</span>
            </td>
            <td class="py-4 px-6 text-right">${actionsHTML}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterVendors() {
    const searchVal = document.getElementById('vendor-search-input').value.toLowerCase();
    const catVal = document.getElementById('vendor-category-select').value;
    
    let filtered = state.cachedVendors;
    if (searchVal) {
        filtered = filtered.filter(v => v.company_name.toLowerCase().includes(searchVal));
    }
    if (catVal) {
        filtered = filtered.filter(v => v.category === catVal);
    }
    renderVendorsTable(filtered);
}

// 3. Load RFQ Management
async function loadRFQs() {
    const statusFilter = document.getElementById('rfq-status-filter').value;
    const rfqs = await apiRequest(`/rfqs/?status_filter=${statusFilter}`);
    if (!rfqs) return;
    
    const container = document.getElementById('rfqs-grid-container');
    container.innerHTML = '';
    
    if (rfqs.length === 0) {
        container.innerHTML = `<div class="col-span-full py-16 text-center text-slate-400 bg-white border rounded-xl">No procurement RFQs found in this category.</div>`;
        return;
    }
    
    const role = state.user.role;
    
    rfqs.forEach(r => {
        const deadline = new Date(r.deadline);
        const deadlineStr = deadline.toLocaleDateString() + ' ' + deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const isOverdue = deadline < new Date();
        
        let fileLink = r.attachment_name 
            ? `<div class="mt-3 bg-slate-50 border border-slate-150 p-2.5 rounded-lg flex items-center justify-between text-xs hover:bg-slate-100 transition-colors">
                 <span class="text-slate-600 truncate mr-2"><i class="fa-regular fa-file-pdf text-red-500 mr-1.5 text-sm"></i>${r.attachment_name}</span>
                 <a href="${r.attachment_url}" target="_blank" class="text-brand-600 font-semibold hover:underline shrink-0">Download</a>
               </div>`
            : `<div class="mt-3 text-xs text-slate-400 italic"><i class="fa-solid fa-paperclip mr-1.5"></i>No technical specifications attached</div>`;
            
        let actions = '';
        if (['Admin', 'Procurement Officer'].includes(role)) {
            // Edit / delete options
            actions = `
                <div class="flex justify-between items-center mt-5 pt-4 border-t border-slate-100">
                    <button onclick="editRFQ(${r.id})" class="text-indigo-600 hover:text-indigo-900 font-semibold text-xs"><i class="fa-solid fa-pen-to-square"></i> Modify RFQ</button>
                    ${r.status === 'Draft' ? `<button onclick="publishRFQ(${r.id})" class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-100 font-semibold text-xs">Publish RFQ</button>` : ''}
                    <button onclick="deleteRFQ(${r.id})" class="text-rose-600 hover:text-rose-900 font-semibold text-xs"><i class="fa-solid fa-trash"></i> Delete</button>
                </div>
            `;
        }
        
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow flex flex-col justify-between';
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start">
                    <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">RFQ #${r.id}</span>
                    <span class="badge-status badge-status-${r.status.toLowerCase().replace(' ', '')}">${r.status}</span>
                </div>
                <h4 class="text-base font-bold text-slate-800 mt-2 font-['Outfit']">${r.title}</h4>
                <p class="text-xs text-slate-500 mt-1 line-clamp-3 leading-relaxed">${r.description}</p>
                
                <div class="grid grid-cols-2 gap-4 mt-4 border-t border-b border-slate-100 py-3 text-xs">
                    <div>
                        <span class="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Volume Required</span>
                        <span class="text-slate-800 font-semibold">${r.quantity.toLocaleString()} Units</span>
                    </div>
                    <div>
                        <span class="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Assigned Partners</span>
                        <span class="text-slate-800 font-semibold">${r.assigned_vendors.length} Vendors</span>
                    </div>
                </div>
                
                ${fileLink}
            </div>
            
            <div>
                <div class="mt-4 flex items-center text-xs justify-between">
                    <span class="text-slate-400"><i class="fa-regular fa-clock mr-1"></i> Deadline:</span>
                    <span class="${isOverdue ? 'text-red-500 font-bold' : 'text-slate-700 font-semibold'}">${deadlineStr}</span>
                </div>
                ${actions}
            </div>
        `;
        container.appendChild(card);
    });
}

// 4. Load Vendor Portal (For Vendors only)
async function loadVendorPortal() {
    // 4.1 Assigned RFQs
    const assignedRFQs = await apiRequest('/rfqs/');
    const portalAssigned = document.getElementById('portal-assigned-rfqs');
    portalAssigned.innerHTML = '';
    
    if (!assignedRFQs || assignedRFQs.length === 0) {
        portalAssigned.innerHTML = `<p class="text-slate-400 text-xs italic text-center py-8">No active RFQs assigned to your company currently.</p>`;
    } else {
        assignedRFQs.forEach(r => {
            const isClosed = new Date(r.deadline) < new Date();
            
            // Check if quote submitted
            const bidBtn = isClosed 
                ? `<span class="text-rose-500 text-xs font-bold"><i class="fa-solid fa-lock mr-1"></i> Bidding Closed</span>`
                : `<button onclick="openSubmitQuoteModal(${r.id})" class="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow transition-colors">Submit Bid</button>`;
                
            const item = document.createElement('div');
            item.className = 'border border-slate-150 rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors flex justify-between items-start';
            item.innerHTML = `
                <div class="space-y-1 w-2/3">
                    <span class="badge-status badge-status-${r.status.toLowerCase().replace(' ', '')}">${r.status}</span>
                    <h5 class="font-bold text-slate-800 text-sm mt-1.5">${r.title}</h5>
                    <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">${r.description}</p>
                    <div class="text-[10px] text-slate-400 pt-1">
                        Quantity: <b>${r.quantity}</b> | Deadline: <b>${new Date(r.deadline).toLocaleDateString()}</b>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    ${bidBtn}
                </div>
            `;
            portalAssigned.appendChild(item);
        });
    }

    // 4.2 Submitted Quotes
    const quotes = await apiRequest('/quotations/');
    const portalQuotes = document.getElementById('portal-submitted-quotes');
    portalQuotes.innerHTML = '';
    
    if (!quotes || quotes.length === 0) {
        portalQuotes.innerHTML = `<p class="text-slate-400 text-xs italic text-center py-8">No quotations submitted yet.</p>`;
    } else {
        quotes.forEach(q => {
            const item = document.createElement('div');
            item.className = 'border border-slate-150 rounded-lg p-4 bg-white flex justify-between items-center';
            item.innerHTML = `
                <div>
                    <span class="text-[9px] font-bold text-indigo-500 uppercase tracking-widest block">RFQ ID #${q.rfq_id}</span>
                    <h5 class="font-semibold text-slate-800 text-sm mt-0.5">${q.notes || 'Bidding Proposal'}</h5>
                    <div class="text-[10px] text-slate-400 mt-0.5">
                        Submitted: <b>${new Date(q.submitted_at).toLocaleDateString()}</b> | Lead time: <b>${q.delivery_days} days</b>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm font-bold text-slate-800">$${q.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                    <button onclick="openSubmitQuoteModal(${q.rfq_id}, ${q.price}, ${q.delivery_days}, '${q.notes || ''}')" class="text-brand-600 hover:text-brand-700 text-[10px] font-bold hover:underline mt-1 block">Edit Bid</button>
                </div>
            `;
            portalQuotes.appendChild(item);
        });
    }
}

// 5. Load Quotation Compare
async function loadComparisonRFQs() {
    const rfqs = await apiRequest('/rfqs/');
    const select = document.getElementById('compare-rfq-select');
    select.innerHTML = '<option value="">-- Choose RFQ to Compare Bids --</option>';
    
    if (rfqs) {
        // Only show RFQs with quotations
        rfqs.forEach(r => {
            if (['Open', 'Quotation Received', 'Approval Pending', 'Approved'].includes(r.status)) {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `RFQ #${r.id}: ${r.title} (${r.status})`;
                select.appendChild(opt);
            }
        });
    }
    
    // Hide details section initially
    document.getElementById('comparison-details-section').classList.add('hidden');
}

async function loadComparisonData() {
    const rfqId = document.getElementById('compare-rfq-select').value;
    if (!rfqId) {
        document.getElementById('comparison-details-section').classList.add('hidden');
        return;
    }
    
    const quotes = await apiRequest(`/quotations/?rfq_id=${rfqId}`);
    const rfqDetails = await apiRequest(`/rfqs/${rfqId}`);
    
    if (!quotes || quotes.length === 0) {
        document.getElementById('comparison-details-section').classList.add('hidden');
        showToast('No quotations have been submitted for this RFQ yet.', 'info');
        return;
    }
    
    document.getElementById('comparison-details-section').classList.remove('hidden');
    
    // Highlight lowest price and fastest delivery
    let lowestQuote = quotes[0];
    let fastestQuote = quotes[0];
    
    quotes.forEach(q => {
        if (q.price < lowestQuote.price) lowestQuote = q;
        if (q.delivery_days < fastestQuote.delivery_days) fastestQuote = q;
    });
    
    document.getElementById('highlight-lowest-vendor').textContent = lowestQuote.vendor.company_name;
    document.getElementById('highlight-lowest-value').textContent = `$${lowestQuote.price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    document.getElementById('highlight-fastest-vendor').textContent = fastestQuote.vendor.company_name;
    document.getElementById('highlight-fastest-value').textContent = `${fastestQuote.delivery_days} Days`;
    
    // Render side-by-side cards
    const grid = document.getElementById('comparison-cards-grid');
    grid.innerHTML = '';
    
    quotes.forEach(q => {
        const isLowest = q.id === lowestQuote.id;
        const isFastest = q.id === fastestQuote.id;
        
        let badges = '';
        if (isLowest) badges += `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full mr-1.5"><i class="fa-solid fa-dollar-sign"></i> Lowest</span>`;
        if (isFastest) badges += `<span class="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="fa-solid fa-bolt"></i> Fastest</span>`;
        
        const isSelectedWinner = rfqDetails.selected_quotation_id === q.id;
        
        let actionBtn = '';
        if (['Approved', 'Approval Pending'].includes(rfqDetails.status)) {
            if (isSelectedWinner) {
                actionBtn = `<div class="bg-indigo-50 text-indigo-700 text-center py-2 rounded-lg text-xs font-bold border border-indigo-100"><i class="fa-solid fa-circle-check"></i> Selected Winning Bid</div>`;
            } else {
                actionBtn = `<div class="text-slate-400 text-center text-xs py-2">Workflow Locked</div>`;
            }
        } else {
            actionBtn = `<button onclick="selectWinner(${rfqDetails.id}, ${q.id})" class="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2 rounded-lg text-xs transition-colors shadow">Select Winner & Approve</button>`;
        }
        
        const card = document.createElement('div');
        card.className = `border rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between ${isSelectedWinner ? 'ring-2 ring-indigo-500 bg-indigo-50/20' : 'bg-white hover:border-slate-300'}`;
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                        <h5 class="font-bold text-slate-800 text-base">${q.vendor.company_name}</h5>
                        <div class="flex items-center text-amber-500 text-xs mt-0.5">
                            ${getStarsHTML(q.vendor.rating)}
                            <span class="ml-1 text-slate-500 font-medium">${q.vendor.rating.toFixed(1)}</span>
                        </div>
                    </div>
                    <span class="badge-status badge-status-po-accepted">${q.vendor.status}</span>
                </div>
                
                <div class="mt-4 space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 text-xs">Bidded Total Amount</span>
                        <span class="text-lg font-bold text-slate-800">$${q.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 text-xs">Delivery Days</span>
                        <span class="text-sm font-semibold text-slate-700">${q.delivery_days} Days</span>
                    </div>
                    <div>
                        <span class="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Proposal Remarks</span>
                        <p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-150 leading-relaxed italic">"${q.notes || 'No comments provided'}"</p>
                    </div>
                    <div class="pt-2 flex flex-wrap">
                        ${badges}
                    </div>
                </div>
            </div>
            
            <div class="mt-6 pt-4 border-t border-slate-100">
                ${actionBtn}
            </div>
        `;
        grid.appendChild(card);
    });
}

async function selectWinner(rfqId, quoteId) {
    if (!confirm("Are you sure you want to select this quotation as the winner and submit for Manager Approval?")) return;
    
    const result = await apiRequest('/quotations/select-winner', {
        method: 'POST',
        body: { rfq_id: rfqId, quote_id: quoteId }
    });
    
    if (result) {
        showToast(result.message, 'success');
        loadComparisonRFQs();
    }
}

// 6. Load Manager Pending Approvals
async function loadApprovals() {
    const rfqs = await apiRequest('/rfqs/');
    const tbody = document.querySelector('#approvals-table tbody');
    tbody.innerHTML = '';
    
    if (!rfqs) return;
    
    const pendingRFQs = rfqs.filter(r => r.status === 'Approval Pending');
    
    if (pendingRFQs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">No order workflows pending your approval.</td></tr>`;
        return;
    }
    
    const role = state.user.role;
    
    for (const r of pendingRFQs) {
        // Get selected quotation
        const quote = await apiRequest(`/quotations/${r.selected_quotation_id}`);
        if (!quote) continue;
        
        let actionHTML = '';
        if (['Admin', 'Manager'].includes(role)) {
            actionHTML = `
                <div class="flex justify-end space-x-2">
                    <button onclick="approveRFQ(${r.id})" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded font-semibold text-xs transition-colors"><i class="fa-solid fa-check"></i> Approve</button>
                    <button onclick="rejectRFQ(${r.id})" class="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded font-semibold text-xs transition-colors"><i class="fa-solid fa-xmark"></i> Reject</button>
                </div>
            `;
        } else {
            actionHTML = `<span class="text-slate-400 text-xs italic">Awaiting Manager Sign</span>`;
        }
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/50 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-mono text-xs text-indigo-600 font-bold">RFQ #${r.id}</td>
            <td class="py-4 px-6 font-semibold text-slate-800">${r.title}</td>
            <td class="py-4 px-6 font-medium text-slate-700">${quote.vendor.company_name}</td>
            <td class="py-4 px-6 font-bold text-slate-900">$${quote.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-6 text-slate-600">${quote.delivery_days} Days</td>
            <td class="py-4 px-6 text-right">${actionHTML}</td>
        `;
        tbody.appendChild(tr);
    }
}

function approveRFQ(rfqId) {
    document.getElementById('app-rfq-id').value = rfqId;
    document.getElementById('app-decision-status').value = 'Approved';
    document.getElementById('approval-modal-title').textContent = `Approve RFQ #${rfqId}`;
    
    const btn = document.getElementById('btn-approval-submit');
    btn.className = "bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors";
    btn.textContent = "Submit Approval";
    
    document.getElementById('approval-modal').classList.remove('hidden');
}

function rejectRFQ(rfqId) {
    document.getElementById('app-rfq-id').value = rfqId;
    document.getElementById('app-decision-status').value = 'Rejected';
    document.getElementById('approval-modal-title').textContent = `Reject RFQ #${rfqId}`;
    
    const btn = document.getElementById('btn-approval-submit');
    btn.className = "bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors";
    btn.textContent = "Submit Rejection";
    
    document.getElementById('approval-modal').classList.remove('hidden');
}

async function handleApprovalSubmit(e) {
    e.preventDefault();
    const rfqId = document.getElementById('app-rfq-id').value;
    const status = document.getElementById('app-decision-status').value;
    const remarks = document.getElementById('app-remarks').value;
    
    const result = await apiRequest(`/approvals/${rfqId}`, {
        method: 'POST',
        body: { status, remarks }
    });
    
    if (result) {
        showToast(`Decision registered! Status: ${status}`, 'success');
        closeApprovalModal();
        loadApprovals();
        pollEmails(); // Refresh emails since notifications were sent
    }
}

// 7. Load Purchase Orders
async function loadPurchaseOrders() {
    const pos = await apiRequest('/purchase-orders/');
    const tbody = document.querySelector('#pos-table tbody');
    tbody.innerHTML = '';
    
    if (!pos) return;
    
    if (pos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No Purchase Orders generated yet.</td></tr>`;
        return;
    }
    
    const role = state.user.role;
    
    pos.forEach(po => {
        let actionHTML = '';
        if (role === 'Vendor' && po.status === 'Generated') {
             actionHTML = `<button onclick="acceptPO(${po.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded font-semibold text-xs transition-colors"><i class="fa-solid fa-thumbs-up"></i> Accept PO</button>`;
        } else if (role === 'Procurement Officer' && po.status === 'Generated') {
             actionHTML = `<button onclick="sendPO(${po.id})" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-semibold text-xs transition-colors"><i class="fa-solid fa-paper-plane text-indigo-500 mr-1"></i> Send PO</button>`;
        } else if (po.status === 'Accepted') {
             actionHTML = `<span class="text-emerald-600 text-xs font-bold"><i class="fa-solid fa-circle-check"></i> Accepted by Partner</span>`;
        } else {
             actionHTML = `<span class="text-slate-400 text-xs">Waiting Action</span>`;
        }
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/50 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-slate-800 font-mono">${po.po_number}</td>
            <td class="py-4 px-6 font-semibold text-slate-800">${po.vendor.company_name}</td>
            <td class="py-4 px-6 font-mono text-xs text-indigo-500">RFQ #${po.rfq_id}</td>
            <td class="py-4 px-6 font-bold text-slate-900">$${po.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-6 text-slate-600">${new Date(po.created_at).toLocaleDateString()}</td>
            <td class="py-4 px-6">
                <span class="badge-status badge-status-po-${po.status.toLowerCase()}">${po.status}</span>
            </td>
            <td class="py-4 px-6 text-right">${actionHTML}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function acceptPO(poId) {
    if (!confirm("Confirm acceptance of this Purchase Order?")) return;
    
    const result = await apiRequest(`/purchase-orders/${poId}/status`, {
        method: 'PUT',
        body: { status: 'Accepted' }
    });
    
    if (result) {
        showToast('Purchase Order accepted successfully!', 'success');
        loadPurchaseOrders();
    }
}

async function sendPO(poId) {
    const result = await apiRequest(`/purchase-orders/${poId}/status`, {
         method: 'PUT',
         body: { status: 'Sent' }
    });
    
    if (result) {
         showToast('PO status updated to Sent.', 'success');
         loadPurchaseOrders();
    }
}

// 8. Load Invoices
async function loadInvoices() {
    const invoices = await apiRequest('/invoices/');
    const tbody = document.querySelector('#invoices-table tbody');
    tbody.innerHTML = '';
    
    if (!invoices) return;
    
    if (invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">No invoices have been generated.</td></tr>`;
        return;
    }
    
    invoices.forEach(inv => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/50 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-slate-800 font-mono">${inv.invoice_number}</td>
            <td class="py-4 px-6 font-mono text-xs">${inv.po.po_number}</td>
            <td class="py-4 px-6 font-semibold text-slate-800">${inv.po.vendor.company_name}</td>
            <td class="py-4 px-6 font-medium">$${inv.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-6 text-slate-500">$${inv.tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-6 font-bold text-slate-900">$${inv.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-6 text-slate-500">${new Date(inv.generated_at).toLocaleDateString()}</td>
            <td class="py-4 px-6 text-right">
                <button onclick="downloadPDF(${inv.id})" class="text-brand-600 hover:text-brand-800 font-bold flex items-center justify-end w-full">
                     <i class="fa-solid fa-file-pdf text-red-500 mr-1 text-sm"></i> PDF
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function triggerInvoiceModal() {
    const pos = await apiRequest('/purchase-orders/');
    const select = document.getElementById('inv-po-select');
    select.innerHTML = '';
    
    if (!pos || pos.length === 0) {
        showToast('No Purchase Orders are available for billing.', 'info');
        return;
    }
    
    // Only accepted POs are invoicable
    const acceptedPOs = pos.filter(po => po.status === 'Accepted');
    
    if (acceptedPOs.length === 0) {
        showToast('Invoices can only be generated for POs that have been "Accepted" by the vendor.', 'warning');
        return;
    }
    
    acceptedPOs.forEach(po => {
        const opt = document.createElement('option');
        opt.value = po.id;
        opt.textContent = `${po.po_number} - ${po.vendor.company_name} ($${po.amount.toLocaleString()})`;
        select.appendChild(opt);
    });
    
    document.getElementById('invoice-modal').classList.remove('hidden');
}

async function handleInvoiceSubmit(e) {
    e.preventDefault();
    const poId = document.getElementById('inv-po-select').value;
    const taxRate = parseFloat(document.getElementById('inv-tax-rate').value);
    
    const result = await apiRequest('/invoices/', {
        method: 'POST',
        body: { po_id: parseInt(poId), tax_rate: taxRate }
    });
    
    if (result) {
        showToast(`Invoice ${result.invoice_number} generated successfully!`, 'success');
        closeInvoiceModal();
        loadInvoices();
        pollEmails(); // Refresh sent emails log
    }
}

async function downloadPDF(invoiceId) {
    const url = `/api/invoices/${invoiceId}/download`;
    showToast("Compiling PDF Invoice...", "info");
    
    try {
        const response = await apiRequest(`/invoices/${invoiceId}/download`);
        if (!response) return;
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `invoice_${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        showToast("PDF Invoice downloaded successfully!", "success");
    } catch(err) {
        console.error(err);
        showToast("Failed to download PDF invoice", "error");
    }
}

// 9. Load Analytics / Reports Page
async function loadAnalytics() {
    const reports = await apiRequest('/reports/');
    if (!reports) return;
    
    const { monthly_spend, category_spend, vendor_performance } = reports;
    
    // 9.1 Monthly Trend Full Chart
    const monthlyLabels = monthly_spend.map(x => x.month);
    const monthlyData = monthly_spend.map(x => x.spend);
    
    if (state.charts.spendTrendFull) state.charts.spendTrendFull.destroy();
    
    const ctxTrend = document.getElementById('chart-spend-monthly-full').getContext('2d');
    state.charts.spendTrendFull = new Chart(ctxTrend, {
        type: 'bar',
        data: {
            labels: monthlyLabels,
            datasets: [{
                label: 'Monthly Spending ($)',
                data: monthlyData,
                backgroundColor: '#4f46e5',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: '#f1f5f9' } },
                x: { grid: { display: false } }
            }
        }
    });
    
    // 9.2 Category Spend Full Chart
    const categoryLabels = category_spend.map(x => x.category);
    const categoryData = category_spend.map(x => x.spend);
    
    if (state.charts.spendCategoryFull) state.charts.spendCategoryFull.destroy();
    
    const ctxCat = document.getElementById('chart-spend-category-full').getContext('2d');
    state.charts.spendCategoryFull = new Chart(ctxCat, {
        type: 'pie',
        data: {
            labels: categoryLabels,
            datasets: [{
                data: categoryData,
                backgroundColor: ['#4f46e5', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#64748b']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // 9.3 Vendor Performance Table
    const tbody = document.querySelector('#vendor-performance-table tbody');
    tbody.innerHTML = '';
    
    vendor_performance.forEach(v => {
        const ratingStars = getStarsHTML(v.rating);
        const score = v.rating * 20; // Scale 5.0 rating to 100 reliability score
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/50 transition-colors';
        tr.innerHTML = `
            <td class="py-3 px-6 font-semibold text-slate-800">${v.company_name}</td>
            <td class="py-3 px-6 text-amber-500">${ratingStars} <span class="text-xs text-slate-500 font-medium ml-1">${v.rating.toFixed(1)}</span></td>
            <td class="py-3 px-6 font-medium text-slate-800">${v.quote_count} Quotations</td>
            <td class="py-3 px-6">
                <div class="flex items-center">
                    <span class="w-8 text-xs font-semibold text-indigo-700">${score.toFixed(0)}%</span>
                    <div class="w-24 bg-slate-100 h-2 rounded overflow-hidden ml-2 border border-slate-200">
                        <div class="bg-indigo-500 h-full rounded" style="width: ${score}%"></div>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function exportToCSV() {
    // Basic CSV exporter for demo
    const rows = [
        ["Vendor Name", "Rating", "Total Quotes"]
    ];
    
    const table = document.getElementById('vendor-performance-table');
    const trs = table.querySelectorAll('tbody tr');
    
    trs.forEach(tr => {
        const cols = tr.querySelectorAll('td');
        if (cols.length >= 3) {
            const name = cols[0].innerText;
            const rating = cols[1].innerText.trim().split(" ")[1] || "5.0";
            const quotes = cols[2].innerText.trim();
            rows.push([name, rating, quotes]);
        }
    });
    
    let csvContent = "data:text/csv;charset=utf-8," 
        + rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
        
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "vendor_performance_report.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast("CSV report exported successfully!", "success");
}

// 10. Load Audit Trail Logs
async function loadAuditLogs() {
    const logs = await apiRequest('/reports/activity-logs');
    const tbody = document.querySelector('#logs-table tbody');
    tbody.innerHTML = '';
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-6 text-center text-slate-400">No activity logs found.</td></tr>`;
        return;
    }
    
    logs.forEach(log => {
        const op = log.user ? log.user.name : '<span class="text-indigo-500 font-bold"><i class="fa-solid fa-gears"></i> SYSTEM</span>';
        const dateStr = new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19);
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50/30 transition-colors text-xs border-b border-slate-100';
        tr.innerHTML = `
            <td class="py-3 px-6 text-slate-400 font-mono">${dateStr}</td>
            <td class="py-3 px-6 font-semibold text-slate-700">${op}</td>
            <td class="py-3 px-6 text-slate-600 leading-relaxed">${log.action}</td>
        `;
        tbody.appendChild(tr);
    });
}


// ================= ACTION HANDLERS =================

// Creating Vendor Profile
async function handleVendorSubmit(e) {
    e.preventDefault();
    const company_name = document.getElementById('v-name').value;
    const gst_number = document.getElementById('v-gst').value;
    const category = document.getElementById('v-category').value;
    const email = document.getElementById('v-email').value;
    const phone = document.getElementById('v-phone').value;
    const address = document.getElementById('v-address').value;
    
    const result = await apiRequest('/vendors/', {
        method: 'POST',
        body: { company_name, gst_number, category, email, phone, address }
    });
    
    if (result) {
        showToast('Vendor profile added successfully!', 'success');
        closeVendorModal();
        loadVendors();
    }
}

// Creating RFQ
async function handleRFQSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('rfq-title').value;
    const quantity = parseInt(document.getElementById('rfq-quantity').value);
    const deadlineVal = document.getElementById('rfq-deadline').value;
    const description = document.getElementById('rfq-desc').value;
    const attachment_name = document.getElementById('rfq-attachment').value || null;
    const status = document.getElementById('rfq-status-select').value;
    
    // Convert deadline to ISO String
    const deadline = new Date(deadlineVal).toISOString();
    
    // Collect assigned vendor checked boxes
    const assigned_vendor_ids = [];
    document.querySelectorAll('.rfq-vendor-chk:checked').forEach(chk => {
        assigned_vendor_ids.push(parseInt(chk.value));
    });
    
    const result = await apiRequest('/rfqs/', {
        method: 'POST',
        body: { title, description, quantity, deadline, assigned_vendor_ids, attachment_name, attachment_url: attachment_name ? `https://mock-s3.amazonaws.com/${attachment_name}` : null }
    });
    
    if (result) {
        // If status was Open directly publish (default created is Draft)
        if (status === 'Open') {
             await apiRequest(`/rfqs/${result.id}`, {
                  method: 'PUT',
                  body: { status: 'Open' }
             });
        }
        showToast('RFQ created successfully!', 'success');
        closeRFQModal();
        loadRFQs();
    }
}

async function publishRFQ(rfqId) {
     const result = await apiRequest(`/rfqs/${rfqId}`, {
          method: 'PUT',
          body: { status: 'Open' }
     });
     if (result) {
          showToast('RFQ published. Bidding is now open!', 'success');
          loadRFQs();
     }
}

async function deleteRFQ(rfqId) {
     if (!confirm("Are you sure you want to delete this RFQ?")) return;
     const result = await apiRequest(`/rfqs/${rfqId}`, {
          method: 'DELETE'
     });
     if (result) {
          showToast(result.message, 'success');
          loadRFQs();
     }
}

// Submitting Quotation Bid
async function handleQuoteSubmit(e) {
    e.preventDefault();
    const rfq_id = parseInt(document.getElementById('q-rfq-id').value);
    const price = parseFloat(document.getElementById('q-price').value);
    const delivery_days = parseInt(document.getElementById('q-days').value);
    const notes = document.getElementById('q-notes').value;
    
    const result = await apiRequest('/quotations/', {
        method: 'POST',
        body: { rfq_id, price, delivery_days, notes }
    });
    
    if (result) {
        showToast('Quotation submitted successfully!', 'success');
        closeQuoteModal();
        loadVendorPortal();
    }
}


// ================= MODAL TOGGLES =================
function openCreateVendorModal() {
    document.getElementById('vendor-form').reset();
    document.getElementById('vendor-modal-title').textContent = 'Add Vendor Partner';
    document.getElementById('v-rating-container').classList.add('hidden');
    document.getElementById('vendor-modal').classList.remove('hidden');
}

function closeVendorModal() {
    document.getElementById('vendor-modal').classList.add('hidden');
}

async function openCreateRFQModal() {
    document.getElementById('rfq-form').reset();
    document.getElementById('rfq-modal-title').textContent = 'Create Procurement RFQ';
    
    // Setup tomorrow as default deadline date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    document.getElementById('rfq-deadline').value = tomorrow.toISOString().substring(0, 16);
    
    // Load vendors checklist
    const checklist = document.getElementById('rfq-vendors-checklist');
    checklist.innerHTML = '';
    
    const vendors = state.cachedVendors.length > 0 ? state.cachedVendors : await apiRequest('/vendors/');
    if (vendors && vendors.length > 0) {
        vendors.forEach(v => {
            const div = document.createElement('div');
            div.className = 'flex items-center';
            div.innerHTML = `
                <input type="checkbox" id="chk-vendor-${v.id}" value="${v.id}" class="rfq-vendor-chk h-4 w-4 text-brand-600 border-slate-350 rounded focus:ring-brand-500">
                <label for="chk-vendor-${v.id}" class="ml-2 text-xs text-slate-700 font-semibold">${v.company_name} (${v.category})</label>
            `;
            checklist.appendChild(div);
        });
    } else {
        checklist.innerHTML = `<p class="text-xs text-rose-500 italic">No vendors registered. Create a vendor profile first.</p>`;
    }
    
    document.getElementById('rfq-modal').classList.remove('hidden');
}

function closeRFQModal() {
    document.getElementById('rfq-modal').classList.add('hidden');
}

function openSubmitQuoteModal(rfqId, price = '', days = '', notes = '') {
    document.getElementById('quote-form').reset();
    document.getElementById('q-rfq-id').value = rfqId;
    document.getElementById('q-price').value = price;
    document.getElementById('q-days').value = days;
    document.getElementById('q-notes').value = notes;
    document.getElementById('quote-modal').classList.remove('hidden');
}

function closeQuoteModal() {
    document.getElementById('quote-modal').classList.add('hidden');
}

function closeApprovalModal() {
    document.getElementById('approval-modal').classList.add('hidden');
    document.getElementById('approval-form').reset();
}

function closeInvoiceModal() {
    document.getElementById('invoice-modal').classList.add('hidden');
}


// ================= MOCK SYSTEM OUTBOX EMAILS CLIENT =================
async function pollEmails() {
     if (!['Admin', 'Procurement Officer'].includes(state.user.role)) return;
     
     const emails = await apiRequest('/reports/mock-emails');
     if (emails) {
          state.emails = emails;
          const badge = document.getElementById('emails-count-badge');
          badge.textContent = emails.length;
          if (emails.length > 0) {
               badge.classList.remove('hidden');
          } else {
               badge.classList.add('hidden');
          }
          
          // Re-render modal sidebar if open
          if (!document.getElementById('emails-modal').classList.contains('hidden')) {
               renderEmailsSidebar();
          }
     }
}

function openEmailsModal() {
    renderEmailsSidebar();
    
    // Clear detail reading pane
    document.getElementById('email-placeholder').classList.remove('hidden');
    document.getElementById('email-real-content').classList.add('hidden');
    
    document.getElementById('emails-modal').classList.remove('hidden');
}

function closeEmailsModal() {
    document.getElementById('emails-modal').classList.add('hidden');
}

function renderEmailsSidebar() {
    const list = document.getElementById('emails-sidebar-list');
    list.innerHTML = '';
    
    if (state.emails.length === 0) {
        list.innerHTML = `<p class="p-6 text-xs text-slate-400 italic text-center">Outbox is empty. No notifications sent.</p>`;
        return;
    }
    
    state.emails.slice().reverse().forEach(mail => {
        const item = document.createElement('button');
        item.className = 'w-full text-left p-4 hover:bg-slate-50 focus:outline-none transition-colors border-b border-slate-100 flex flex-col space-y-1';
        item.onclick = () => readEmail(mail);
        item.innerHTML = `
            <div class="flex justify-between items-center text-[10px]">
                <span class="font-bold text-slate-800 truncate w-32">${mail.to_email}</span>
                <span class="text-slate-400">${new Date(mail.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <h5 class="text-xs font-bold text-slate-900 truncate">${mail.subject}</h5>
            <p class="text-[10px] text-slate-500 line-clamp-1">${mail.body}</p>
        `;
        list.appendChild(item);
    });
}

function readEmail(mail) {
    document.getElementById('email-placeholder').classList.add('hidden');
    document.getElementById('email-real-content').classList.remove('hidden');
    
    document.getElementById('mail-to').textContent = mail.to_email;
    document.getElementById('mail-subject').textContent = mail.subject;
    document.getElementById('mail-body').textContent = mail.body;
    
    const d = new Date(mail.timestamp);
    document.getElementById('mail-time').textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function startNotificationPoller() {
     // Check audit emails log every 6 seconds to capture notifications
     pollEmails();
     setInterval(pollEmails, 6000);
}


// ================= HELPERS & UTILITIES =================

// Generating Star Rating HTML
function getStarsHTML(rating) {
    let stars = '';
    const rounded = Math.round(rating);
    for (let i = 1; i <= 5; i++) {
        if (i <= rounded) {
            stars += '<i class="fa-solid fa-star"></i>';
        } else {
            stars += '<i class="fa-regular fa-star text-slate-300"></i>';
        }
    }
    return stars;
}

// Edit Rating Popup
async function editRating(vendorId, currentRating) {
    const newRating = prompt(`Enter new quality score for this vendor (0.0 - 5.0):`, currentRating);
    if (newRating === null) return;
    
    const parsed = parseFloat(newRating);
    if (isNaN(parsed) || parsed < 0 || parsed > 5) {
        showToast('Invalid rating score. Value must be between 0.0 and 5.0.', 'warning');
        return;
    }
    
    const result = await apiRequest(`/vendors/${vendorId}/rate`, {
        method: 'POST',
        body: { rating: parsed }
    });
    
    if (result) {
        showToast(result.message, 'success');
        loadVendors();
    }
}

// Edit Vendor details
async function editVendor(vendorId) {
    const v = state.cachedVendors.find(x => x.id === vendorId);
    if (!v) return;
    
    document.getElementById('vendor-form').reset();
    document.getElementById('vendor-modal-title').textContent = 'Modify Vendor Details';
    document.getElementById('v-rating-container').classList.add('hidden'); // Kept hidden, rate separately
    
    // Fill fields
    document.getElementById('v-name').value = v.company_name;
    document.getElementById('v-gst').value = v.gst_number;
    document.getElementById('v-category').value = v.category;
    document.getElementById('v-email').value = v.email;
    document.getElementById('v-phone').value = v.phone;
    document.getElementById('v-address').value = v.address;
    
    // Redefine form action to PUT instead of POST
    const form = document.getElementById('vendor-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const body = {
            company_name: document.getElementById('v-name').value,
            gst_number: document.getElementById('v-gst').value,
            category: document.getElementById('v-category').value,
            email: document.getElementById('v-email').value,
            phone: document.getElementById('v-phone').value,
            address: document.getElementById('v-address').value
        };
        const result = await apiRequest(`/vendors/${v.id}`, {
            method: 'PUT',
            body: body
        });
        if (result) {
            showToast('Vendor profile updated successfully!', 'success');
            closeVendorModal();
            loadVendors();
            form.onsubmit = handleVendorSubmit; // Restore handler
        }
    };
    
    document.getElementById('vendor-modal').classList.remove('hidden');
}

async function deleteVendor(vendorId) {
    if (!confirm("Are you sure you want to delete this vendor partner permanently? This cannot be undone.")) return;
    const result = await apiRequest(`/vendors/${vendorId}`, {
        method: 'DELETE'
    });
    if (result) {
        showToast(result.message, 'success');
        loadVendors();
    }
}

// System notifications indicator
let lastLogsCount = 0;
function toggleNotifications() {
     const panel = document.getElementById('notifications-panel');
     panel.classList.toggle('hidden');
     
     if (!panel.classList.contains('hidden')) {
          renderNotifications();
     }
}

async function renderNotifications() {
     const list = document.getElementById('notifications-list');
     list.innerHTML = '';
     
     const logs = await apiRequest('/reports/activity-logs');
     if (!logs || logs.length === 0) {
          list.innerHTML = `<p class="p-4 text-center text-xs text-slate-400 italic">No recent activities.</p>`;
          return;
     }
     
     logs.slice(0, 5).forEach(log => {
          const item = document.createElement('div');
          item.className = 'p-3 hover:bg-slate-50 transition-colors text-xs flex flex-col space-y-1';
          item.innerHTML = `
               <span class="text-slate-600 leading-normal font-semibold">${log.action}</span>
               <span class="text-[9px] text-slate-400">${new Date(log.timestamp).toLocaleTimeString()}</span>
          `;
          list.appendChild(item);
     });
}

// Toast Notices
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-item flex items-center p-4 w-72 rounded-xl border shadow-lg transition-all text-xs font-semibold `;
    
    let icon = '';
    if (type === 'success') {
        toast.className += 'bg-emerald-50 text-emerald-800 border-emerald-200';
        icon = '<i class="fa-solid fa-circle-check text-emerald-500 mr-2 text-base"></i>';
    } else if (type === 'error') {
        toast.className += 'bg-red-50 text-red-800 border-red-200';
        icon = '<i class="fa-solid fa-circle-xmark text-red-500 mr-2 text-base"></i>';
    } else if (type === 'warning') {
        toast.className += 'bg-amber-50 text-amber-800 border-amber-200';
        icon = '<i class="fa-solid fa-triangle-exclamation text-amber-500 mr-2 text-base"></i>';
    } else {
        toast.className += 'bg-blue-50 text-blue-800 border-blue-200';
        icon = '<i class="fa-solid fa-circle-info text-blue-500 mr-2 text-base"></i>';
    }
    
    toast.innerHTML = `
        <div class="flex items-start">
            ${icon}
            <div class="flex-1">${message}</div>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove toast
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4500);
}
