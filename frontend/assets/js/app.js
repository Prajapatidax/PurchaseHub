// PurchaseHub ERP - Main Application Controller

const settingsState = {
    companyName: localStorage.getItem('settings_company_name') || 'My Company (New Delhi)',
    companyGst: localStorage.getItem('settings_company_gst') || '07AAAAA1111A1Z1',
    autoPublish: localStorage.getItem('settings_auto_publish') !== 'false',
    requireApproval: localStorage.getItem('settings_require_approval') !== 'false',
    autoPO: localStorage.getItem('settings_auto_po') !== 'false',
    approvalLimit: parseFloat(localStorage.getItem('settings_approval_limit')) || 10000.0
};

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

// ================= API FETCH CLIENT =================
async function apiRequest(endpoint, options = {}) {
    const url = `/api${endpoint}`;
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
        if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/signup') {
            showToast('Session expired. Please log in.', 'error');
            handleLogout();
            return null;
        }
        if (endpoint.endsWith('/download') || endpoint.includes('/export/')) {
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

// ================= INITIALIZATION & ROUTING LIFECYCLE =================
document.addEventListener('DOMContentLoaded', async () => {
    // Check if on public path
    const path = window.location.pathname;
    const isPublic = ['/login', '/signup', '/forgot-password'].includes(path);
    
    // Wire up form handlers on the current page if they exist
    wireUpFormHandlers();

    if (state.token) {
        const valid = await validateSession();
        if (valid) {
            setupUIForRole();
            if (isPublic || path === '/') {
                window.router.navigate('/dashboard');
            } else {
                const viewName = getViewNameFromPath(path);
                triggerViewLoader(viewName);
            }
            startNotificationPoller();
        } else {
            if (!isPublic) window.router.navigate('/login');
        }
    } else {
        if (!isPublic) window.router.navigate('/login');
    }
});

function wireUpFormHandlers() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

    const signupForm = document.getElementById('signup-form');
    if (signupForm) signupForm.addEventListener('submit', handleSignupSubmit);

    const forgotForm = document.getElementById('forgot-form');
    if (forgotForm) forgotForm.addEventListener('submit', handleForgotSubmit);
    
    // Modals are loaded globally in authenticated views
    const vendorForm = document.getElementById('vendor-form');
    if (vendorForm) vendorForm.addEventListener('submit', handleVendorSubmit);

    const rfqForm = document.getElementById('rfq-form');
    if (rfqForm) rfqForm.addEventListener('submit', handleRFQSubmit);

    const quoteForm = document.getElementById('quote-form');
    if (quoteForm) quoteForm.addEventListener('submit', handleQuoteSubmit);

    const officerQuoteForm = document.getElementById('officer-quote-form');
    if (officerQuoteForm) officerQuoteForm.addEventListener('submit', saveOfficerQuotation);

    const approvalForm = document.getElementById('approval-form');
    if (approvalForm) approvalForm.addEventListener('submit', handleApprovalSubmit);

    const invoiceForm = document.getElementById('invoice-form');
    if (invoiceForm) invoiceForm.addEventListener('submit', handleInvoiceSubmit);
}

async function validateSession() {
    const user = await apiRequest('/auth/me');
    if (user) {
        state.user = user;
        
        // Store in localStorage for components to read instantly
        localStorage.setItem('role', user.role);
        localStorage.setItem('user_name', user.name);
        
        const nameEl = document.getElementById('profile-name');
        if (nameEl) nameEl.textContent = user.name;
        
        const roleEl = document.getElementById('profile-role');
        if (roleEl) roleEl.textContent = user.role;
        
        const switcher = document.querySelector('#navbar-company-name');
        if (switcher) switcher.textContent = settingsState.companyName;
        
        return true;
    }
    return false;
}

function handleLogout() {
    state.token = null;
    state.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('user_name');
    sessionStorage.removeItem('token');
    
    // Redirect to login page
    window.location.href = '/login';
}

function getViewNameFromPath(path) {
    if (path.startsWith('/vendors')) return 'vendors';
    if (path.startsWith('/rfqs')) return 'rfqs';
    if (path.startsWith('/quotations')) return 'quotations';
    if (path.startsWith('/comparison')) return 'comparison';
    if (path.startsWith('/approvals')) return 'approvals';
    if (path.startsWith('/purchase-orders')) return 'purchase-orders';
    if (path.startsWith('/invoices')) return 'invoices';
    if (path.startsWith('/reports')) return 'reports';
    if (path.startsWith('/activity-logs')) return 'activity-logs';
    if (path.startsWith('/settings')) return 'settings';
    if (path.startsWith('/profile')) return 'profile';
    return 'dashboard';
}

function checkRoleGuards(viewName) {
    if (!state.user) return true;
    const role = state.user.role;
    if (role === 'Vendor') {
        const forbidden = ['comparison', 'approvals', 'reports', 'settings', 'activity-logs'];
        if (forbidden.includes(viewName)) {
            window.router.navigate('/dashboard');
            return false;
        }
    }
    if (role === 'Manager') {
        const forbidden = ['comparison', 'settings', 'activity-logs'];
        if (forbidden.includes(viewName)) {
            window.router.navigate('/dashboard');
            return false;
        }
    }
    return true;
}

async function triggerViewLoader(viewName) {
    if (!checkRoleGuards(viewName)) return;

    // Clean active states and modals
    closeVendorModal();
    closeRFQModal();
    closeQuoteModal();
    closeApprovalModal();
    closeInvoiceModal();
    closeEmailsModal();

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
        case 'quotations':
            if (state.user && state.user.role === 'Vendor') {
                await loadVendorPortal();
            } else {
                await loadAllQuotations();
            }
            const pathname = window.location.pathname;
            if (pathname === '/quotations/new') {
                openOfficerQuoteModal();
            } else if (pathname.startsWith('/quotations/view/')) {
                const parts = pathname.split('/');
                const id = parseInt(parts[parts.length - 1]);
                if (id) viewQuotation(id);
            }
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
        case 'reports':
            loadAnalytics();
            break;
        case 'activity-logs':
            loadAuditLogs();
            break;
        case 'settings':
            loadSettings();
            break;
        case 'profile':
            loadProfile();
            break;
    }
}

// Set up UI permissions on direct loads/navs
function setupUIForRole() {
    if (!state.user) return;
    const role = state.user.role;
    const quickActions = document.getElementById('procurement-actions');
    if (quickActions) {
        if (role === 'Vendor' || role === 'Manager') {
            quickActions.classList.add('hidden');
        } else {
            quickActions.classList.remove('hidden');
        }
    }
}

// ================= AUTH HANDLERS =================
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
        
        localStorage.setItem('role', result.role);
        localStorage.setItem('user_name', result.user_name);
        
        showToast(`Welcome back, ${result.user_name}!`, 'success');
        
        // Full reload redirect to initialize layout elements correctly
        window.location.href = '/dashboard';
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
        window.router.navigate('/login');
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
        window.router.navigate('/login');
    }
}

function toggleCompanyField() {
    const roleSelect = document.getElementById('signup-role');
    const companyContainer = document.getElementById('signup-company-container');
    const companyInput = document.getElementById('signup-company');
    
    if (roleSelect && roleSelect.value === 'Vendor') {
        companyContainer.classList.remove('hidden');
        companyInput.setAttribute('required', 'true');
    } else if (companyContainer) {
        companyContainer.classList.add('hidden');
        companyInput.removeAttribute('required');
    }
}

function autofillLogin(email, password) {
    const emailField = document.getElementById('login-email');
    const pwdField = document.getElementById('login-password');
    if (emailField && pwdField) {
        emailField.value = email;
        pwdField.value = password;
        showToast('Credentials autofilled! Click Sign In.', 'info');
    }
}

// ================= DATA LOADERS =================

