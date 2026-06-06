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

# Mount the static files last to serve frontend SPA at root
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
