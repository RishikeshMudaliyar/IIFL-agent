"""
SQLAlchemy models for Loan Application system.
"""

import uuid
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Date, Boolean, Integer, Numeric, Text, DateTime, Index
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class LoanApplication(Base):
    """
    Loan Application model storing all form fields.
    """
    __tablename__ = "loan_applications_abcd"
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Generated application ID (e.g., LA-XXXXXXXXX)
    application_id = Column(String(20), unique=True, nullable=False, index=True)
    
    # Personal Details
    full_name = Column(String(255), nullable=False)
    pan = Column(String(10), nullable=False)
    dob = Column(Date, nullable=False)
    email = Column(String(255), nullable=False)
    gender = Column(String(10), nullable=False)
    employment_type = Column(String(255), nullable=False)
    monthly_income = Column(Numeric(12, 2), nullable=False)
    address_line_1 = Column(String(255), nullable=False)
    address_line_2 = Column(String(255), nullable=False)
    city = Column(String(255), nullable=False)
    state = Column(String(255), nullable=False)
    pin_code = Column(String(6), nullable=False)
    country_code = Column(String(10), nullable=False, default="+91")
    phone = Column(String(15), nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('idx_abcd_application_id', 'application_id'),
    )
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            "id": str(self.id),
            "application_id": self.application_id,
            "full_name": self.full_name,
            "pan": self.pan,
            "dob": str(self.dob) if self.dob else None,
            "phone": self.phone,
            "email": self.email,
            "gender": self.gender,
            "employment_type": self.employment_type,
            "monthly_income": float(self.monthly_income) if self.monthly_income else None,
            "address_line_1": self.address_line_1,
            "address_line_2": self.address_line_2,
            "city": self.city,
            "state": self.state,
            "pin_code": self.pin_code,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class OTPVerification(Base):
    """
    OTP Verification model for SMS OTP tracking.
    """
    __tablename__ = "otp_verifications_abcd"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone = Column(String(15), nullable=False, index=True)
    country_code = Column(String(10), nullable=False, default="+91")
    otp_code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    verified = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    @classmethod
    def generate_expiry(cls, minutes: int = 5):
        """Generate expiry time for OTP."""
        return datetime.utcnow() + timedelta(minutes=minutes)
    
    def is_expired(self):
        """Check if OTP is expired."""
        return datetime.utcnow() > self.expires_at
    
    def to_dict(self):
        """Convert model to dictionary."""
        return {
            "id": str(self.id),
            "phone": self.phone,
            "country_code": self.country_code,
            "verified": self.verified,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