// 1. Dashboard Loader
async function loadDashboard() {
    const reports = await apiRequest('/reports/');
    if (!reports) return;
    
    const { kpis, monthly_spend, category_spend } = reports;
    
    // Set KPI Attributes on Custom Elements
    const kpiSpend = document.getElementById('kpi-spend');
    if (kpiSpend) kpiSpend.setAttribute('value', `Rs. ${kpis.total_spend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);

    const kpiVendors = document.getElementById('kpi-vendors');
    if (kpiVendors) kpiVendors.setAttribute('value', kpis.total_vendors.toString());

    const kpiRfqs = document.getElementById('kpi-rfqs');
    if (kpiRfqs) kpiRfqs.setAttribute('value', kpis.active_rfqs.toString());

    const kpiApprovals = document.getElementById('kpi-approvals');
    if (kpiApprovals) {
        kpiApprovals.setAttribute('value', kpis.pending_approvals.toString());
        if (kpis.pending_approvals > 0) {
            kpiApprovals.setAttribute('trend', 'Alert');
        } else {
            kpiApprovals.removeAttribute('trend');
        }
    }

    const kpiPos = document.getElementById('kpi-pos');
    if (kpiPos) kpiPos.setAttribute('value', kpis.purchase_orders.toString());

    const kpiInvoices = document.getElementById('kpi-invoices');
    if (kpiInvoices) kpiInvoices.setAttribute('value', kpis.invoices_generated.toString());
    
    // Render Spend Trend Chart using Recharts window wrapper
    if (window.renderSpendTrendChart) {
        window.renderSpendTrendChart('recharts-spend-trend', monthly_spend);
    }
    
    // Render Spend Category Chart
    if (window.renderSpendCategoryChart) {
        window.renderSpendCategoryChart('recharts-spend-category', category_spend);
    }
}

// 2. Vendors List & Modals Controller
async function loadVendors() {
    const vendors = await apiRequest('/vendors/');
    if (!vendors) return;
    state.cachedVendors = vendors;
    
    renderVendorsTable(vendors);
    
    // Handle dynamic clean paths URL parameter router checks
    const path = window.location.pathname;
    if (path === '/vendors/new') {
        openCreateVendorModal(false);
    } else if (path.startsWith('/vendors/edit/')) {
        const id = parseInt(path.split('/').pop());
        if (!isNaN(id)) editVendor(id, false);
    } else if (path.startsWith('/vendors/view/')) {
        const id = parseInt(path.split('/').pop());
        if (!isNaN(id)) viewVendorDetails(id, false);
    }
}

function renderVendorsTable(vendors) {
    const tbody = document.querySelector('#vendors-table tbody');
    if (!tbody) return;
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
            
        const canEdit = ['Admin', 'Procurement Officer'].includes(role) || (role === 'Vendor' && v.email === userEmail);
        
        const actionsHTML = canEdit 
            ? `<div class="flex justify-end space-x-2">
                 <button onclick="editVendor(${v.id})" class="text-indigo-600 hover:text-indigo-900 font-semibold text-xs"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                 ${['Admin', 'Procurement Officer'].includes(role) ? `<button onclick="deleteVendor(${v.id})" class="text-rose-600 hover:text-rose-900 font-semibold text-xs"><i class="fa-solid fa-trash"></i> Delete</button>` : ''}
               </div>`
            : `<button onclick="viewVendorDetails(${v.id})" class="text-slate-500 hover:text-slate-800 font-semibold text-xs"><i class="fa-solid fa-eye"></i> View</button>`;
            
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-55 transition-colors';
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
                <erp-status-badge status="${v.status}"></erp-status-badge>
            </td>
            <td class="py-4 px-6 text-right">${actionsHTML}</td>
        `;
        tbody.appendChild(tr);
    });
}

function filterVendors() {
    const searchVal = document.getElementById('vendor-search-input')?.value.toLowerCase() || '';
    const catVal = document.getElementById('vendor-category-select')?.value || '';
    
    let filtered = state.cachedVendors;
    if (searchVal) {
        filtered = filtered.filter(v => v.company_name.toLowerCase().includes(searchVal));
    }
    if (catVal) {
        filtered = filtered.filter(v => v.category === catVal);
    }
    renderVendorsTable(filtered);
}

// 3. RFQs Controller
async function loadRFQs() {
    const filterEl = document.getElementById('rfq-status-filter');
    const statusFilter = filterEl ? filterEl.value : '';
    const rfqs = await apiRequest(`/rfqs/?status_filter=${statusFilter}`);
    if (!rfqs) return;
    
    const container = document.getElementById('rfqs-grid-container');
    if (!container) return;
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
            actions = `
                <div class="flex justify-between items-center mt-5 pt-4 border-t border-slate-100">
                    <button onclick="editRFQ(${r.id})" class="text-indigo-600 hover:text-indigo-900 font-semibold text-xs"><i class="fa-solid fa-pen-to-square"></i> Modify</button>
                    ${r.status === 'Draft' ? `<button onclick="publishRFQ(${r.id})" class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded hover:bg-indigo-100 font-semibold text-xs">Publish</button>` : ''}
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
                    <erp-status-badge status="${r.status}"></erp-status-badge>
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

    // Handle deep link actions
    const path = window.location.pathname;
    if (path === '/rfqs/new') {
        openCreateRFQModal(false);
    } else if (path.startsWith('/rfqs/edit/')) {
        const id = parseInt(path.split('/').pop());
        if (!isNaN(id)) editRFQ(id, false);
    }
}

// 4. Vendor Portal Quotations (Vendor role only)
async function loadVendorPortal() {
    const vPortal = document.getElementById('vendor-portal-view');
    if (vPortal) vPortal.classList.remove('hidden');
    const oPortal = document.getElementById('officer-quotations-view');
    if (oPortal) oPortal.classList.add('hidden');

    const assignedRFQs = await apiRequest('/rfqs/');
    const portalAssigned = document.getElementById('portal-assigned-rfqs');
    if (portalAssigned) {
        portalAssigned.innerHTML = '';
        if (!assignedRFQs || assignedRFQs.length === 0) {
            portalAssigned.innerHTML = `<p class="text-slate-400 text-xs italic text-center py-8">No active RFQs assigned to your company currently.</p>`;
        } else {
            assignedRFQs.forEach(r => {
                const isClosed = new Date(r.deadline) < new Date();
                const bidBtn = isClosed 
                    ? `<span class="text-rose-500 text-xs font-bold"><i class="fa-solid fa-lock mr-1"></i> Closed</span>`
                    : `<button onclick="openSubmitQuoteModal(${r.id})" class="bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded text-xs font-semibold shadow transition-colors">Submit Bid</button>`;
                    
                const item = document.createElement('div');
                item.className = 'border border-slate-150 rounded-lg p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors flex justify-between items-start';
                item.innerHTML = `
                    <div class="space-y-1 w-2/3">
                        <erp-status-badge status="${r.status}"></erp-status-badge>
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
    }

    const quotes = await apiRequest('/quotations/');
    const portalQuotes = document.getElementById('portal-submitted-quotes');
    if (portalQuotes) {
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
                        <div class="text-sm font-bold text-slate-800">Rs. ${q.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        <button onclick="openSubmitQuoteModal(${q.rfq_id}, ${q.price}, ${q.delivery_days}, '${q.notes || ''}')" class="text-brand-600 hover:text-brand-700 text-[10px] font-bold hover:underline mt-1 block">Edit Bid</button>
                    </div>
                `;
                portalQuotes.appendChild(item);
            });
        }
    }
}

// 4.1 All Quotations Ledger (Admin/Procurement Officer/Manager view of /quotations)
async function loadAllQuotations() {
    const oPortal = document.getElementById('officer-quotations-view');
    if (oPortal) oPortal.classList.remove('hidden');
    const vPortal = document.getElementById('vendor-portal-view');
    if (vPortal) vPortal.classList.add('hidden');

    const quotes = await apiRequest('/quotations/');
    state.cachedQuotations = quotes || [];

    // Populate vendor filter dropdown
    const filterVendor = document.getElementById('q-filter-vendor');
    if (filterVendor) {
        filterVendor.innerHTML = '<option value="">All Vendors</option>';
        const uniqueVendors = {};
        state.cachedQuotations.forEach(q => {
            if (q.vendor) {
                uniqueVendors[q.vendor.id] = q.vendor.company_name;
            }
        });
        Object.entries(uniqueVendors).forEach(([id, name]) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = name;
            filterVendor.appendChild(opt);
        });
    }

    renderQuotationsLedger(state.cachedQuotations);
}

