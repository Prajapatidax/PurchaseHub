// Odoo Reusable UI Components - Table & Form Elements

// 1. Status Badge: <erp-status-badge status="Draft"></erp-status-badge>
class ErpStatusBadge extends HTMLElement {
    static get observedAttributes() { return ['status']; }
    attributeChangedCallback() { this.render(); }
    connectedCallback() { this.render(); }
    render() {
        const rawStatus = this.getAttribute('status') || 'Draft';
        const cleanStatus = rawStatus.toLowerCase().replace(/[\s-_]/g, '');
        
        let badgeClass = 'badge-status-draft';
        if (cleanStatus === 'open') badgeClass = 'badge-status-open';
        else if (cleanStatus === 'quotationreceived' || cleanStatus === 'received') badgeClass = 'badge-status-received';
        else if (cleanStatus === 'approvalpending' || cleanStatus === 'pending') badgeClass = 'badge-status-pending';
        else if (cleanStatus === 'approved') badgeClass = 'badge-status-approved';
        else if (cleanStatus === 'rejected') badgeClass = 'badge-status-rejected';
        else if (cleanStatus === 'generated' || cleanStatus === 'sent') badgeClass = 'badge-status-po-sent';
        else if (cleanStatus === 'accepted') badgeClass = 'badge-status-po-accepted';

        this.innerHTML = `<span class="badge-status ${badgeClass}">${rawStatus}</span>`;
    }
}
customElements.define('erp-status-badge', ErpStatusBadge);

// 2. Modal Popup Dialog: <erp-modal id="my-modal" title="Header Title">...</erp-modal>
class ErpModal extends HTMLElement {
    connectedCallback() {
        const title = this.getAttribute('title') || 'Modal';
        const sizeClass = this.getAttribute('size') === 'lg' ? 'max-w-xl' : (this.getAttribute('size') === 'sm' ? 'max-w-md' : 'max-w-lg');
        const contentHtml = this.innerHTML;
        
        this.className = "fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4 hidden transition-opacity duration-300";
        this.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg w-full ${sizeClass} border border-slate-200 overflow-hidden transform scale-95 transition-transform duration-300 flex flex-col">
                <div class="bg-[#714B67] p-5 text-white flex justify-between items-center shrink-0">
                    <h3 class="text-lg font-bold">${title}</h3>
                    <button class="modal-close-btn text-white/80 hover:text-white"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <div class="modal-body-container flex-1 overflow-y-auto">
                    ${contentHtml}
                </div>
            </div>
        `;
        
        // Close event listener
        this.querySelector('.modal-close-btn').addEventListener('click', () => this.close());
    }

    open() {
        this.classList.remove('hidden');
        setTimeout(() => {
            this.querySelector('.bg-white').classList.remove('scale-95');
            this.querySelector('.bg-white').classList.add('scale-100');
        }, 10);
    }

    close() {
        this.querySelector('.bg-white').classList.remove('scale-100');
        this.querySelector('.bg-white').classList.add('scale-95');
        setTimeout(() => {
            this.classList.add('hidden');
        }, 150);
    }
}
customElements.define('erp-modal', ErpModal);

// 3. Form Input: <erp-form-input id="inp" label="Name" placeholder="Enter name"></erp-form-input>
class ErpFormInput extends HTMLElement {
    connectedCallback() {
        const label = this.getAttribute('label') || '';
        const id = this.getAttribute('id') || '';
        const type = this.getAttribute('type') || 'text';
        const placeholder = this.getAttribute('placeholder') || '';
        const required = this.hasAttribute('required') ? 'required' : '';
        const value = this.getAttribute('value') || '';

        this.innerHTML = `
            <div class="mb-3.5">
                <label for="${id}" class="block text-xs font-semibold text-slate-600 uppercase mb-1">${label}</label>
                <input type="${type}" id="${id}" name="${id}" placeholder="${placeholder}" value="${value}" ${required} class="w-full text-sm">
            </div>
        `;
    }
}
customElements.define('erp-form-input', ErpFormInput);

// 4. Page Header: <erp-page-header title="Header" subtitle="Subtitle"></erp-page-header>
class ErpPageHeader extends HTMLElement {
    connectedCallback() {
        const title = this.getAttribute('title') || '';
        const subtitle = this.getAttribute('subtitle') || '';
        const actionsHtml = this.innerHTML;

        this.innerHTML = `
            <div class="flex justify-between items-center flex-wrap gap-4 bg-slate-50 p-4 border border-slate-200 rounded-lg mb-6 w-full">
                <div>
                    <h3 class="text-md font-bold text-slate-800">${title}</h3>
                    ${subtitle ? `<p class="text-xs text-slate-500 mt-0.5">${subtitle}</p>` : ''}
                </div>
                <div class="flex items-center space-x-2 shrink-0">
                    ${actionsHtml}
                </div>
            </div>
        `;
    }
}
customElements.define('erp-page-header', ErpPageHeader);

// 5. Search Bar & Filter Panel combined
class ErpSearchBar extends HTMLElement {
    connectedCallback() {
        const id = this.getAttribute('id') || 'table-search';
        const placeholder = this.getAttribute('placeholder') || 'Search...';
        
        this.innerHTML = `
            <div class="relative w-full sm:w-80 shrink-0">
                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <i class="fa-solid fa-magnifying-glass"></i>
                </span>
                <input type="text" id="${id}" placeholder="${placeholder}" class="pl-9 text-sm">
            </div>
        `;
    }
}
customElements.define('erp-search-bar', ErpSearchBar);

// 6. Pagination component
class ErpPagination extends HTMLElement {
    connectedCallback() {
        this.render();
    }
    render() {
        this.innerHTML = `
            <div class="flex justify-between items-center py-4 px-6 bg-slate-50 border-t border-slate-200">
                <span class="text-xs text-slate-500">Showing <b>1</b> to <b>10</b> of <b>10</b> entries</span>
                <div class="flex space-x-1">
                    <button class="btn-secondary text-xs px-2.5 py-1.5 opacity-50 cursor-not-allowed"><i class="fa-solid fa-chevron-left"></i></button>
                    <button class="btn-primary text-xs px-3 py-1.5">1</button>
                    <button class="btn-secondary text-xs px-2.5 py-1.5 opacity-50 cursor-not-allowed"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>
        `;
    }
}
customElements.define('erp-pagination', ErpPagination);
