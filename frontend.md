# Frontend Architecture Specifications

The PurchaseHub frontend is structured as a client-side Single Page Application (SPA) implementing role-based dashboards, modals-driven CRUD actions, and responsive layout systems.

---

## 1. Directory Structure

```text
frontend/
├── index.html         # Main application frame & entry container
├── app.js             # Global controller copy (sync check)
├── style.css          # Vanilla custom components stylesheet
├── assets/
│   ├── css/
│   │   └── style.css  # Alternate/assets styles path
│   └── js/
│       ├── app.js     # Main application state and API handler
│       └── router.js  # Routing layer handling screen transitions
├── components/        # Reusable custom Web Components (HTML5 Elements)
│   ├── sidebar.js     # Sidebar component (<erp-sidebar>)
│   ├── navbar.js      # Navigation bar component (<erp-navbar>)
│   ├── datatable.js   # Badges, modals, inputs, header, pagination
│   └── charts.js      # Custom charts adapters (Wraps Recharts CDN)
└── pages/             # Template pages loaded into layout
    ├── activity-logs.html
    ├── approvals.html
    ├── comparison.html
    ├── dashboard.html
    ├── invoices.html
    ├── profile.html
    ├── purchase-orders.html
    ├── quotations.html
    ├── reports.html
    ├── rfqs.html
    ├── settings.html
    └── vendors.html
```

---

## 2. Component Design System

To ensure consistency and maximum modularity, the frontend uses standard HTML5 Web Components (Custom Elements) defined in `frontend/components/`:

### Custom Layout Elements
- `<erp-sidebar>`: Renders the primary navigation sidebar. It reads the user's role from local storage and hides restricted paths (e.g. Vendors only see the Bids Portal, Managers only see Approvals and POs, Admin/Procurement see everything).
- `<erp-navbar>`: Displays the page title and the dynamic active company switcher.
- `<erp-page-header>`: Handles page headers, displaying title, subtitle, and dynamic actions/filters.
- `<erp-modal>`: A slide-in popup frame containing custom transaction forms. It handles slide-in transitions and clean overlays.

### Custom Form Elements
- `<erp-form-input>`: Enforces clean spacing, standard labels, inputs, and validation properties.
- `<erp-status-badge>`: Standardizes badge colors based on record state values (e.g. `Approved` -> Emerald green, `Rejected` -> Rose red, `Draft` -> Gray, `Open` -> Blue).

---

## 3. SPA Routing & View Transition

All screen switching is handled client-side in `frontend/assets/js/router.js` using hash location routing. When a route is resolved:
1. All open modals are automatically closed.
2. The controller (`app.js`) validates user authentication token.
3. Swaps active view class styles (removing `hidden` from the target view container).
4. Calls specialized page loaders to fetch fresh JSON data from FastAPI endpoints and populates tables dynamically using vanilla JS DOM compilation.

---

## 4. Analytical Charts Integrations

Since Recharts is a React-based library, the module uses custom wrapper elements within vanilla JS:
1. Includes React, ReactDOM, and Recharts CDNs.
2. Registers custom wrapper handlers (`window.renderSpendTrendChart`, `window.renderSpendCategoryChart`, etc.) in `frontend/components/charts.js`.
3. Injects React JSX components directly into vanilla HTML div nodes.
4. Customizes tooltip overlays and category fills using primary Odoo-harmonious colors (e.g., Purple `#714B67`, Indigo `#875A7B`, and Amber `#F59E0B`).
