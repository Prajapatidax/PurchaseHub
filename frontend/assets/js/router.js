// Client-Side PJAX Router for Odoo Procurement ERP

class ErpRouter {
    constructor() {
        this.initEventListeners();
    }

    initEventListeners() {
        // Intercept standard internal links
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                const href = link.getAttribute('href');
                // Intercept if relative internal link, not external, not download, not hash
                if (href && href.startsWith('/') && !href.startsWith('//') && !link.hasAttribute('download') && link.target !== '_blank') {
                    e.preventDefault();
                    this.navigate(href);
                }
            }
        });

        // Listen for browser back/forward buttons
        window.addEventListener('popstate', () => {
            this.navigate(window.location.pathname, false);
        });
    }

    async navigate(path, pushState = true) {
        const publicPaths = ['/login', '/signup', '/forgot-password'];
        const isTargetPublic = publicPaths.includes(path);
        const isCurrentPublic = publicPaths.includes(window.location.pathname);

        // If shifting between public pages and authenticated app pages, do a full reload
        if (isTargetPublic !== isCurrentPublic) {
            window.location.href = path;
            return;
        }

        if (pushState) {
            history.pushState(null, '', path);
        }

        try {
            // Show a micro spinner/loading state in Odoo color
            const mainContainer = document.getElementById('screen-container');
            if (mainContainer) {
                mainContainer.style.opacity = '0.5';
            }

            const response = await fetch(path);
            if (!response.ok) throw new Error(`Fetch failed for: ${path}`);
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const newContent = doc.getElementById('screen-container');
            const currentContent = document.getElementById('screen-container');

            if (newContent && currentContent) {
                currentContent.innerHTML = newContent.innerHTML;
                document.title = doc.title;

                // Fade back in
                currentContent.style.opacity = '1';

                // Extract active-item from sidebar attribute
                const targetSidebar = doc.querySelector('erp-sidebar');
                const activeItem = targetSidebar ? targetSidebar.getAttribute('active-item') : 'dashboard';

                // Extract page-title from navbar attribute
                const targetNavbar = doc.querySelector('erp-navbar');
                const pageTitle = targetNavbar ? targetNavbar.getAttribute('page-title') : 'PurchaseHub';

                // Update active element attributes programmatically without reloading components
                const sidebar = document.querySelector('erp-sidebar');
                if (sidebar) {
                    sidebar.setAttribute('active-item', activeItem);
                }

                const navbar = document.querySelector('erp-navbar');
                if (navbar) {
                    navbar.setAttribute('page-title', pageTitle);
                }

                // Fire page loader callback in app.js
                if (window.app && typeof window.app.triggerViewLoader === 'function') {
                    window.app.triggerViewLoader(activeItem);
                }
            } else {
                // Fallback to reload if target structure is incompatible
                window.location.href = path;
            }
        } catch (error) {
            console.error("PJAX Router Navigation Error:", error);
            window.location.href = path;
        }
    }
}

// Instantiate router globally
window.router = new ErpRouter();
