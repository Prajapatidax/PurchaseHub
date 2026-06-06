from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import datetime

from backend.app.database import get_db
from backend.app import models, schemas, security
from backend.app.services.email_mock import send_email

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login-form")

# Dependency to get current user
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = security.decode_access_token(token)
    if payload is None:
        raise credentials_exception
    email: str = payload.get("email")
    if email is None:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# Helper dependency to enforce roles
class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, user: models.User = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: role '{user.role}' does not have sufficient permissions."
            )
        return user

# Endpoint for standard OAuth2 login form (needed for Swagger UI compatibility)
@router.post("/login-form", response_model=schemas.Token)
def login_form(
    username: str = Depends(lambda: None), # Workaround for Swagger form parsing
    db: Session = Depends(get_db)
):
    # This is dummy for Swagger UI. Real login is below.
    raise HTTPException(status_code=400, detail="Use JSON login endpoint /api/auth/login")

@router.post("/login", response_model=schemas.Token)
def login(login_req: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_req.email).first()
    if not user or not security.verify_password(login_req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check token expiry extension for remember me
    expires = None
    if login_req.remember_me:
        expires = datetime.timedelta(days=30)
        
    access_token = security.create_access_token(
        data={"email": user.email, "role": user.role, "user_id": user.id},
        expires_delta=expires
    )
    
    # Log activity
    log = models.ActivityLog(user_id=user.id, action=f"User {user.name} ({user.role}) logged in successfully.")
    db.add(log)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_name": user.name,
        "user_id": user.id
    }

@router.post("/signup", response_model=schemas.UserResponse)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered.")
    
    # Hash password
    hashed_pwd = security.hash_password(user_in.password)
    
    # Create user
    new_user = models.User(
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_pwd,
        role=user_in.role
    )
    db.add(new_user)
    db.flush() # Populate new_user.id
    
    # If the role is Vendor, also register the vendor company
    if user_in.role == "Vendor":
        if not user_in.company_name:
            raise HTTPException(
                status_code=400, 
                detail="Company Name is required when signing up as a Vendor."
            )
        
        # Check if company already registered
        existing_vendor = db.query(models.Vendor).filter(models.Vendor.company_name == user_in.company_name).first()
        if existing_vendor:
            # Connect user to existing vendor or fail? Let's associate or create a new one.
            pass
            
        new_vendor = models.Vendor(
            company_name=user_in.company_name,
            gst_number="GST-" + str(int(datetime.datetime.utcnow().timestamp()))[-6:], # Auto-generated mock GST
            category="General Procurement",
            email=user_in.email,
            phone="+1 (555) 019-2834",
            address="Vendor Registered Headquarters",
            rating=5.0,
            status="Active"
        )
        db.add(new_vendor)
        db.flush()
        
        # Send welcome email
        send_email(
            to_email=user_in.email,
            subject="Welcome to VendorBridge ERP Portal!",
            body=f"Hi {user_in.name},\n\nYour vendor profile for '{user_in.company_name}' has been successfully registered on VendorBridge.\n\nYou can now log in and bid on RFQs.\n\nBest regards,\nProcurement Team"
        )
        
    # Commit changes
    log = models.ActivityLog(user_id=new_user.id, action=f"Registered new user account: {new_user.name} ({new_user.role})")
    db.add(log)
    db.commit()
    db.refresh(new_user)
    
    return new_user

@router.post("/forgot-password")
def forgot_password(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required.")
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        reset_link = f"http://localhost:8000/reset-password?email={email}&token=mock_reset_token"
        send_email(
            to_email=email,
            subject="VendorBridge - Password Reset Request",
            body=f"Hi {user.name},\n\nWe received a request to reset your password. Click the link below to set a new password:\n\n{reset_link}\n\nIf you did not request this, please ignore this email.\n\nThanks,\nVendorBridge Team"
        )
        
    # Return success message regardless of existence (security best practice)
    return {"message": "If the email exists in our system, a password reset link has been sent."}

@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    if req.token != "mock_reset_token":
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
        
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    user.password_hash = security.hash_password(req.new_password)
    
    log = models.ActivityLog(user_id=user.id, action=f"Reset password for user {user.name} ({user.role}).")
    db.add(log)
    db.commit()
    
    return {"message": "Password has been reset successfully."}

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user
