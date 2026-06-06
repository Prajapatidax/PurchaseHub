# Project Summary & Architecture

PurchaseHub is built using a clean separation of concerns, dividing code into a backend REST API service and a frontend Single Page Application (SPA).

---

## 1. High-Level Architectural Layout

```text
       +-------------------------------------------------------+
       |                     FRONTEND SPA                      |
       |  (index.html, router.js, app.js, custom-components)   |
       +---------------------------+---------------------------+
                                   |
                                   | HTTP REST API Requests (JSON / JWT)
                                   v
       +-------------------------------------------------------+
       |                  FASTAPI BACKEND API                  |
       |  (main.py, routers/*, schemas.py, security.py)        |
       +---------------------------+---------------------------+
                                   |
                     +-------------+-------------+
                     |                           |
                     v                           v
       +---------------------------+   +-----------------------+
       |      SQLALCHMY ORM        |   |    REPORTLAB PDF &    |
       |      (SQLite Database)    |   |     MOCK SMTP EMAIL   |
       |     (vendorbridge.db)     |   |      UTILITIES        |
       +---------------------------+   +-----------------------+
```

---

## 2. Technology Stack

### Backend Stack
- **FastAPI**: Modern, fast (high-performance) web framework for building APIs with Python.
- **SQLAlchemy**: Python SQL toolkit and Object Relational Mapper for database portability.
- **SQLite**: Lightweight, zero-configuration file database.
- **Python-Jose / Passlib**: Token-based JWT cryptography security.
- **ReportLab**: PDF Generation engine.

### Frontend Stack
- **Tailwind CSS**: Utility-first CSS library.
- **Vanilla Javascript**: Core routing logic and state management.
- **HTML5 Custom Elements**: Custom component specifications.
- **Recharts / React / ReactDOM**: Charts visualization library.

---

## 3. Core Directory & File Mapping

```text
PurchaseHub/
├── README.md                  # Entrypoint documentation
├── project_summary.md         # High-level architecture overview
├── brief_details.md           # Business workflow & roles guide
├── api_info.md                # FastAPI REST API endpoints guide
├── database.md                # SQLite database schema specification
├── frontend.md                # SPA, components, and routing details
├── backend.md                 # FastAPI structure & security specifications
├── seed_data.py               # Database initial seeding script
├── test_procurement_lifecycle.py # End-to-end integration test suite
├── vendorbridge.db            # SQLite database file
├── backend/                   # Backend Python FastAPI application
│   └── app/
│       ├── database.py
│       ├── main.py
│       ├── models.py
│       ├── schemas.py
│       ├── security.py
│       ├── routers/
│       └── services/
└── frontend/                  # Frontend SPA application
    ├── index.html
    ├── app.js
    ├── style.css
    ├── assets/
    ├── components/
    └── pages/
```
