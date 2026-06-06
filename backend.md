# Backend Architecture Specifications

The backend represents a lightweight high-performance REST service written in Python using FastAPI, structured to support multi-tenant role permissions and transaction tracking.

---

## 1. Directory Structure

```text
backend/
├── requirements.txt   # Backend dependencies checklist
└── app/
    ├── __init__.py
    ├── config.py      # App configurations (JWT secret, DB URL)
    ├── database.py    # SQLAlchemy engine connection session
    ├── main.py        # FastAPI entrypoint (routes, CORS middleware)
    ├── models.py      # Database ORM classes
    ├── schemas.py     # Pydantic models for validation
    ├── security.py    # Password hashing and JWT generation
    ├── routers/       # REST routes by endpoint groups
    └── services/      # External utility integrations
        ├── email_mock.py     # Outbound notification SMTP simulation
        └── pdf_generator.py  # ReportLab document generation flows
```

---

## 2. Core Framework Stack

### Routing & Middleware (`main.py`)
- Standard FastAPI routing definitions with prefix mapping `/api/...`.
- **CORS Middleware**: Allows cross-origin requests, configured to support development environments.
- Mounts static files folder to serve the frontend SPA directly.

### Relational ORM & Engine (`database.py`)
- Employs **SQLAlchemy** to connect to `vendorbridge.db` SQLite engine.
- Implements dependency injection (`get_db`) to cleanly manage db session context lifecycles per HTTP request.

---

## 3. Cryptography & Security Layer (`security.py`)

- **Password Hashing**: Uses `passlib[bcrypt]` to securely hash and verify user passwords.
- **Access Tokens**: Employs `python-jose` to generate signed HS256 JWT tokens.
- **RBAC Checks**: The `RoleChecker` dependency validates roles (e.g. `RoleChecker(["Admin", "Manager"])`) prior to granting endpoint handler access.

---

## 4. Business Services

### Mock Mail Notifications (`services/email_mock.py`)
- Instead of using real SMTP credentials, emails are captured inside a memory list queue.
- Offers a `GET /api/reports/mock-emails` endpoint allowing administrators to audit outbound system messages in the frontend in real-time.

### PDF Document Generation (`services/pdf_generator.py`)
- Uses **ReportLab** to dynamically compile and stream PDF files:
  - **Invoices**: Renders subtotal, tax (GST 18.0%), grand totals, and terms.
  - **Purchase Orders**: Renders technical specifications and vendor GSTINs.
  - **Executive Reports**: Compiles category spend summaries and vendor ratings ledger.
- Standard Helvetica fonts are configured, using ASCII `Rs.` prefixes to support multi-platform rendering safely without unicode placeholder issues.