function renderQuotationsLedger(quotes) {
    const tbody = document.querySelector('#quotations-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!quotes || quotes.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">No quotation proposals recorded in ledger.</td></tr>`;
        return;
    }
    
    quotes.forEach(q => {
        const statusBadge = `<erp-status-badge status="${q.status || 'Pending Review'}"></erp-status-badge>`;
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
        tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-slate-800 font-mono">Q-${q.id}</td>
            <td class="py-4 px-6 font-mono text-xs text-indigo-600 font-semibold">RFQ #${q.rfq_id}</td>
            <td class="py-4 px-6 font-semibold text-slate-800">${q.vendor ? q.vendor.company_name : 'Unknown'}</td>
            <td class="py-4 px-6 font-bold text-slate-900">Rs. ${q.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-6 text-slate-600">${q.delivery_days} Days</td>
            <td class="py-4 px-6">${statusBadge}</td>
            <td class="py-4 px-6 text-slate-500 text-xs">${new Date(q.submitted_at).toLocaleDateString()}</td>
            <td class="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                 <button onclick="viewQuotation(${q.id})" class="text-slate-600 hover:text-slate-800 font-semibold text-xs"><i class="fa-solid fa-eye mr-0.5"></i> View</button>
                 <button onclick="openOfficerQuoteModal(${q.id})" class="text-indigo-600 hover:text-indigo-800 font-semibold text-xs"><i class="fa-solid fa-pen mr-0.5"></i> Edit</button>
                 <button onclick="deleteQuotation(${q.id})" class="text-rose-600 hover:text-rose-800 font-semibold text-xs"><i class="fa-solid fa-trash mr-0.5"></i> Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterQuotationsList() {
    if (!state.cachedQuotations) return;
    
    const searchVal = (document.getElementById('q-search')?.value || '').toLowerCase().trim();
    const statusVal = document.getElementById('q-filter-status')?.value || '';
    const vendorVal = document.getElementById('q-filter-vendor')?.value || '';
    
    let filtered = state.cachedQuotations;
    
    if (searchVal) {
        filtered = filtered.filter(q => {
            const qIdStr = `q-${q.id}`.toLowerCase();
            const rfqIdStr = `rfq #${q.rfq_id}`.toLowerCase();
            const vendorName = (q.vendor?.company_name || '').toLowerCase();
            const notes = (q.notes || '').toLowerCase();
            return qIdStr.includes(searchVal) || rfqIdStr.includes(searchVal) || vendorName.includes(searchVal) || notes.includes(searchVal);
        });
    }
    
    if (statusVal) {
        filtered = filtered.filter(q => q.status === statusVal);
    }
    
    if (vendorVal) {
        filtered = filtered.filter(q => q.vendor && String(q.vendor.id) === vendorVal);
    }
    
    renderQuotationsLedger(filtered);
}

async function openOfficerQuoteModal(quoteId = null) {
    const modal = document.getElementById('officer-quote-modal');
    if (!modal) return;
    
    // Fetch and populate vendors
    const vendors = await apiRequest('/vendors/');
    const vendorSelect = document.getElementById('oq-vendor-id');
    if (vendorSelect) {
        vendorSelect.innerHTML = '<option value="">Select Vendor Partner...</option>';
        if (vendors) {
            vendors.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.id;
                opt.textContent = `${v.company_name} (${v.category})`;
                vendorSelect.appendChild(opt);
            });
        }
    }
    
    // Fetch and populate RFQs
    const rfqs = await apiRequest('/rfqs/');
    const rfqSelect = document.getElementById('oq-rfq-id');
    if (rfqSelect) {
        rfqSelect.innerHTML = '<option value="">Select RFQ Reference...</option>';
        if (rfqs) {
            rfqs.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `RFQ #${r.id} - ${r.title} (Qty: ${r.quantity})`;
                rfqSelect.appendChild(opt);
            });
        }
    }

    const form = document.getElementById('officer-quote-form');
    if (form) {
        form.reset();
        form.onsubmit = saveOfficerQuotation;
    }

    const titleEl = modal.querySelector('.modal-title');

    if (quoteId) {
        if (titleEl) titleEl.textContent = 'Edit Quotation Proposal';
        const q = await apiRequest(`/quotations/${quoteId}`);
        if (q) {
            document.getElementById('oq-id').value = q.id;
            if (vendorSelect) vendorSelect.value = q.vendor_id;
            if (rfqSelect) rfqSelect.value = q.rfq_id;
            document.getElementById('oq-price').value = q.price;
            document.getElementById('oq-days').value = q.delivery_days;
            document.getElementById('oq-notes').value = q.notes || '';
            if (vendorSelect) vendorSelect.disabled = true;
            if (rfqSelect) rfqSelect.disabled = true;
        }
    } else {
        if (titleEl) titleEl.textContent = 'Create Quotation Proposal';
        document.getElementById('oq-id').value = '';
        if (vendorSelect) vendorSelect.disabled = false;
        if (rfqSelect) rfqSelect.disabled = false;
        
        if (window.location.pathname !== '/quotations/new') {
            history.pushState(null, '', '/quotations/new');
        }
    }
    
    modal.open();
}

function closeOfficerQuoteModal() {
    const modal = document.getElementById('officer-quote-modal');
    if (modal) modal.close();
    if (window.location.pathname !== '/quotations') {
        history.pushState(null, '', '/quotations');
    }
}

async function saveOfficerQuotation(e) {
    e.preventDefault();
    const quoteId = document.getElementById('oq-id').value;
    const vendorId = parseInt(document.getElementById('oq-vendor-id').value);
    const rfqId = parseInt(document.getElementById('oq-rfq-id').value);
    const price = parseFloat(document.getElementById('oq-price').value);
    const deliveryDays = parseInt(document.getElementById('oq-days').value);
    const notes = document.getElementById('oq-notes').value;

    const payload = {
        rfq_id: rfqId,
        price: price,
        delivery_days: deliveryDays,
        notes: notes
    };

    let result;
    if (quoteId) {
        result = await apiRequest(`/quotations/${quoteId}`, {
            method: 'PUT',
            body: {
                price: price,
                delivery_days: deliveryDays,
                notes: notes
            }
        });
    } else {
        payload.vendor_id = vendorId;
        result = await apiRequest('/quotations/', {
            method: 'POST',
            body: payload
        });
    }

    if (result) {
        showToast(quoteId ? 'Quotation updated successfully!' : 'Quotation created successfully!', 'success');
        closeOfficerQuoteModal();
        loadAllQuotations();
    }
}

async function deleteQuotation(quoteId) {
    if (!confirm("Are you sure you want to delete this quotation bid? This action is irreversible.")) return;
    
    const result = await apiRequest(`/quotations/${quoteId}`, {
        method: 'DELETE'
    });
    
    if (result) {
        showToast("Quotation deleted successfully.", "success");
        loadAllQuotations();
    }
}

