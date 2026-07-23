"""
Loan Application API Routes.

Endpoints:
- POST /api/loan/send-otp - Send OTP to phone (stores form data temporarily)
- POST /api/loan/verify-otp - Verify OTP and submit application
- POST /api/loan/applications - Create a new loan application
- GET /api/loan/applications - List all applications
- GET /api/loan/applications/{id} - Get application by ID
"""

import json
import logging
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from database import get_db
from models import LoanApplication, OTPVerification
from sms_service import OTPService, generate_application_id

logger = logging.getLogger(__name__)

# Create router
loan_router = APIRouter(prefix="/api/loan", tags=["Loan Application"])


# ==================== Pydantic Schemas ====================

class SendOTPRequest(BaseModel):
    """Request schema for sending OTP with all form data."""
    # Personal Details
    country_code: str = Field(default="+91")
    phone: str = Field(..., min_length=10, max_length=10)
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not v.isdigit() or len(v) != 10:
            raise ValueError('Phone must be 10 digits')
        return v


class VerifyOTPRequest(BaseModel):
    """Request schema for verifying OTP."""
    phone: str = Field(..., min_length=10, max_length=10)
    country_code: str = Field(default="+91")
    otp: str = Field(..., min_length=6, max_length=6)


class SendOTPResponse(BaseModel):
    """Response schema for send OTP."""
    success: bool
    message: str
    expires_in_seconds: int = 300


class VerifyOTPResponse(BaseModel):
    """Response schema for verify OTP and submit application."""
    success: bool
    message: str


class LoanApplicationResponse(BaseModel):
    """Response schema for loan application details."""
    id: str
    application_id: str
    full_name: str
    phone: str
    created_at: str


class CreateLoanApplicationRequest(BaseModel):
    """Request schema for creating a new loan application."""
    full_name: str = Field(..., min_length=2, max_length=255)
    pan: str = Field(..., min_length=10, max_length=10)
    dob: date = Field(..., description="Date of birth in YYYY-MM-DD format")
    email: EmailStr
    gender: str = Field(..., pattern="^(Male|Female|Other)$")
    employment_type: str = Field(..., min_length=2, max_length=255)
    monthly_income: Decimal = Field(..., gt=0)
    address_line_1: str = Field(..., min_length=2, max_length=255)
    address_line_2: str = Field(default="", max_length=255)
    city: str = Field(..., min_length=2, max_length=255)
    state: str = Field(..., min_length=2, max_length=255)
    pin_code: str = Field(..., min_length=6, max_length=6)
    country_code: str = Field(default="+91")
    phone: str = Field(..., min_length=10, max_length=10)
    
    @field_validator('pan')
    @classmethod
    def validate_pan(cls, v):
        v = v.upper()
        if len(v) != 10:
            raise ValueError('PAN must be 10 characters')
        return v
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        if not v.isdigit() or len(v) != 10:
            raise ValueError('Phone must be 10 digits')
        return v
    
    @field_validator('pin_code')
    @classmethod
    def validate_pin_code(cls, v):
        if not v.isdigit() or len(v) != 6:
            raise ValueError('Pin code must be 6 digits')
        return v


class CreateLoanApplicationResponse(BaseModel):
    """Response schema for created loan application."""
    success: bool
    message: str
    application_id: str
    id: str


# ==================== API Endpoints ====================

