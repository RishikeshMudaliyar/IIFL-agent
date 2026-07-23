"""
SMS OTP Service for sending and verifying OTP codes.

Supported providers: mock, smslocal, twilio
"""

import os
import random
import string
import logging
import httpx
from datetime import datetime, timedelta
from typing import Tuple

logger = logging.getLogger(__name__)

# SMS Configuration
SMS_PROVIDER = os.getenv("SMS_PROVIDER", "")  # mock, smslocal, twilio

# SMSLocal Configuration - https://www.smslocal.com/
SMSLOCAL_API_KEY = os.getenv("SMSLOCAL_API_KEY", "")
SMSLOCAL_SENDER_ID = os.getenv("SMSLOCAL_SENDER_ID", "")

# Twilio Configuration - https://www.twilio.com/
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP."""
    return ''.join(random.choices(string.digits, k=length))


def generate_application_id() -> str:
    """Generate a unique loan application ID (LA-XXXXXXXXX)."""
    chars = ''.join(random.choices(string.ascii_uppercase + string.digits, k=9))
    return f"LA-{chars}"


async def send_twilio_sms(to_phone: str, message: str) -> Tuple[bool, str]:
    """Send SMS via Twilio API."""
    try:
        from twilio.rest import Client
        
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        
        msg = client.messages.create(
            body=message,
            from_=TWILIO_PHONE_NUMBER,
            to=to_phone
        )
        
        logger.info(f"Twilio SMS sent to {to_phone}, SID: {msg.sid}")
        return True, f"OTP sent successfully via Twilio (SID: {msg.sid})"
        
    except Exception as e:
        logger.error(f"Twilio error: {e}")
        return False, f"Failed to send OTP via Twilio: {str(e)}"


async def send_otp_sms(phone: str, country_code: str, otp: str) -> Tuple[bool, str]:
    """Send OTP via SMS."""
    full_phone = f"{country_code}{phone}"
    message = f"Your Loan Application OTP is: {otp}. Valid for 5 minutes."
    
    # ALWAYS Print OTP for debugging
    print(f"\n{'='*50}")
    print(f"📱 OTP LOG: Sending to {full_phone}")
    print(f"🔑 OTP: {otp}")
    print(f"{'='*50}\n")
    
    if SMS_PROVIDER == "mock":
        logger.info(f"[MOCK SMS] Sending OTP {otp} to {full_phone}")
        print(f"\n{'='*50}")
        print(f"📱 MOCK SMS to {full_phone}")
        print(f"📨 Your OTP is: {otp}")
        print(f"{'='*50}\n")
        return True, "OTP sent successfully (mock)"
    
    elif SMS_PROVIDER == "twilio":
        return await send_twilio_sms(full_phone, message)
    
    elif SMS_PROVIDER == "smslocal":
        try:
            import urllib.parse
            encoded_msg = urllib.parse.quote(message)
            # URL provided by user: https://app.smslocal.in/api/smsapi
            # Using route=2 (OTP) based on API docs screenshot
            url = f'https://app.smslocal.in/api/smsapi?key={SMSLOCAL_API_KEY}&route=2&sender={SMSLOCAL_SENDER_ID}&number={phone}&sms={encoded_msg}'
            
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                response = await client.get(url)
                
                # Check for success in response or status code
                # SMSLocal often returns plain text "SMS SENT ..." or JSON
                if response.status_code == 200:
                    logger.info(f"SMSLocal sent to {phone}: {response.text}")
                    return True, "OTP sent successfully"
                else:
                    logger.error(f"SMSLocal error: {response.text}")
                    return False, f"Failed to send OTP: {response.text}"
                    
        except Exception as e:
            logger.error(f"SMSLocal error: {e}")
            return False, f"Failed to send OTP: {str(e)}"
    
    else:
        logger.warning(f"Unknown SMS provider: {SMS_PROVIDER}")
        return False, "SMS provider not configured"


async def send_application_id_sms(phone: str, country_code: str, application_id: str) -> Tuple[bool, str]:
    """Send Application ID via SMS after successful submission."""
    full_phone = f"{country_code}{phone}"
    message_text = f"Congratulations! Your Loan Application submitted successfully. Application ID: {application_id}. Save for reference."
    
    if SMS_PROVIDER == "mock":
        logger.info(f"[MOCK SMS] Sending Application ID {application_id} to {full_phone}")
        print(f"\n{'='*50}")
        print(f"📱 MOCK SMS to {full_phone}")
        print(f"✅ Application ID: {application_id}")
        print(f"{'='*50}\n")
        return True, "Application ID sent successfully (mock)"
    
    elif SMS_PROVIDER == "twilio":
        return await send_twilio_sms(full_phone, message_text)
    
    elif SMS_PROVIDER == "smslocal":
        try:
            import urllib.parse
            encoded_msg = urllib.parse.quote(message_text)
            # Trying route=3 for confirmation messages
            url = f'https://app.smslocal.in/api/smsapi?key={SMSLOCAL_API_KEY}&route=3&sender={SMSLOCAL_SENDER_ID}&number={phone}&sms={encoded_msg}'
            
            async with httpx.AsyncClient(verify=False, timeout=30.0) as client:
                response = await client.get(url)
                
                if response.status_code == 200:
                    logger.info(f"SMSLocal sent confirmation to {phone}: {response.text}")
                    return True, "Application ID sent successfully"
                else:
                    return False, f"Failed to send: {response.text}"
                    
        except Exception as e:
            logger.error(f"SMSLocal error: {e}")
            return False, f"Failed to send Application ID: {str(e)}"
    
    return False, "SMS provider not configured"


class OTPService:
    """OTP Service for managing OTP generation and verification."""
    
    OTP_EXPIRY_MINUTES = 5
    MAX_ATTEMPTS = 3
    
    @staticmethod
    def generate() -> str:
        return generate_otp(6)
    
    @staticmethod
    def get_expiry() -> datetime:
        return datetime.utcnow() + timedelta(minutes=OTPService.OTP_EXPIRY_MINUTES)
    
    @staticmethod
    async def send(phone: str, country_code: str, otp: str) -> Tuple[bool, str]:
        return await send_otp_sms(phone, country_code, otp)
    
    @staticmethod
    async def send_confirmation(phone: str, country_code: str, application_id: str) -> Tuple[bool, str]:
        return await send_application_id_sms(phone, country_code, application_id)