async function viewQuotation(quoteId) {
    const q = await apiRequest(`/quotations/${quoteId}`);
    if (!q) return;

    const modal = document.getElementById('view-quote-modal');
    if (!modal) return;

    document.getElementById('vq-ref-id').textContent = `Q-${q.id}`;
    
    const statusEl = document.getElementById('vq-status');
    if (statusEl) {
        statusEl.textContent = q.status || 'Pending Review';
        statusEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold ';
        if (q.status && (q.status.includes('Won') || q.status.includes('Approved'))) {
            statusEl.className += 'bg-emerald-50 text-emerald-700';
        } else if (q.status && q.status.includes('Rejected')) {
            statusEl.className += 'bg-rose-50 text-rose-700';
        } else if (q.status && q.status.includes('Selected')) {
            statusEl.className += 'bg-amber-50 text-amber-700';
        } else {
            statusEl.className += 'bg-slate-100 text-slate-700';
        }
    }

    document.getElementById('vq-vendor').textContent = q.vendor ? q.vendor.company_name : 'N/A';
    document.getElementById('vq-rfq').textContent = `RFQ #${q.rfq_id}`;
    document.getElementById('vq-price').textContent = `Rs. ${q.price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('vq-days').textContent = `${q.delivery_days} Days`;
    document.getElementById('vq-date').textContent = new Date(q.submitted_at).toLocaleString();
    document.getElementById('vq-notes').textContent = q.notes || 'No notes provided.';

    if (window.location.pathname !== `/quotations/view/${quoteId}`) {
        history.pushState(null, '', `/quotations/view/${quoteId}`);
    }

    modal.open();
}

function closeViewQuoteModal() {
    const modal = document.getElementById('view-quote-modal');
    if (modal) modal.close();
    if (window.location.pathname !== '/quotations') {
        history.pushState(null, '', '/quotations');
    }
}

// 5. Quotations Compare Panel
async function loadComparisonRFQs() {
    const rfqs = await apiRequest('/rfqs/');
    const select = document.getElementById('compare-rfq-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose RFQ to Compare Bids --</option>';
    
    if (rfqs) {
        rfqs.forEach(r => {
            if (['Open', 'Quotation Received', 'Approval Pending', 'Approved'].includes(r.status)) {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `RFQ #${r.id}: ${r.title} (${r.status})`;
                select.appendChild(opt);
            }
        });
    }
    
    // Check if rfqId parameter is appended via dynamic clean paths
    const path = window.location.pathname;
    const parts = path.split('/');
    if (parts.length > 2 && parts[1] === 'comparison') {
        const rfqId = parseInt(parts[2]);
        if (!isNaN(rfqId)) {
            select.value = rfqId;
            loadComparisonData();
        }
    } else {
        const detailsSec = document.getElementById('comparison-details-section');
        if (detailsSec) detailsSec.classList.add('hidden');
    }
}