@loan_router.post("/send-otp", response_model=SendOTPResponse)
async def send_otp(
    request: SendOTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Send OTP to phone number.
    Stores form data temporarily until OTP is verified.
    """
    try:
        # Generate OTP
        otp_code = OTPService.generate()
        expires_at = OTPService.get_expiry()
        
        # Check for existing unverified OTP for this phone
        stmt = select(OTPVerification).where(
            OTPVerification.phone == request.phone,
            OTPVerification.verified == False
        ).order_by(desc(OTPVerification.created_at))
        
        result = await db.execute(stmt)
        existing_otp = result.scalar_one_or_none()
        
        # Serialize form data
        form_data = request.model_dump_json()
        
        if existing_otp:
            # Update existing OTP
            existing_otp.otp_code = otp_code
            existing_otp.expires_at = expires_at
            existing_otp.attempts = 0
            existing_otp.form_data = form_data
            existing_otp.created_at = datetime.utcnow()
        else:
            # Create new OTP verification entry
            new_otp = OTPVerification(
                phone=request.phone,
                country_code=request.country_code,
                otp_code=otp_code,
                expires_at=expires_at
            )
            db.add(new_otp)
        
        await db.commit()
        
        # Send OTP via SMS
        success, message = await OTPService.send(
            request.phone, 
            request.country_code, 
            otp_code
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send OTP: {message}"
            )
        
        logger.info(f"OTP sent to {request.country_code}{request.phone}")
        
        return SendOTPResponse(
            success=True,
            message="OTP sent successfully to your phone",
            expires_in_seconds=300
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending OTP: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error sending OTP: {str(e)}"
        )


@loan_router.post("/verify-otp", response_model=VerifyOTPResponse)
async def verify_otp(
    request: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Verify OTP and submit loan application.
    On success, saves application and sends Application ID via SMS.
    """
    try:
        # Find OTP verification entry
        stmt = select(OTPVerification).where(
            OTPVerification.phone == request.phone,
            OTPVerification.verified == False
        ).order_by(desc(OTPVerification.created_at))
        
        result = await db.execute(stmt)
        otp_record = result.scalar_one_or_none()
        
        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No OTP request found. Please request a new OTP."
            )
        
        # Check if expired
        if otp_record.is_expired():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired. Please request a new OTP."
            )
        
        # Check attempts
        if otp_record.attempts >= OTPService.MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Maximum attempts exceeded. Please request a new OTP."
            )
        
        # Verify OTP
        if otp_record.otp_code != request.otp:
            otp_record.attempts += 1
            await db.commit()
            remaining = OTPService.MAX_ATTEMPTS - otp_record.attempts
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP. {remaining} attempts remaining."
            )
        
        # OTP is valid - mark as verified
        otp_record.verified = True
        
        return VerifyOTPResponse(
            success=True,
            message="OTP Verified Successfully!",
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying OTP: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verifying OTP: {str(e)}"
        )


@loan_router.post("/applications", response_model=CreateLoanApplicationResponse)
async def create_application(
    request: CreateLoanApplicationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new loan application directly.
    """
    try:
        # Generate unique application ID
        app_id = generate_application_id()
        
        # Create loan application
        loan_app = LoanApplication(
            application_id=app_id,
            full_name=request.full_name,
            pan=request.pan.upper(),
            dob=request.dob,
            email=request.email,
            gender=request.gender,
            employment_type=request.employment_type,
            monthly_income=request.monthly_income,
            address_line_1=request.address_line_1,
            address_line_2=request.address_line_2,
            city=request.city,
            state=request.state,
            pin_code=request.pin_code,
            country_code=request.country_code,
            phone=request.phone
        )
        
        db.add(loan_app)
        await db.commit()
        await db.refresh(loan_app)
        
        logger.info(f"Loan application created: {app_id}")
        
        return CreateLoanApplicationResponse(
            success=True,
            message="Loan application created successfully",
            application_id=app_id,
            id=str(loan_app.id)
        )
        
    except Exception as e:
        logger.error(f"Error creating application: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating application: {str(e)}"
        )


@loan_router.get("/applications", response_model=List[LoanApplicationResponse])
async def list_applications(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    List all loan applications with optional filtering.
    """
    try:
        stmt = select(LoanApplication).order_by(desc(LoanApplication.created_at))
        
        if status:
            stmt = stmt.where(LoanApplication.status == status)
        
        stmt = stmt.offset(skip).limit(limit)
        
        result = await db.execute(stmt)
        applications = result.scalars().all()
        
        return [
            LoanApplicationResponse(
                id=str(app.id),
                application_id=app.application_id,
                full_name=app.full_name,
                phone=app.phone,
                created_at=app.created_at.isoformat() if app.created_at else ""
            )
            for app in applications
        ]
        
    except Exception as e:
        logger.error(f"Error listing applications: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing applications: {str(e)}"
        )


@loan_router.get("/applications/{application_id}")
async def get_application(
    application_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get loan application by Application ID.
    """
    try:
        stmt = select(LoanApplication).where(
            LoanApplication.application_id == application_id
        )
        
        result = await db.execute(stmt)
        app = result.scalar_one_or_none()
        
        if not app:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Application {application_id} not found"
            )
        
        return app.to_dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting application {application_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting application: {str(e)}"
        )
