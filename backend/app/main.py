import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from backend.app.database import engine, Base
# Import all routers
from backend.app.routers import auth, vendors, rfqs, quotations, approvals, pos, invoices, reports

# Create all database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="VendorBridge ERP API",
    description="Procurement & Vendor Management ERP Backend",
    version="1.0.0"
)

# Enable CORS for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root redirect or API check
@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "VendorBridge ERP API"}

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(vendors.router, prefix="/api")
app.include_router(rfqs.router, prefix="/api")
app.include_router(quotations.router, prefix="/api")
app.include_router(approvals.router, prefix="/api")
app.include_router(pos.router, prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(reports.router, prefix="/api")

# Verify frontend directory exists, if not, create it
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend")
if not os.path.exists(frontend_dir):
    os.makedirs(frontend_dir)

from fastapi.responses import FileResponse, RedirectResponse

@app.get("/")
def index_redirect():
    return RedirectResponse(url="/login")

@app.get("/login", response_class=FileResponse)
def login_page():
    return os.path.join(frontend_dir, "pages", "login.html")

@app.get("/signup", response_class=FileResponse)
def signup_page():
    return os.path.join(frontend_dir, "pages", "signup.html")

@app.get("/forgot-password", response_class=FileResponse)
def forgot_password_page():
    return os.path.join(frontend_dir, "pages", "forgot-password.html")

@app.get("/reset-password", response_class=FileResponse)
def reset_password_page():
    return os.path.join(frontend_dir, "pages", "reset-password.html")

@app.get("/dashboard", response_class=FileResponse)
def dashboard_page():
    return os.path.join(frontend_dir, "pages", "dashboard.html")

@app.get("/vendors", response_class=FileResponse)
@app.get("/vendors/{path:path}", response_class=FileResponse)
def vendors_page():
    return os.path.join(frontend_dir, "pages", "vendors.html")

@app.get("/rfqs", response_class=FileResponse)
@app.get("/rfqs/{path:path}", response_class=FileResponse)
def rfqs_page():
    return os.path.join(frontend_dir, "pages", "rfqs.html")

@app.get("/quotations", response_class=FileResponse)
@app.get("/quotations/{path:path}", response_class=FileResponse)
def quotations_page():
    return os.path.join(frontend_dir, "pages", "quotations.html")

@app.get("/comparison", response_class=FileResponse)
@app.get("/comparison/{path:path}", response_class=FileResponse)
def comparison_page():
    return os.path.join(frontend_dir, "pages", "comparison.html")

@app.get("/approvals", response_class=FileResponse)
@app.get("/approvals/{path:path}", response_class=FileResponse)
def approvals_page():
    return os.path.join(frontend_dir, "pages", "approvals.html")

@app.get("/purchase-orders", response_class=FileResponse)
@app.get("/purchase-orders/{path:path}", response_class=FileResponse)
def pos_page():
    return os.path.join(frontend_dir, "pages", "purchase-orders.html")

@app.get("/invoices", response_class=FileResponse)
@app.get("/invoices/{path:path}", response_class=FileResponse)
def invoices_page():
    return os.path.join(frontend_dir, "pages", "invoices.html")

@app.get("/reports", response_class=FileResponse)
@app.get("/reports/{path:path}", response_class=FileResponse)
def reports_page():
    return os.path.join(frontend_dir, "pages", "reports.html")

@app.get("/activity-logs", response_class=FileResponse)
@app.get("/activity-logs/{path:path}", response_class=FileResponse)
def activity_logs_page():
    return os.path.join(frontend_dir, "pages", "activity-logs.html")

@app.get("/settings", response_class=FileResponse)
@app.get("/settings/{path:path}", response_class=FileResponse)
def settings_page():
    return os.path.join(frontend_dir, "pages", "settings.html")

@app.get("/profile", response_class=FileResponse)
@app.get("/profile/{path:path}", response_class=FileResponse)
def profile_page():
    return os.path.join(frontend_dir, "pages", "profile.html")

# Mount the static files last to serve frontend SPA at root
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