async function loadComparisonData() {
    const select = document.getElementById('compare-rfq-select');
    if (!select) return;
    const rfqId = select.value;
    const detailsSec = document.getElementById('comparison-details-section');
    
    if (!rfqId) {
        if (detailsSec) detailsSec.classList.add('hidden');
        return;
    }
    
    // Sync browser URL cleanly
    if (window.location.pathname !== `/comparison/${rfqId}`) {
        history.pushState(null, '', `/comparison/${rfqId}`);
    }
    
    const quotes = await apiRequest(`/quotations/?rfq_id=${rfqId}`);
    const rfqDetails = await apiRequest(`/rfqs/${rfqId}`);
    
    if (!quotes || quotes.length === 0) {
        if (detailsSec) detailsSec.classList.add('hidden');
        showToast('No quotations have been submitted for this RFQ yet.', 'info');
        return;
    }
    
    if (detailsSec) detailsSec.classList.remove('hidden');
    
    state.currentComparisonQuotes = quotes;
    state.currentComparisonRFQ = rfqDetails;
    
    let lowestQuote = quotes[0];
    let fastestQuote = quotes[0];
    
    quotes.forEach(q => {
        if (q.price < lowestQuote.price) lowestQuote = q;
        if (q.delivery_days < fastestQuote.delivery_days) fastestQuote = q;
    });
    
    state.lowestQuote = lowestQuote;
    state.fastestQuote = fastestQuote;
    
    const lowestVendor = document.getElementById('highlight-lowest-vendor');
    if (lowestVendor) lowestVendor.textContent = lowestQuote.vendor.company_name;

    const lowestValue = document.getElementById('highlight-lowest-value');
    if (lowestValue) lowestValue.textContent = `Rs. ${lowestQuote.price.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    const fastestVendor = document.getElementById('highlight-fastest-vendor');
    if (fastestVendor) fastestVendor.textContent = fastestQuote.vendor.company_name;

    const fastestValue = document.getElementById('highlight-fastest-value');
    if (fastestValue) fastestValue.textContent = `${fastestQuote.delivery_days} Days`;
    
    // Reset inputs
    const sortSelect = document.getElementById('compare-sort-select');
    if (sortSelect) sortSelect.value = 'price-asc';
    const filterInput = document.getElementById('compare-vendor-filter');
    if (filterInput) filterInput.value = '';
    
    sortAndFilterComparisonData();
}

function sortAndFilterComparisonData() {
    if (!state.currentComparisonQuotes || !state.currentComparisonRFQ) return;
    
    const sortVal = document.getElementById('compare-sort-select') ? document.getElementById('compare-sort-select').value : 'price-asc';
    const filterVal = document.getElementById('compare-vendor-filter') ? document.getElementById('compare-vendor-filter').value.toLowerCase().trim() : '';
    
    let quotes = [...state.currentComparisonQuotes];
    
    // 1. Filter
    if (filterVal) {
        quotes = quotes.filter(q => q.vendor.company_name.toLowerCase().includes(filterVal));
    }
    
    // 2. Sort
    quotes.sort((a, b) => {
        if (sortVal === 'price-asc') return a.price - b.price;
        if (sortVal === 'price-desc') return b.price - a.price;
        if (sortVal === 'days-asc') return a.delivery_days - b.delivery_days;
        if (sortVal === 'days-desc') return b.delivery_days - a.delivery_days;
        return 0;
    });
    
    renderComparisonCards(quotes);
}

function renderComparisonCards(quotes) {
    const grid = document.getElementById('comparison-cards-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (quotes.length === 0) {
        grid.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400">No matching vendor quotations.</div>`;
        return;
    }
    
    const rfqDetails = state.currentComparisonRFQ;
    const lowestQuote = state.lowestQuote;
    const fastestQuote = state.fastestQuote;
    
    quotes.forEach(q => {
        const isLowest = lowestQuote && q.id === lowestQuote.id;
        const isFastest = fastestQuote && q.id === fastestQuote.id;
        
        let badges = '';
        if (isLowest) badges += `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full mr-1.5"><i class="fa-solid fa-dollar-sign"></i> Lowest</span>`;
        if (isFastest) badges += `<span class="bg-sky-100 text-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-full"><i class="fa-solid fa-bolt"></i> Fastest</span>`;
        
        const isSelectedWinner = rfqDetails.selected_quotation_id === q.id;
        
        let actionBtn = '';
        if (['Approved', 'Approval Pending'].includes(rfqDetails.status)) {
            if (isSelectedWinner) {
                actionBtn = `<div class="bg-indigo-50 text-indigo-700 text-center py-2 rounded-lg text-xs font-bold border border-indigo-100"><i class="fa-solid fa-circle-check"></i> Selected Winner</div>`;
            } else {
                actionBtn = `<div class="text-slate-400 text-center text-xs py-2">Workflow Locked</div>`;
            }
        } else {
            actionBtn = `<button onclick="selectWinner(${rfqDetails.id}, ${q.id})" class="w-full bg-[#714B67] hover:bg-[#875A7B] text-white font-semibold py-2 rounded-lg text-xs transition-colors shadow">Select Winner & Approve</button>`;
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
                    <erp-status-badge status="${q.vendor.status}"></erp-status-badge>
                </div>
                
                <div class="mt-4 space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 text-xs">Bidded Total Amount</span>
                        <span class="text-lg font-bold text-slate-800">Rs. ${q.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-slate-400 text-xs">Delivery Days</span>
                        <span class="text-sm font-semibold text-slate-700">${q.delivery_days} Days</span>
                    </div>
                    <div>
                        <span class="text-slate-400 text-[10px] font-bold uppercase tracking-wider block mb-1">Proposal Remarks</span>
                        <p class="text-xs text-slate-650 bg-slate-50 p-2.5 rounded-lg border border-slate-150 leading-relaxed italic">"${q.notes || 'No comments provided'}"</p>
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
        
        // Auto-approval checks
        const quotes = await apiRequest(`/quotations/?rfq_id=${rfqId}`);
        const winningQuote = quotes ? quotes.find(q => q.id === quoteId) : null;
        const price = winningQuote ? winningQuote.price : 0;
        
        const autoApprove = !settingsState.requireApproval || (price <= settingsState.approvalLimit);
        
        if (autoApprove && state.user && state.user.role === 'Admin') {
            showToast('Winning bid falls within auto-approval threshold. Auto-approving PO...', 'info');
            const approveRes = await apiRequest(`/approvals/${rfqId}`, {
                method: 'POST',
                body: { status: 'Approved', remarks: 'System auto-approved based on threshold configuration.' }
            });
            if (approveRes) {
                showToast(`Purchase Order generated automatically!`, 'success');
            }
        }
        
        loadComparisonData();
    }
}

// 6. Manager Approvals
async function loadApprovals() {
    const rfqs = await apiRequest('/rfqs/');
    const tbody = document.querySelector('#approvals-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!rfqs) return;
    const pendingRFQs = rfqs.filter(r => r.status === 'Approval Pending');
    
    if (pendingRFQs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">No order workflows pending your approval.</td></tr>`;
        return;
    }
    
    const role = state.user.role;
    
    for (const r of pendingRFQs) {
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
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-mono text-xs text-indigo-650 font-bold">RFQ #${r.id}</td>
            <td class="py-4 px-6 font-semibold text-slate-800">${r.title}</td>
            <td class="py-4 px-6 font-medium text-slate-700">${quote.vendor.company_name}</td>
            <td class="py-4 px-6 font-bold text-slate-900">Rs. ${quote.price.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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
    if (btn) {
        btn.className = "bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors";
        btn.textContent = "Submit Approval";
    }
    
    const modal = document.getElementById('approval-modal');
    if (modal) modal.open();
}

function rejectRFQ(rfqId) {
    document.getElementById('app-rfq-id').value = rfqId;
    document.getElementById('app-decision-status').value = 'Rejected';
    document.getElementById('approval-modal-title').textContent = `Reject RFQ #${rfqId}`;
    
    const btn = document.getElementById('btn-approval-submit');
    if (btn) {
        btn.className = "bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors";
        btn.textContent = "Submit Rejection";
    }
    
    const modal = document.getElementById('approval-modal');
    if (modal) modal.open();
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
        pollEmails();
    }
}

// 7. Purchase Orders
async function loadPurchaseOrders() {
    const pos = await apiRequest('/purchase-orders/');
    const tbody = document.querySelector('#pos-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!pos) return;
    
    if (pos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No Purchase Orders generated yet.</td></tr>`;
        return;
    }
    
    const role = state.user.role;
    
    pos.forEach(po => {
        let downloadBtn = `<button onclick="downloadPOPDF(${po.id})" class="text-brand-700 hover:text-brand-600 font-bold ml-3" title="Download PO PDF"><i class="fa-solid fa-file-pdf text-red-500 mr-1 text-sm"></i> PDF</button>`;
        
        let actionHTML = '';
        if (role === 'Vendor' && po.status === 'Generated') {
             actionHTML = `<div class="flex items-center justify-end space-x-2">
                 <button onclick="acceptPO(${po.id})" class="bg-[#714B67] hover:bg-[#875A7B] text-white px-3 py-1.5 rounded font-semibold text-xs transition-colors"><i class="fa-solid fa-thumbs-up"></i> Accept</button>
                 ${downloadBtn}
             </div>`;
        } else if (role === 'Procurement Officer' && po.status === 'Generated') {
             actionHTML = `<div class="flex items-center justify-end space-x-2">
                 <button onclick="sendPO(${po.id})" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded font-semibold text-xs transition-colors"><i class="fa-solid fa-paper-plane text-indigo-500 mr-1"></i> Send</button>
                 ${downloadBtn}
             </div>`;
        } else if (po.status === 'Accepted') {
             actionHTML = `<div class="flex items-center justify-end space-x-2">
                 <span class="text-emerald-600 text-xs font-bold"><i class="fa-solid fa-circle-check"></i> Accepted</span>
                 ${downloadBtn}
             </div>`;
        } else {
             actionHTML = `<div class="flex items-center justify-end space-x-2">
                 <span class="text-slate-400 text-xs">Sent</span>
                 ${downloadBtn}
             </div>`;
        }
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-slate-800 font-mono">${po.po_number}</td>
            <td class="py-4 px-6 font-semibold text-slate-800">${po.vendor.company_name}</td>
            <td class="py-4 px-6 font-mono text-xs text-indigo-550">RFQ #${po.rfq_id}</td>
            <td class="py-4 px-6 font-bold text-slate-900">Rs. ${po.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-6 text-slate-650">${new Date(po.created_at).toLocaleDateString()}</td>
            <td class="py-4 px-6">
                <erp-status-badge status="${po.status}"></erp-status-badge>
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

async function downloadPOPDF(poId) {
    showToast("Compiling PDF Purchase Order...", "info");
    try {
        const response = await apiRequest(`/purchase-orders/${poId}/download`);
        if (!response) return;
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `purchase_order_${poId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        showToast("PDF Purchase Order downloaded successfully!", "success");
    } catch(err) {
        console.error(err);
        showToast("Failed to download PDF Purchase Order", "error");
    }
}

// 8. Invoices
async function loadInvoices() {
    const invoices = await apiRequest('/invoices/');
    const tbody = document.querySelector('#invoices-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!invoices) return;
    
    if (invoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">No invoices have been generated.</td></tr>`;
        return;
    }
    
    invoices.forEach(inv => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="py-4 px-6 font-bold text-slate-800 font-mono">${inv.invoice_number}</td>
            <td class="py-4 px-6 font-mono text-xs">${inv.po.po_number}</td>
            <td class="py-4 px-6 font-semibold text-slate-800">${inv.po.vendor.company_name}</td>
            <td class="py-4 px-6 font-medium">Rs. ${inv.subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-6 text-slate-500">Rs. ${inv.tax.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-6 font-bold text-slate-900">Rs. ${inv.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
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
    if (!select) return;
    select.innerHTML = '';
    
    if (!pos || pos.length === 0) {
        showToast('No Purchase Orders are available for billing.', 'info');
        return;
    }
    
    const acceptedPOs = pos.filter(po => po.status === 'Accepted');
    
    if (acceptedPOs.length === 0) {
        showToast('Invoices can only be generated for POs that have been "Accepted" by the vendor.', 'warning');
        return;
    }
    
    acceptedPOs.forEach(po => {
        const opt = document.createElement('option');
        opt.value = po.id;
        opt.textContent = `${po.po_number} - ${po.vendor.company_name} (Rs. ${po.amount.toLocaleString()})`;
        select.appendChild(opt);
    });
    
    const modal = document.getElementById('invoice-modal');
    if (modal) modal.open();
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
        pollEmails();
    }
}

async function downloadPDF(invoiceId) {
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

// 9. Analytics / Reports Page
async function loadAnalytics() {
    const reports = await apiRequest('/reports/');
    if (!reports) return;
    
    const { monthly_spend, category_spend, vendor_performance } = reports;
    
    if (window.renderSpendTrendChart) {
        window.renderSpendTrendChart('recharts-spend-monthly-full', monthly_spend);
    }
    
    if (window.renderSpendCategoryChart) {
        window.renderSpendCategoryChart('recharts-spend-category-full', category_spend);
    }
    
    if (window.renderVendorPerformanceChart) {
        window.renderVendorPerformanceChart('recharts-vendor-performance', vendor_performance);
    }
    
    const rfqs = await apiRequest('/rfqs/');
    const statusCounts = {};
    if (rfqs) {
        rfqs.forEach(r => {
            statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
        });
    }
    const approvalData = Object.keys(statusCounts).map(status => ({
        status: status,
        value: statusCounts[status]
    }));
    const cleanApprovalData = approvalData.length > 0 ? approvalData : [
        { status: 'Draft', value: 1 },
        { status: 'Open', value: 2 },
        { status: 'Approval Pending', value: 0 },
        { status: 'Approved', value: 1 }
    ];
    
    if (window.renderApprovalStatsChart) {
        window.renderApprovalStatsChart('recharts-approval-stats', cleanApprovalData);
    }
    
    const tbody = document.querySelector('#vendor-performance-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    vendor_performance.forEach(v => {
        const ratingStars = getStarsHTML(v.rating);
        const score = v.rating * 20;
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="py-3 px-6 font-semibold text-slate-800">${v.company_name}</td>
            <td class="py-3 px-6 text-amber-500">${ratingStars} <span class="text-xs text-slate-550 font-medium ml-1">${v.rating.toFixed(1)}</span></td>
            <td class="py-3 px-6 font-medium text-slate-700">${v.quote_count} Quotations</td>
            <td class="py-3 px-6">
                <div class="flex items-center">
                    <span class="w-8 text-xs font-semibold text-[#714B67]">${score.toFixed(0)}%</span>
                    <div class="w-24 bg-slate-100 h-2 rounded overflow-hidden ml-2 border border-slate-200">
                        <div class="bg-[#714B67] h-full rounded" style="width: ${score}%"></div>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function exportToCSV() {
    showToast("Generating CSV report...", "info");
    try {
        const response = await apiRequest(`/reports/export/csv`);
        if (!response) return;
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `procurement_report.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        showToast("CSV report downloaded successfully!", "success");
    } catch(err) {
        console.error(err);
        showToast("Failed to download CSV report", "error");
    }
}

async function exportToPDF() {
    showToast("Compiling PDF report...", "info");
    try {
        const response = await apiRequest(`/reports/export/pdf`);
        if (!response) return;
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `procurement_report.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
        showToast("PDF report downloaded successfully!", "success");
    } catch(err) {
        console.error(err);
        showToast("Failed to download PDF report", "error");
    }
}

// 10. Audit Activity Logs
async function loadAuditLogs() {
    const logs = await apiRequest('/reports/activity-logs');
    const tbody = document.querySelector('#logs-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">No activity logs found.</td></tr>`;
        return;
    }
    
    logs.forEach(log => {
        const op = log.user ? log.user.name : '<span class="text-indigo-500 font-bold"><i class="fa-solid fa-gears"></i> SYSTEM</span>';
        const dateStr = new Date(log.timestamp).toISOString().replace('T', ' ').substring(0, 19);
        const module = getModuleFromAction(log.action);
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors text-xs border-b border-slate-100';
        tr.innerHTML = `
            <td class="py-3 px-6 text-slate-400 font-mono">${dateStr}</td>
            <td class="py-3 px-6 font-semibold text-slate-700">${op}</td>
            <td class="py-3 px-6 text-slate-600 leading-relaxed">${log.action}</td>
            <td class="py-3 px-6"><span class="bg-slate-150 text-slate-650 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">${module}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function getModuleFromAction(action) {
    const a = action.toLowerCase();
    if (a.includes('vendor')) return 'VENDORS';
    if (a.includes('rfq')) return 'RFQS';
    if (a.includes('quotation') || a.includes('bid')) return 'QUOTATIONS';
    if (a.includes('approval') || a.includes('approved') || a.includes('rejected')) return 'APPROVALS';
    if (a.includes('purchase order') || a.includes('po')) return 'ORDERS';
    if (a.includes('invoice')) return 'INVOICES';
    return 'SYSTEM';
}

// 11. Profile Loader
function loadProfile() {
    if (!state.user) return;
    
    const nameEl = document.getElementById('profile-detail-name');
    if (nameEl) nameEl.textContent = state.user.name;

    const emailEl = document.getElementById('profile-detail-email');
    if (emailEl) emailEl.textContent = state.user.email;

    const roleEl = document.getElementById('profile-detail-role');
    if (roleEl) roleEl.textContent = state.user.role;

    const compEl = document.getElementById('profile-detail-company');
    if (compEl) {
        compEl.textContent = state.user.company_name || 'My Company (New Delhi)';
    }
}

// ================= MODAL ACTIONS =================

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

async function handleRFQSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('rfq-title').value;
    const quantity = parseInt(document.getElementById('rfq-quantity').value);
    const deadlineVal = document.getElementById('rfq-deadline').value;
    const description = document.getElementById('rfq-desc').value;
    const attachment_name = document.getElementById('rfq-attachment').value || null;
    const status = document.getElementById('rfq-status-select').value;
    
    const deadline = new Date(deadlineVal).toISOString();
    
    const assigned_vendor_ids = [];
    document.querySelectorAll('.rfq-vendor-chk:checked').forEach(chk => {
        assigned_vendor_ids.push(parseInt(chk.value));
    });
    
    const result = await apiRequest('/rfqs/', {
        method: 'POST',
        body: { title, description, quantity, deadline, assigned_vendor_ids, attachment_name, attachment_url: attachment_name ? `https://mock-s3.amazonaws.com/${attachment_name}` : null }
    });
    
    if (result) {
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

// ================= MODAL OPENERS =================

function openCreateVendorModal(updateUrl = true) {
    const form = document.getElementById('vendor-form');
    if (!form) return;
    form.reset();
    form.onsubmit = handleVendorSubmit; // Restore handle
    
    // Inject status field if not present
    let statusContainer = document.getElementById('v-status-container');
    if (!statusContainer) {
        const ratingContainer = document.getElementById('v-rating-container');
        if (ratingContainer) {
            statusContainer = document.createElement('div');
            statusContainer.id = 'v-status-container';
            statusContainer.className = 'grid grid-cols-2 gap-4';
            statusContainer.innerHTML = `
                <div class="mb-3.5">
                    <label for="v-status" class="block text-xs font-semibold text-slate-650 uppercase mb-1">Status</label>
                    <select id="v-status" class="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#714B67]">
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Suspended">Suspended</option>
                    </select>
                </div>
            `;
            ratingContainer.parentNode.insertBefore(statusContainer, ratingContainer.nextSibling);
        }
    }
    
    if (statusContainer) statusContainer.classList.add('hidden'); // hidden on create, default Active
    
    const title = document.getElementById('vendor-modal-title');
    if (title) title.textContent = 'Add Vendor Partner';
    
    const container = document.getElementById('v-rating-container');
    if (container) container.classList.add('hidden');
    
    const modal = document.getElementById('vendor-modal');
    if (modal) {
        modal.open();
        if (updateUrl) history.pushState(null, '', '/vendors/new');
    }
}

function closeVendorModal() {
    const modal = document.getElementById('vendor-modal');
    if (modal) {
        modal.close();
        if (window.location.pathname !== '/vendors') {
            history.pushState(null, '', '/vendors');
        }
    }
}

async function openCreateRFQModal(updateUrl = true) {
    const form = document.getElementById('rfq-form');
    if (!form) return;
    form.reset();
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 7);
    const deadline = document.getElementById('rfq-deadline');
    if (deadline) deadline.value = tomorrow.toISOString().substring(0, 16);
    
    const checklist = document.getElementById('rfq-vendors-checklist');
    if (checklist) {
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
    }
    
    const modal = document.getElementById('rfq-modal');
    if (modal) {
        modal.open();
        if (updateUrl) history.pushState(null, '', '/rfqs/new');
    }
}

function closeRFQModal() {
    const modal = document.getElementById('rfq-modal');
    if (modal) {
        modal.close();
        if (window.location.pathname !== '/rfqs') {
            history.pushState(null, '', '/rfqs');
        }
    }
}

function openSubmitQuoteModal(rfqId, price = '', days = '', notes = '') {
    const form = document.getElementById('quote-form');
    if (!form) return;
    form.reset();
    
    document.getElementById('q-rfq-id').value = rfqId;
    document.getElementById('q-price').value = price;
    document.getElementById('q-days').value = days;
    document.getElementById('q-notes').value = notes;
    
    const modal = document.getElementById('quote-modal');
    if (modal) modal.open();
}

function closeQuoteModal() {
    const modal = document.getElementById('quote-modal');
    if (modal) modal.close();
}

function closeApprovalModal() {
    const modal = document.getElementById('approval-modal');
    if (modal) modal.close();
}

function closeInvoiceModal() {
    const modal = document.getElementById('invoice-modal');
    if (modal) modal.close();
}

// Edit Vendor Detail Loader
async function editVendor(vendorId, updateUrl = true) {
    const v = state.cachedVendors.find(x => x.id === vendorId) || await apiRequest(`/vendors/${vendorId}`);
    if (!v) return;
    
    const form = document.getElementById('vendor-form');
    if (!form) return;
    form.reset();
    
    // Inject status field if not present
    let statusContainer = document.getElementById('v-status-container');
    if (!statusContainer) {
        const ratingContainer = document.getElementById('v-rating-container');
        if (ratingContainer) {
            statusContainer = document.createElement('div');
            statusContainer.id = 'v-status-container';
            statusContainer.className = 'grid grid-cols-2 gap-4';
            statusContainer.innerHTML = `
                <div class="mb-3.5">
                    <label for="v-status" class="block text-xs font-semibold text-slate-655 uppercase mb-1">Status</label>
                    <select id="v-status" class="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#714B67]">
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Suspended">Suspended</option>
                    </select>
                </div>
            `;
            ratingContainer.parentNode.insertBefore(statusContainer, ratingContainer.nextSibling);
        }
    }
    
    if (statusContainer) {
        statusContainer.classList.remove('hidden');
        document.getElementById('v-status').value = v.status;
        document.getElementById('v-status').removeAttribute('disabled');
    }
    
    const title = document.getElementById('vendor-modal-title');
    if (title) title.textContent = 'Modify Vendor Details';
    
    const ratingContainer = document.getElementById('v-rating-container');
    if (ratingContainer) ratingContainer.classList.add('hidden');
    
    document.getElementById('v-name').value = v.company_name;
    document.getElementById('v-gst').value = v.gst_number;
    document.getElementById('v-category').value = v.category;
    document.getElementById('v-email').value = v.email;
    document.getElementById('v-phone').value = v.phone;
    document.getElementById('v-address').value = v.address;
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        const body = {
            company_name: document.getElementById('v-name').value,
            gst_number: document.getElementById('v-gst').value,
            category: document.getElementById('v-category').value,
            email: document.getElementById('v-email').value,
            phone: document.getElementById('v-phone').value,
            address: document.getElementById('v-address').value,
            status: document.getElementById('v-status') ? document.getElementById('v-status').value : 'Active'
        };
        const result = await apiRequest(`/vendors/${v.id}`, {
            method: 'PUT',
            body: body
        });
        if (result) {
            showToast('Vendor profile updated successfully!', 'success');
            closeVendorModal();
            loadVendors();
        }
    };
    
    const modal = document.getElementById('vendor-modal');
    if (modal) {
        modal.open();
        if (updateUrl) history.pushState(null, '', `/vendors/edit/${vendorId}`);
    }
}

// View Vendor Detail popup
async function viewVendorDetails(vendorId, updateUrl = true) {
    const v = state.cachedVendors.find(x => x.id === vendorId) || await apiRequest(`/vendors/${vendorId}`);
    if (!v) return;
    
    const form = document.getElementById('vendor-form');
    if (!form) return;
    form.reset();
    
    // Inject status field if not present
    let statusContainer = document.getElementById('v-status-container');
    if (!statusContainer) {
        const ratingContainer = document.getElementById('v-rating-container');
        if (ratingContainer) {
            statusContainer = document.createElement('div');
            statusContainer.id = 'v-status-container';
            statusContainer.className = 'grid grid-cols-2 gap-4';
            statusContainer.innerHTML = `
                <div class="mb-3.5">
                    <label for="v-status" class="block text-xs font-semibold text-slate-655 uppercase mb-1">Status</label>
                    <select id="v-status" class="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#714B67]">
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Suspended">Suspended</option>
                    </select>
                </div>
            `;
            ratingContainer.parentNode.insertBefore(statusContainer, ratingContainer.nextSibling);
        }
    }
    
    if (statusContainer) {
        statusContainer.classList.remove('hidden');
        document.getElementById('v-status').value = v.status;
    }
    
    const title = document.getElementById('vendor-modal-title');
    if (title) title.textContent = 'Vendor Partner Details';
    
    const ratingContainer = document.getElementById('v-rating-container');
    if (ratingContainer) ratingContainer.classList.remove('hidden');
    
    document.getElementById('v-name').value = v.company_name;
    document.getElementById('v-gst').value = v.gst_number;
    document.getElementById('v-category').value = v.category;
    document.getElementById('v-email').value = v.email;
    document.getElementById('v-phone').value = v.phone;
    document.getElementById('v-address').value = v.address;
    
    const ratingInput = document.getElementById('v-rating');
    if (ratingInput) {
        ratingInput.value = v.rating;
        ratingInput.setAttribute('disabled', 'true');
    }
    
    // Disable inputs
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(el => el.setAttribute('disabled', 'true'));
    
    // Hide save button
    const saveBtn = form.querySelector('button[type="submit"]');
    if (saveBtn) saveBtn.classList.add('hidden');
    
    form.onsubmit = (e) => e.preventDefault();
    
    // Reset standard close event to re-enable elements when closed
    const modal = document.getElementById('vendor-modal');
    if (modal) {
        modal.open();
        
        // Save current close handler
        const prevClose = modal.close;
        modal.close = function() {
            inputs.forEach(el => el.removeAttribute('disabled'));
            if (saveBtn) saveBtn.classList.remove('hidden');
            modal.close = prevClose; // Restore
            closeVendorModal();
        };
        
        if (updateUrl) history.pushState(null, '', `/vendors/view/${vendorId}`);
    }
}

// Edit RFQ modal details
async function editRFQ(rfqId, updateUrl = true) {
    const r = await apiRequest(`/rfqs/${rfqId}`);
    if (!r) return;
    
    const form = document.getElementById('rfq-form');
    if (!form) return;
    form.reset();
    
    const title = document.getElementById('rfq-modal-title');
    if (title) title.textContent = 'Modify Procurement RFQ';
    
    document.getElementById('rfq-title').value = r.title;
    document.getElementById('rfq-quantity').value = r.quantity;
    document.getElementById('rfq-desc').value = r.description;
    document.getElementById('rfq-attachment').value = r.attachment_name || '';
    document.getElementById('rfq-status-select').value = r.status;
    
    const dlField = document.getElementById('rfq-deadline');
    if (dlField) dlField.value = new Date(r.deadline).toISOString().substring(0, 16);
    
    const checklist = document.getElementById('rfq-vendors-checklist');
    if (checklist) {
        checklist.innerHTML = '';
        const vendors = state.cachedVendors.length > 0 ? state.cachedVendors : await apiRequest('/vendors/');
        vendors.forEach(v => {
            const isAssigned = r.assigned_vendors.some(x => x.id === v.id);
            const checkedAttr = isAssigned ? 'checked' : '';
            const div = document.createElement('div');
            div.className = 'flex items-center';
            div.innerHTML = `
                <input type="checkbox" id="chk-vendor-${v.id}" value="${v.id}" ${checkedAttr} class="rfq-vendor-chk h-4 w-4 text-brand-600 border-slate-350 rounded focus:ring-brand-500">
                <label for="chk-vendor-${v.id}" class="ml-2 text-xs text-slate-700 font-semibold">${v.company_name} (${v.category})</label>
            `;
            checklist.appendChild(div);
        });
    }
    
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const assigned_vendor_ids = [];
        document.querySelectorAll('.rfq-vendor-chk:checked').forEach(chk => {
            assigned_vendor_ids.push(parseInt(chk.value));
        });
        
        const body = {
            title: document.getElementById('rfq-title').value,
            quantity: parseInt(document.getElementById('rfq-quantity').value),
            deadline: new Date(document.getElementById('rfq-deadline').value).toISOString(),
            description: document.getElementById('rfq-desc').value,
            attachment_name: document.getElementById('rfq-attachment').value || null,
            attachment_url: document.getElementById('rfq-attachment').value ? `https://mock-s3.amazonaws.com/${document.getElementById('rfq-attachment').value}` : null,
            assigned_vendor_ids: assigned_vendor_ids,
            status: document.getElementById('rfq-status-select').value
        };
        
        const result = await apiRequest(`/rfqs/${r.id}`, {
            method: 'PUT',
            body: body
        });
        if (result) {
            showToast('RFQ configurations updated successfully!', 'success');
            closeRFQModal();
            loadRFQs();
        }
    };
    
    const modal = document.getElementById('rfq-modal');
    if (modal) {
        modal.open();
        if (updateUrl) history.pushState(null, '', `/rfqs/edit/${rfqId}`);
    }
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

// ================= EMAILS & NOTIFICATIONS =================

async function pollEmails() {
     if (!state.user || !['Admin', 'Procurement Officer'].includes(state.user.role)) return;
     
     const emails = await apiRequest('/reports/mock-emails');
     if (emails) {
          state.emails = emails;
          const badge = document.getElementById('emails-count-badge');
          if (badge) {
              badge.textContent = emails.length;
              if (emails.length > 0) {
                   badge.classList.remove('hidden');
              } else {
                   badge.classList.add('hidden');
              }
          }
          
          const modal = document.getElementById('emails-modal');
          if (modal && !modal.classList.contains('hidden')) {
               renderEmailsSidebar();
          }
     }
}

function openEmailsModal() {
    renderEmailsSidebar();
    
    const placeholder = document.getElementById('email-placeholder');
    if (placeholder) placeholder.classList.remove('hidden');

    const realContent = document.getElementById('email-real-content');
    if (realContent) realContent.classList.add('hidden');
    
    const modal = document.getElementById('emails-modal');
    if (modal) modal.open();
}

function closeEmailsModal() {
    const modal = document.getElementById('emails-modal');
    if (modal) modal.close();
}

function renderEmailsSidebar() {
    const list = document.getElementById('emails-sidebar-list');
    if (!list) return;
    list.innerHTML = '';
    
    if (state.emails.length === 0) {
        list.innerHTML = `<p class="p-6 text-xs text-slate-400 italic text-center">Outbox is empty. No notifications sent.</p>`;
        return;
    }
    
    state.emails.slice().reverse().forEach(mail => {
        const item = document.createElement('button');
        item.className = 'w-full text-left p-4 hover:bg-slate-50 focus:outline-none transition-colors border-b border-slate-105 flex flex-col space-y-1';
        item.onclick = () => readEmail(mail);
        item.innerHTML = `
            <div class="flex justify-between items-center text-[10px] w-full">
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
    const placeholder = document.getElementById('email-placeholder');
    if (placeholder) placeholder.classList.add('hidden');

    const content = document.getElementById('email-real-content');
    if (content) content.classList.remove('hidden');
    
    document.getElementById('mail-to').textContent = mail.to_email;
    document.getElementById('mail-subject').textContent = mail.subject;
    document.getElementById('mail-body').textContent = mail.body;
    
    const d = new Date(mail.timestamp);
    document.getElementById('mail-time').textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
}

function startNotificationPoller() {
     pollEmails();
     setInterval(pollEmails, 6000);
}

function toggleNotifications() {
     const panel = document.getElementById('notifications-panel');
     if (panel) {
         panel.classList.toggle('hidden');
         if (!panel.classList.contains('hidden')) {
              renderNotifications();
         }
     }
}

async function renderNotifications() {
     const list = document.getElementById('notifications-list');
     if (!list) return;
     list.innerHTML = '';
     
     const logs = await apiRequest('/reports/activity-logs');
     if (!logs || logs.length === 0) {
          list.innerHTML = `<p class="p-4 text-center text-xs text-slate-400 italic">No recent activities.</p>`;
          return;
     }
     
     logs.slice(0, 6).forEach(log => {
          const item = document.createElement('div');
          item.className = 'p-3 hover:bg-slate-50 transition-colors text-xs flex items-start space-x-3';
          
          let icon = '<i class="fa-solid fa-bell text-slate-400"></i>';
          let bg = 'bg-slate-100';
          
          const actionText = log.action.toLowerCase();
          if (actionText.includes('created rfq')) {
              icon = '<i class="fa-solid fa-file-signature text-[#714B67]"></i>';
              bg = 'bg-purple-50';
          } else if (actionText.includes('submitted') || actionText.includes('quotation')) {
              icon = '<i class="fa-solid fa-scale-balanced text-[#714B67]"></i>';
              bg = 'bg-purple-50';
          } else if (actionText.includes('approved')) {
              icon = '<i class="fa-solid fa-clipboard-check text-emerald-600"></i>';
              bg = 'bg-emerald-50';
          } else if (actionText.includes('po') || actionText.includes('purchase order')) {
              icon = '<i class="fa-solid fa-cart-shopping text-sky-600"></i>';
              bg = 'bg-sky-50';
          } else if (actionText.includes('invoice')) {
              icon = '<i class="fa-solid fa-file-invoice text-emerald-600"></i>';
              bg = 'bg-emerald-50';
          } else if (actionText.includes('rejected')) {
              icon = '<i class="fa-solid fa-triangle-exclamation text-red-500"></i>';
              bg = 'bg-red-50';
          }
          
          const timeStr = formatRelativeTime(new Date(log.timestamp));
          
          item.innerHTML = `
               <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${bg}">
                   ${icon}
               </div>
               <div class="flex-1 min-w-0">
                    <p class="text-slate-700 leading-normal font-medium">${log.action}</p>
                    <span class="text-[9px] text-slate-400 mt-0.5 block"><i class="fa-regular fa-clock mr-1"></i>${timeStr}</span>
               </div>
          `;
          list.appendChild(item);
     });
}

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
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// ================= SETTINGS CONTROLLER =================
async function loadSettings() {
    document.getElementById('settings-company-name').value = settingsState.companyName;
    document.getElementById('settings-company-gst').value = settingsState.companyGst;
    document.getElementById('settings-auto-publish').checked = settingsState.autoPublish;
    document.getElementById('settings-require-approval').checked = settingsState.requireApproval;
    document.getElementById('settings-auto-po').checked = settingsState.autoPO;
    document.getElementById('settings-approval-limit').value = settingsState.approvalLimit;

    const switcher = document.querySelector('#navbar-company-name');
    if (switcher) switcher.textContent = settingsState.companyName;

    const logs = await apiRequest('/reports/activity-logs');
    const tbody = document.querySelector('#settings-logs-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-400">No activity logs recorded.</td></tr>`;
        return;
    }
    
    logs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleString();
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors';
        tr.innerHTML = `
            <td class="py-3 px-6 text-slate-500">${time}</td>
            <td class="py-3 px-6 font-semibold text-slate-700">${log.user ? log.user.name : 'System Automated'}</td>
            <td class="py-3 px-6 text-slate-600">${log.action}</td>
        `;
        tbody.appendChild(tr);
    });
}

function saveSettings() {
    const companyName = document.getElementById('settings-company-name').value.trim();
    const companyGst = document.getElementById('settings-company-gst').value.trim();
    const autoPublish = document.getElementById('settings-auto-publish').checked;
    const requireApproval = document.getElementById('settings-require-approval').checked;
    const autoPO = document.getElementById('settings-auto-po').checked;
    const approvalLimit = parseFloat(document.getElementById('settings-approval-limit').value);
    
    if (!companyName || !companyGst || isNaN(approvalLimit)) {
        showToast('Please verify and enter valid configurations.', 'warning');
        return;
    }
    
    settingsState.companyName = companyName;
    settingsState.companyGst = companyGst;
    settingsState.autoPublish = autoPublish;
    settingsState.requireApproval = requireApproval;
    settingsState.autoPO = autoPO;
    settingsState.approvalLimit = approvalLimit;
    
    localStorage.setItem('settings_company_name', companyName);
    localStorage.setItem('settings_company_gst', companyGst);
    localStorage.setItem('settings_auto_publish', autoPublish);
    localStorage.setItem('settings_require_approval', requireApproval);
    localStorage.setItem('settings_auto_po', autoPO);
    localStorage.setItem('settings_approval_limit', approvalLimit);
    
    const switcher = document.querySelector('#navbar-company-name');
    if (switcher) switcher.textContent = companyName;
    
    showToast('Enterprise configurations updated successfully!', 'success');
}

function discardSettings() {
    loadSettings();
    showToast('Configurations reset to previous state.', 'info');
}

// ================= HELPERS =================

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

function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay}d ago`;
}

// Expose app functions globally
window.app = {
    triggerViewLoader,
    autofillLogin,
    toggleCompanyField
};
