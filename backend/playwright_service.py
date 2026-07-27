import asyncio
import uuid
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from playwright.async_api import async_playwright

# Global session registry
PLAYWRIGHT_SESSIONS: Dict[str, Dict[str, Any]] = {}

# Get logger (configuration is done by app.py)
logger = logging.getLogger(__name__)

# Field mapping: Gemini-friendly names → CSS selectors (using IDs)
# Form consists of 5 steps with different fields visible at each step

FIELD_SELECTORS = {
    # Step 1: Mobile Number Entry
    "mobile": "#mobile-input",
    "mobile_number": "#mobile-input",
    "phone": "#mobile-input",
    "phone_number": "#mobile-input",
    
    # Step 2: OTP Verification
    "otp": "#otp-input-hidden",
    "otp_code": "#otp-input-hidden",
    
    # Step 3: PAN & Consent
    "pan": "#pan-input",
    "pan_number": "#pan-input",
    "full_name": "#full-name-input",
    "fullName": "#full-name-input",
    "name": "#full-name-input",
    
    # Step 4: Additional Details
    "email": "#email-input",
    "email_address": "#email-input",
    "dob": "#dob-input",
    "date_of_birth": "#dob-input",
    "income": "#income-input",
    "monthly_income": "#income-input",
    "building": "#building-input",
    "house_no": "#building-input",
    "building_name": "#building-input",
    "road": "#road-input",
    "road_name": "#road-input",
    "area": "#road-input",
    "colony": "#road-input",
    "pincode": "#pincode-input",
    "pin_code": "#pincode-input",
    "city": "#city-input",

    # ---- IIFL per-loan-type "page 2" live-fill forms (must match frontend ids) ----
    # Gold (/gold-application)
    "gold_weight": "#gold-weight-input",
    "aadhaar": "#aadhaar-input",
    "aadhar": "#aadhaar-input",
    # Business (/business-application)
    "biz_years": "#biz-years-input",
    "business_years": "#biz-years-input",
    "biz_turnover": "#biz-turnover-input",
    "annual_turnover": "#biz-turnover-input",
    # Secured business (/secured-application)
    "collateral_value": "#collateral-value-input",
    # Shared across the 3 forms
    "loan_amount": "#loan-amount-input",
    "amount": "#loan-amount-input",
    # (pan already mapped above -> #pan-input; reused on all 3 forms)
}

# Checkbox field selectors
CHECKBOX_SELECTORS = {
    # Step 1
    "terms": "#terms-checkbox",
    "terms_checkbox": "#terms-checkbox",
    "terms_and_conditions": "#terms-checkbox",
    
    # Step 3
    "consent1": "#consent1-checkbox",
    "consent_1": "#consent1-checkbox",
    "credit_bureau_consent": "#consent1-checkbox",
    "consent2": "#consent2-checkbox",
    "consent_2": "#consent2-checkbox",
    "regulatory_consent": "#consent2-checkbox",
    "income_declaration": "#consent2-checkbox",

    # ---- IIFL per-loan-type "page 2" forms ----
    "consent": "#consent-checkbox",                 # T&C consent (all 3 forms)
    "existing_loan": "#existing-loan-checkbox",     # gold: existing gold loan
    "existing_gold_loan": "#existing-loan-checkbox",
    "gst": "#gst-checkbox",                          # business: GST registered
    "gst_registered": "#gst-checkbox",
    "existing_emi": "#existing-emi-checkbox",        # secured: existing EMI/loan
}

# Toggle button selectors (for gender and employment type)
TOGGLE_SELECTORS = {
    # Gender
    "gender": {
        "male": "#gender-male-btn",
        "female": "#gender-female-btn",
        "other": "#gender-other-btn",
    },
    # Employment Type
    "employment": {
        "salaried": "#employment-salaried-btn",
        "self-employed": "#employment-selfemployed-btn",
        "self_employed": "#employment-selfemployed-btn",
        "selfemployed": "#employment-selfemployed-btn",
    },
    "employment_type": {
        "salaried": "#employment-salaried-btn",
        "self-employed": "#employment-selfemployed-btn",
        "self_employed": "#employment-selfemployed-btn",
        "selfemployed": "#employment-selfemployed-btn",
    },

    # ---- IIFL per-loan-type "page 2" radio groups ----
    # Gold purity (karat) -> #gold-purity-{18|22|24}
    "gold_purity": {
        "18": "#gold-purity-18", "18k": "#gold-purity-18", "18_karat": "#gold-purity-18",
        "22": "#gold-purity-22", "22k": "#gold-purity-22", "22_karat": "#gold-purity-22",
        "24": "#gold-purity-24", "24k": "#gold-purity-24", "24_karat": "#gold-purity-24",
    },
    "purity": {
        "18": "#gold-purity-18", "22": "#gold-purity-22", "24": "#gold-purity-24",
    },
    # LTV scheme choice -> #scheme-{saver|balance|max}. The caller picks one of
    # the three LTV tiers after hearing them; the agent clicks their choice.
    # Aliases cover how the LLM is likely to phrase it: by id, by LTV percent,
    # by the "low/medium/high" shorthand the SOP uses, and by scheme name.
    "scheme": {
        "saver": "#scheme-saver", "swarna_saver": "#scheme-saver",
        "iifl_swarna_saver": "#scheme-saver",
        "55": "#scheme-saver", "55%": "#scheme-saver", "low": "#scheme-saver",
        "balance": "#scheme-balance", "swarna_balance": "#scheme-balance",
        "iifl_swarna_balance": "#scheme-balance",
        "65": "#scheme-balance", "65%": "#scheme-balance", "medium": "#scheme-balance",
        "mid": "#scheme-balance", "middle": "#scheme-balance",
        "max": "#scheme-max", "swarna_max": "#scheme-max",
        "iifl_swarna_max": "#scheme-max",
        "75": "#scheme-max", "75%": "#scheme-max", "high": "#scheme-max",
    },
    "ltv_scheme": {
        "saver": "#scheme-saver", "balance": "#scheme-balance", "max": "#scheme-max",
        "55": "#scheme-saver", "65": "#scheme-balance", "75": "#scheme-max",
        "low": "#scheme-saver", "medium": "#scheme-balance", "high": "#scheme-max",
    },
    "ltv": {
        "55": "#scheme-saver", "65": "#scheme-balance", "75": "#scheme-max",
        "saver": "#scheme-saver", "balance": "#scheme-balance", "max": "#scheme-max",
    },
    # Business type -> #biz-type-{retail|manufacturing|services}
    "biz_type": {
        "retail": "#biz-type-retail",
        "manufacturing": "#biz-type-manufacturing", "mfg": "#biz-type-manufacturing",
        "services": "#biz-type-services", "service": "#biz-type-services",
    },
    "business_type": {
        "retail": "#biz-type-retail",
        "manufacturing": "#biz-type-manufacturing",
        "services": "#biz-type-services",
    },
    # Collateral type -> #collateral-type-{property|machinery|other}
    "collateral_type": {
        "property": "#collateral-type-property",
        "machinery": "#collateral-type-machinery",
        "other": "#collateral-type-other",
    },
    "collateral": {
        "property": "#collateral-type-property",
        "machinery": "#collateral-type-machinery",
        "other": "#collateral-type-other",
    },
}

# Dropdown selectors
DROPDOWN_SELECTORS = {
    "state": "#state-input",
}

# Button selectors for each step CTA
BUTTON_SELECTORS = {
    # Step 1
    "apply_now": "#apply-now-btn",
    "apply": "#apply-now-btn",
    
    # Step 2
    "verify_continue": "#continue-otp-btn",
    "verify": "#continue-otp-btn",
    "verify_otp": "#continue-otp-btn",
    "continue_otp": "#continue-otp-btn",
    "resend_otp": "#resend-otp-btn",
    "edit_phone": "#edit-phone-btn",
    
    # Step 3
    "continue": "#continue-step3-btn",
    "continue_step3": "#continue-step3-btn",
    "edit_pan": "#edit-pan-btn",
    "edit_name": "#edit-name-btn",
    
    # Step 4
    "get_loan_offer": "#get-loan-offer-btn",
    "get_offer": "#get-loan-offer-btn",
    "submit": "#get-loan-offer-btn",
    "back_to_step3": "#back-to-step3-btn",
    
    # Step 5
    "back_to_step4": "#back-to-step4-btn",
    "connect_rm": "#connect-rm-btn",
    
    # LTV scheme choice on the gold form. The caller picks one of three; the
    # agent clicks it. Aliases cover how the DSL and the LLM phrase it —
    # "scheme_saver" (the DSL's templated form), bare "saver", and the LTV number.
    "scheme_saver": "#scheme-saver",
    "scheme_balance": "#scheme-balance",
    "scheme_max": "#scheme-max",
    "saver": "#scheme-saver",
    "balance": "#scheme-balance",
    "max": "#scheme-max",
    "swarna_saver": "#scheme-saver",
    "swarna_balance": "#scheme-balance",
    "swarna_max": "#scheme-max",
    "scheme_55": "#scheme-saver",
    "scheme_65": "#scheme-balance",
    "scheme_75": "#scheme-max",
    "scheme_low": "#scheme-saver",
    "scheme_medium": "#scheme-balance",
    "scheme_high": "#scheme-max",

    # Branch hero (page 1) -> application form. The hero is what start_session
    # now opens; the agent clicks this once the caller agrees to apply.
    "start_application": "#start-application-btn",
    "start_apply": "#start-application-btn",
    "apply_now_hero": "#start-application-btn",
    "proceed": "#start-application-btn",
    "continue_to_form": "#start-application-btn",

    # Misc
    "view_rates": "#view-rates-btn",
}

# Error selectors organized by step
ERROR_SELECTORS = {
    "step_1": {
        "phone_error": "#phone-error",
        "apply_now_error": "#api-error-step1",
    },
    "step_2": {
        "otp_error": "#otp-error",
    },
    "step_3": {
        "pan_error": "#pan-error",
        "fullname_error": "#fullname-error",
    },
    "step_4": {
        "email_error": "#email-error",
        "dob_error": "#dob-error",
        "income_error": "#income-error",
        "building_error": "#building-error",
        "road_error": "#road-error",
        "pincode_error": "#pincode-error",
        "city_error": "#city-error",
        "state_error": "#state-error",
        "get_loan_offer_error": "#api-error-step4",
    },
    "step_5": {
        "service_error": "#service-error",
    },
}

# Field-to-error selector mapping: Maps field names to their corresponding error selectors
# Used for real-time validation after filling a field
FIELD_ERROR_SELECTORS = {
    # Step 1: Mobile Number Entry
    "mobile": "#phone-error",
    "mobile_number": "#phone-error",
    "phone": "#phone-error",
    "phone_number": "#phone-error",
    
    # Step 2: OTP Verification
    "otp": "#otp-error",
    "otp_code": "#otp-error",
    
    # Step 3: PAN & Consent
    "pan": "#pan-error",
    "pan_number": "#pan-error",
    "full_name": "#fullname-error",
    "fullName": "#fullname-error",
    "name": "#fullname-error",
    
    # Step 4: Additional Details
    "email": "#email-error",
    "email_address": "#email-error",
    "dob": "#dob-error",
    "date_of_birth": "#dob-error",
    "income": "#income-error",
    "monthly_income": "#income-error",
    "building": "#building-error",
    "house_no": "#building-error",
    "building_name": "#building-error",
    "road": "#road-error",
    "road_name": "#road-error",
    "area": "#road-error",
    "colony": "#road-error",
    "pincode": "#pincode-error",
    "pin_code": "#pincode-error",
    "city": "#city-error",
    "state": "#state-error",
}

# Step identifiers - used to check which step is currently visible
STEP_IDENTIFIERS = {
    1: "#apply-now-btn",           # Step 1 has Apply Now button
    2: "#continue-otp-btn",        # Step 2 has Verify & Continue button
    3: "#continue-step3-btn",      # Step 3 has Continue button
    4: "#get-loan-offer-btn",      # Step 4 has Get Loan Offer button
    5: "#back-to-step4-btn",       # Step 5 has Back to Step 4 button (or offer cards)
}


class PlaywrightService:
    def __init__(self):
        self.playwright_instance = None

    async def _ensure_playwright(self):
        if not self.playwright_instance:
            self.playwright_instance = await async_playwright().start()

    async def start_session(self, url: str, session_id: str) -> Dict[str, Any]:
        """
        Launch browser, open URL, store session, and return session details.

        Caps the number of concurrent sessions; evicts the oldest one when full
        so the container doesn't accumulate leaked Chromium processes.
        """
        extra = {'session_id': session_id}

        logger.info(f"Starting session for URL: {url}", extra=extra)

        # EVERY DEMO STARTS FRESH.
        #
        # noVNC shows the whole X display, not one browser window. So any browser
        # left over from a previous demo stays visible until the new page paints —
        # the audience saw the PREVIOUS run's last screen (an offers page) sitting
        # there, then watched it flip. That looked broken, and it leaked one
        # caller's data into the next demo.
        #
        # A cap of 2 was the cause: the old session was only evicted once a THIRD
        # started. There is exactly one screen and one demo at a time, so tear down
        # every existing session before opening a new one. This also reclaims the
        # Chromium processes, which is why the cap existed in the first place.
        stale = [sid for sid in PLAYWRIGHT_SESSIONS if sid != session_id]
        if stale:
            logger.info(
                "Fresh start: destroying %d leftover session(s) before opening the new one: %s",
                len(stale), stale, extra=extra,
            )
            for sid in stale:
                try:
                    await self.destroy_session(sid)
                except Exception as e:
                    # Never let a stuck old browser block a new demo from starting.
                    logger.error("Could not destroy stale session %s: %s", sid, e, extra=extra)
                    PLAYWRIGHT_SESSIONS.pop(sid, None)

        # Re-starting an id that already exists (a retried start_session) must also
        # be a clean slate rather than a second browser for the same id.
        if session_id in PLAYWRIGHT_SESSIONS:
            logger.info("Re-starting existing session id; destroying the old browser first", extra=extra)
            try:
                await self.destroy_session(session_id)
            except Exception as e:
                logger.error("Could not destroy previous session: %s", e, extra=extra)
                PLAYWRIGHT_SESSIONS.pop(session_id, None)

        await self._ensure_playwright()

        # Launch browser (headed for VNC visibility) with memory-saving flags
        browser = await self.playwright_instance.chromium.launch(
            headless=False,
            slow_mo=0,
            args=[
                "--start-maximized",
                "--window-size=1920,1080",
                "--disable-gpu",
                "--disable-software-rasterizer",
                "--disable-dev-shm-usage",
                "--no-sandbox",
                "--no-zygote",
                "--single-process",
                "--disable-setuid-sandbox",
                "--disable-accelerated-2d-canvas",
                "--disable-gl-drawing-for-tests",
            ],
            timeout=60000
        )
        # Use no_viewport so it takes the full window size
        context = await browser.new_context(no_viewport=True)
        page = await context.new_page()

        # domcontentloaded returns when HTML is parsed; networkidle is best-effort
        await page.goto(url, timeout=60000, wait_until="domcontentloaded")
        try:
            await page.wait_for_load_state("networkidle", timeout=15000)
        except Exception as e:
            logger.warning(f"networkidle wait skipped: {e}", extra=extra)
        
        # Force the browser window to maximize via CDP
        try:
            cdp_session = await context.new_cdp_session(page)
            # Get current window ID
            window_info = await cdp_session.send("Browser.getWindowForTarget")
            window_id = window_info.get("windowId")
            if window_id:
                # Set window state to maximized
                await cdp_session.send("Browser.setWindowBounds", {
                    "windowId": window_id,
                    "bounds": {"windowState": "maximized"}
                })
                logger.info("Browser window maximized via CDP", extra=extra)
        except Exception as e:
            logger.warning(f"Could not maximize via CDP: {e}", extra=extra)
        
        # Store session details
        now = datetime.now()
        PLAYWRIGHT_SESSIONS[session_id] = {
            "browser": browser,
            "context": context,
            "page": page,
            "created_at": now,
            "last_activity_at": now,
            "status": "active"
        }
        
        logger.info("Session started successfully", extra=extra)
        
        return {
            "success": True,
            "session_id": session_id,
            "message": "Browser session started successfully. Form is now open at Step 1."
        }

    async def _get_visible_locator(self, page, selector: str):
        """
        Get a locator for the visible element matching the selector.
        
        This handles responsive layouts where elements may be duplicated
        (e.g., mobile and desktop views rendered simultaneously).
        Returns the first visible element's locator.
        """
        locator = page.locator(selector)
        count = await locator.count()
        
        if count == 0:
            return None
        
        if count == 1:
            return locator
        
        # Multiple elements found - find the visible one
        for i in range(count):
            element = locator.nth(i)
            try:
                if await element.is_visible(timeout=300):
                    return element
            except:
                continue
        
        # Fallback to first element if none explicitly visible
        return locator.first

    async def _get_current_step(self, page) -> int:
        """
        Determine which step of the form is currently visible.
        """
        # Check in reverse order (step 5 to step 1) as later steps override earlier ones
        for step in [5, 4, 3, 2, 1]:
            selector = STEP_IDENTIFIERS[step]
            try:
                visible_el = await self._get_visible_locator(page, selector)
                if visible_el and await visible_el.is_visible(timeout=500):
                    return step
            except:
                continue
        return 1  # Default to step 1

    async def _get_visible_errors(self, page, step: int) -> list:
        """
        Get all visible error messages for a specific step.
        
        Args:
            page: The Playwright page object
            step: The step number (1-5) to check errors for
            
        Returns:
            List of error dictionaries with 'field' and 'message' keys
        """
        errors = []
        step_key = f"step_{step}"
        step_errors = ERROR_SELECTORS.get(step_key, {})
        
        for error_name, selector in step_errors.items():
            try:
                error_el = await self._get_visible_locator(page, selector)
                if error_el and await error_el.is_visible(timeout=300):
                    error_text = await error_el.text_content()
                    if error_text and error_text.strip():
                        errors.append({"field": error_name, "message": error_text.strip()})
            except:
                continue
        return errors

    async def _check_step_transition(self, page, expected_next_step: int) -> Dict[str, Any]:
        """
        Check if the form has transitioned to the expected next step.
        Polls every 0.5s up to a timeout rather than sleeping a fixed duration.
        """
        # Step 5 waits for a loan API call; other transitions are fast UI changes
        timeout = 25.0 if expected_next_step == 5 else 8.0
        poll_interval = 0.5
        elapsed = 0.0

        while elapsed < timeout:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
            current_step = await self._get_current_step(page)
            if current_step == expected_next_step:
                return {"success": True, "current_step": current_step}

        current_step = await self._get_current_step(page)
        if current_step == expected_next_step:
            return {"success": True, "current_step": current_step}

        # If we didn't transition, check for errors on the current step
        errors = await self._get_visible_errors(page, current_step)
        if errors:
            error_messages = "; ".join([f"{e['field']}: {e['message']}" for e in errors])
            return {"success": False, "current_step": current_step, "errors": errors, "error_message": error_messages}

        return {"success": False, "current_step": current_step, "error_message": "Form did not advance to next step"}

    async def _read_loan_offers(self, page) -> list:
        """
        Read all loan offers displayed on Step 5 (Offer Results page).
        Returns list of offer objects.
        """
        offers = []
        
        if page is None:
            logger.error("_read_loan_offers called with None page")
            return []
        
        # Wait for offers to load
        await asyncio.sleep(2)
        
        # Check for service error first (using helper to handle duplicate elements)
        try:
            service_error_el = await self._get_visible_locator(page, "#service-error")
            if service_error_el and await service_error_el.is_visible(timeout=1000):
                error_text = await service_error_el.text_content()
                return [{"error": True, "message": error_text.strip() if error_text else "Lender service is temporarily unavailable"}]
        except:
            pass
        
        # Find all offer cards - check if offers list container exists first (using helper)
        try:
            offers_list_el = await self._get_visible_locator(page, "#loan-offers-list")
            if not offers_list_el or not await offers_list_el.is_visible(timeout=2000):
                logger.warning("Loan offers list container (#loan-offers-list) not visible")
                return []
        except Exception as e:
            logger.warning(f"Could not find loan offers list: {e}")
            return []
        
        # Find all offer cards using helper to handle duplicate elements
        index = 0
        while True:
            card_selector = f"#offer-card-{index}"
            try:
                # Use helper to find visible card (handles mobile/desktop duplicate views)
                card = await self._get_visible_locator(page, card_selector)
                if not card or not await card.is_visible(timeout=500):
                    break
                
                # Extract offer details from the card
                offer = {
                    "index": index,
                    "lender": "",
                    "loan_amount": "",
                    "monthly_emi": "",
                    "tenure": "",
                    "apr": ""
                }
                
                # Try to extract text content from the card
                try:
                    card_text = await card.text_content()
                    offer["raw_text"] = card_text
                    
                    # Based on the Step5 component structure:
                    # - Lender name: span.font-semibold.text-gray-800 (next to LenderLogo)
                    # - Loan amount: p.font-bold.text-xl.text-gray-900
                    # - Details are in a grid with labels and values
                    
                    # Get lender name - it's the span with font-semibold inside the header div
                    try:
                        lender_el = card.locator("span.font-semibold").first
                        if await lender_el.is_visible(timeout=300):
                            offer["lender"] = (await lender_el.text_content()).strip()
                    except:
                        pass
                    
                    # Get loan amount - it's the bold text in the right side of header
                    try:
                        amount_el = card.locator("p.font-bold.text-xl, .text-xl.font-bold").first
                        if await amount_el.is_visible(timeout=300):
                            offer["loan_amount"] = (await amount_el.text_content()).strip()
                    except:
                        pass
                    
                    # Get the details from the grid (EMI, Tenure, APR)
                    # The grid has 3 columns, each with a label (text-xs) and value (font-semibold)
                    try:
                        grid_items = card.locator(".grid > div")
                        grid_count = await grid_items.count()
                        
                        for i in range(grid_count):
                            grid_item = grid_items.nth(i)
                            try:
                                label_el = grid_item.locator("p.text-xs, p.text-gray-500").first
                                value_el = grid_item.locator("p.font-semibold").first
                                
                                if await label_el.is_visible(timeout=200) and await value_el.is_visible(timeout=200):
                                    label = (await label_el.text_content()).strip().lower()
                                    value = (await value_el.text_content()).strip()
                                    
                                    if "emi" in label:
                                        offer["monthly_emi"] = value
                                    elif "tenure" in label:
                                        offer["tenure"] = value
                                    elif "apr" in label:
                                        offer["apr"] = value
                            except:
                                continue
                    except Exception as grid_error:
                        logger.debug(f"Could not parse grid for offer {index}: {grid_error}")
                    
                except Exception as parse_error:
                    logger.warning(f"Could not parse offer card {index} details: {parse_error}")
                    # If structured parsing fails, at least we have raw_text
                    pass
                
                offers.append(offer)
                index += 1
                
            except Exception as e:
                logger.debug(f"No more offer cards found after index {index}: {e}")
                break
        
        logger.info(f"Found {len(offers)} loan offers")
        return offers

    async def fill_field(self, session_id: str, field_name: str, value: str) -> Dict[str, Any]:
        """
        Fill a form field. Supports input fields, checkboxes, toggle buttons, and dropdowns.
        
        Args:
            session_id: The active session ID
            field_name: Gemini-friendly field name (e.g., "mobile", "pan", "gender", "state")
            value: The value to fill
            
        Returns:
            Dict with success status and message
        """
        extra = {'session_id': session_id}
        
        if session_id not in PLAYWRIGHT_SESSIONS:
            logger.error("Invalid session_id", extra=extra)
            return {
                "success": False,
                "field": field_name,
                "error": f"Session {session_id} not found. Please start a new browser session."
            }
        
        # Normalize field name to lowercase for lookup
        field_key = field_name.lower().replace(" ", "_")
        
        session = PLAYWRIGHT_SESSIONS[session_id]
        session["last_activity_at"] = datetime.now()
        page = session["page"]

        logger.info(f"Filling field '{field_name}' with value: '{value}'", extra=extra)
        
        try:
            # Check if it's a checkbox field
            if field_key in CHECKBOX_SELECTORS or field_name in CHECKBOX_SELECTORS:
                selector = CHECKBOX_SELECTORS.get(field_key) or CHECKBOX_SELECTORS.get(field_name)
                
                # Determine if we should check or uncheck
                should_check = value.lower() in ["true", "yes", "1", "checked", "check"]
                
                # Get the visible checkbox element (handles duplicate elements from responsive layout)
                checkbox = await self._get_visible_locator(page, selector)
                if not checkbox:
                    return {
                        "success": False,
                        "field": field_name,
                        "error": f"Checkbox '{field_name}' not found"
                    }
                
                # Get current state
                is_checked = await checkbox.is_checked()
                
                if should_check and not is_checked:
                    await checkbox.check()
                    logger.info(f"Checkbox '{field_name}' checked", extra=extra)
                elif not should_check and is_checked:
                    await checkbox.uncheck()
                    logger.info(f"Checkbox '{field_name}' unchecked", extra=extra)
                else:
                    logger.info(f"Checkbox '{field_name}' already in desired state", extra=extra)
                
                return {
                    "success": True,
                    "field": field_name,
                    "value": str(should_check),
                    "message": f"Checkbox {field_name} {'checked' if should_check else 'unchecked'}"
                }
            
            # Check if it's a toggle button field (gender, employment type)
            if field_key in TOGGLE_SELECTORS or field_name.lower() in TOGGLE_SELECTORS:
                toggle_group = TOGGLE_SELECTORS.get(field_key) or TOGGLE_SELECTORS.get(field_name.lower())
                value_lower = value.lower().replace(" ", "_").replace("-", "_")
                
                # Normalize common values
                value_mapping = {
                    "m": "male",
                    "f": "female",
                    "o": "other",
                    "self employed": "self_employed",
                    "self-employed": "self_employed",
                    "selfemployed": "self_employed",
                }
                normalized_value = value_mapping.get(value_lower, value_lower)
                
                if normalized_value in toggle_group:
                    selector = toggle_group[normalized_value]
                    # Get the visible toggle button (handles duplicate elements from responsive layout)
                    toggle_btn = await self._get_visible_locator(page, selector)
                    if not toggle_btn:
                        return {
                            "success": False,
                            "field": field_name,
                            "error": f"Toggle button for '{value}' not found"
                        }
                    await toggle_btn.click()
                    logger.info(f"Clicked toggle button '{field_name}' = '{value}'", extra=extra)
                    return {
                        "success": True,
                        "field": field_name,
                        "value": value,
                        "message": f"Selected {value} for {field_name}"
                    }
                else:
                    available = list(toggle_group.keys())
                    return {
                        "success": False,
                        "field": field_name,
                        "error": f"Invalid value '{value}' for {field_name}. Available options: {available}"
                    }
            
            # Check if it's a dropdown field (state)
            if field_key in DROPDOWN_SELECTORS or field_name.lower() in ["state"]:
                dropdown_selector = DROPDOWN_SELECTORS.get(field_key, "#state-input")
                
                # Get the visible dropdown (handles duplicate elements from responsive layout)
                dropdown = await self._get_visible_locator(page, dropdown_selector)
                if not dropdown:
                    return {
                        "success": False,
                        "field": field_name,
                        "error": f"Dropdown for '{field_name}' not found"
                    }
                
                # Click the dropdown to open it
                await dropdown.click()
                await asyncio.sleep(0.3)
                
                # Normalize state name for selector (e.g., "Delhi" -> "delhi", "Tamil Nadu" -> "tamil-nadu")
                state_normalized = value.lower().replace(" ", "-").replace("_", "-")
                option_selector = f"#state-option-{state_normalized}"
                
                try:
                    # Get the visible option (handles duplicate elements)
                    option = await self._get_visible_locator(page, option_selector)
                    if option:
                        await option.click(timeout=3000)
                    else:
                        await page.click(option_selector, timeout=3000)
                    logger.info(f"Selected state '{value}'", extra=extra)
                    return {
                        "success": True,
                        "field": field_name,
                        "value": value,
                        "message": f"Selected {value} for state"
                    }
                except Exception as e:
                    # Try clicking by text if ID selector fails
                    try:
                        await page.click(f"text='{value}'", timeout=2000)
                        return {
                            "success": True,
                            "field": field_name,
                            "value": value,
                            "message": f"Selected {value} for state"
                        }
                    except:
                        logger.error(f"Could not find state option '{value}': {e}", extra=extra)
                        return {
                            "success": False,
                            "field": field_name,
                            "error": f"Could not find state option '{value}'. Please check the state name."
                        }
            
            # Regular input field
            selector = FIELD_SELECTORS.get(field_key) or FIELD_SELECTORS.get(field_name)
            
            if not selector:
                # Try direct selector if not in mapping
                if field_name.startswith(("input#", "#", "input[")):
                    selector = field_name
                else:
                    all_fields = list(FIELD_SELECTORS.keys()) + list(CHECKBOX_SELECTORS.keys()) + list(TOGGLE_SELECTORS.keys()) + list(DROPDOWN_SELECTORS.keys())
                    logger.warning(f"Unknown field: {field_name}", extra=extra)
                    return {
                        "success": False,
                        "field": field_name,
                        "error": f"Unknown field '{field_name}'. Available fields include: mobile, otp, pan, full_name, email, dob, gender, employment, income, building, road, pincode, city, state, terms, consent1, consent2"
                    }
            
            # Handle special case for DOB - may need date formatting
            if field_key in ["dob", "date_of_birth"]:
                # Normalize date format if needed
                try:
                    date_str = value.strip()
                    date_obj = None
                    for fmt in ['%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%Y/%m/%d', '%d-%m-%y', '%m/%d/%Y']:
                        try:
                            date_obj = datetime.strptime(date_str, fmt)
                            if date_obj.year < 100:
                                date_obj = date_obj.replace(year=date_obj.year + 2000)
                            break
                        except ValueError:
                            continue
                    
                    if date_obj:
                        # Format as YYYY-MM-DD for input[type="date"]
                        value = date_obj.strftime('%Y-%m-%d')
                except Exception as date_error:
                    logger.warning(f"Could not parse date '{value}': {date_error}", extra=extra)
            
            # Get the visible input field (handles duplicate elements from responsive layout)
            input_field = await self._get_visible_locator(page, selector)
            if not input_field:
                return {
                    "success": False,
                    "field": field_name,
                    "error": f"Input field '{field_name}' not found"
                }
            
            # Clear and fill the input field
            await input_field.fill("")
            await input_field.fill(value)
            
            # Blur the field to trigger validation (simulate clicking outside)
            await input_field.blur()
            await asyncio.sleep(0.3)  # Wait for validation to trigger
            
            # Check for field-specific error using FIELD_ERROR_SELECTORS
            error_selector = FIELD_ERROR_SELECTORS.get(field_key) or FIELD_ERROR_SELECTORS.get(field_name)
            if error_selector:
                try:
                    error_el = await self._get_visible_locator(page, error_selector)
                    if error_el and await error_el.is_visible(timeout=300):
                        error_text = await error_el.text_content()
                        if error_text and error_text.strip():
                            logger.warning(f"Field '{field_name}' has validation error: {error_text.strip()}", extra=extra)
                            return {
                                "success": False,
                                "field": field_name,
                                "error": error_text.strip()
                            }
                except Exception as e:
                    logger.debug(f"Error checking field validation: {e}", extra=extra)
            
            logger.info(f"Field '{field_name}' filled with '{value}'", extra=extra)
            
            return {
                "success": True,
                "field": field_name,
                "value": value,
                "message": f"Successfully filled {field_name} with '{value}'"
            }
            
        except Exception as e:
            logger.error(f"Error filling field {field_name}: {e}", extra=extra)
            return {
                "success": False,
                "field": field_name,
                "error": str(e)
            }

    async def click_button(self, session_id: str, button_name: str) -> Dict[str, Any]:
        """
        Click a button on the form and evaluate the result.
        
        For step CTAs, this function:
        - Checks if the next step becomes visible (success)
        - Returns error message if submission fails
        - For Step 4's CTA, returns loan offers in the response field
        
        Args:
            session_id: The active session ID
            button_name: Button identifier (e.g., "apply_now", "verify_continue", "continue", "get_loan_offer")
            
        Returns:
            Dict with format: {success, button, message, response}
            - success: Boolean indicating if the action succeeded
            - button: The button that was clicked
            - message: Success or error message
            - response: Additional data (loan offers for Step 4 success)
        """
        extra = {'session_id': session_id}
        
        if session_id not in PLAYWRIGHT_SESSIONS:
            logger.error("Invalid session_id", extra=extra)
            return {
                "success": False,
                "button": button_name,
                "message": f"Session {session_id} not found.",
                "response": None
            }
        
        # Normalize button name
        button_key = button_name.lower().replace(" ", "_").replace("&", "").replace("-", "_")
        selector = BUTTON_SELECTORS.get(button_key)
        
        if not selector:
            # Try direct selector if not in mapping
            if button_name.startswith(("button#", "#")):
                selector = button_name
            else:
                return {
                    "success": False,
                    "button": button_name,
                    "message": f"Unknown button '{button_name}'. Available buttons: {list(BUTTON_SELECTORS.keys())}",
                    "response": None
                }
        
        session = PLAYWRIGHT_SESSIONS[session_id]
        session["last_activity_at"] = datetime.now()
        page = session["page"]

        # Determine current step before clicking
        current_step = await self._get_current_step(page)
        logger.info(f"Clicking button: '{button_name}' ({selector}) on Step {current_step}", extra=extra)
        
        # Determine expected next step based on button
        expected_next_step = None
        is_step_cta = False
        is_back_navigation = False
        
        if selector == "#apply-now-btn":
            expected_next_step = 2
            is_step_cta = True
        elif selector == "#continue-otp-btn":
            expected_next_step = 3
            is_step_cta = True
        elif selector == "#continue-step3-btn":
            expected_next_step = 4
            is_step_cta = True
        elif selector == "#get-loan-offer-btn":
            expected_next_step = 5
            is_step_cta = True
        elif selector == "#back-to-step3-btn":
            expected_next_step = 3
            is_back_navigation = True
        elif selector == "#back-to-step4-btn":
            expected_next_step = 4
            is_back_navigation = True
        
        try:
            # Get the visible button (handles duplicate elements from responsive layout)
            button = await self._get_visible_locator(page, selector)
            if not button:
                return {
                    "success": False,
                    "button": button_name,
                    "message": f"Button '{button_name}' not found.",
                    "response": None
                }
            
            # Check if button is visible
            button_visible = await button.is_visible(timeout=2000)
            if not button_visible:
                return {
                    "success": False,
                    "button": button_name,
                    "message": f"Button '{button_name}' is not visible. Make sure you're on the correct step.",
                    "response": None
                }
            
            # Click the button
            await button.click()
            
            # Wait for UI updates
            await asyncio.sleep(0.5)
            
            # Handle step CTA buttons and back navigation - validate transition
            if (is_step_cta or is_back_navigation) and expected_next_step:
                transition_result = await self._check_step_transition(page, expected_next_step)
                
                if transition_result["success"]:
                    # Step 4 -> Step 5: Read loan offers
                    if expected_next_step == 5 and is_step_cta:
                        offers = await self._read_loan_offers(page)
                        
                        # Check if offers indicate an error
                        if offers and len(offers) > 0 and offers[0].get("error"):
                            return {
                                "success": True,
                                "button": button_name,
                                "message": offers[0].get("message", "Lender service is temporarily unavailable"),
                                "response": offers
                            }
                        
                        return {
                            "success": True,
                            "button": button_name,
                            "message": f"Form submitted successfully. {len(offers)} loan offer(s) found.",
                            "response": offers
                        }
                    
                    # Back navigation success message
                    if is_back_navigation:
                        return {
                            "success": True,
                            "button": button_name,
                            "message": f"Navigated back to Step {expected_next_step}. You can now modify the form fields.",
                            "response": None
                        }
                    
                    return {
                        "success": True,
                        "button": button_name,
                        "message": f"Moved to Step {expected_next_step} successfully.",
                        "response": None
                    }
                else:
                    # Transition failed - return error
                    error_msg = transition_result.get("error_message", "Navigation failed")
                    return {
                        "success": False,
                        "button": button_name,
                        "message": error_msg,
                        "response": transition_result.get("errors")
                    }
            
            # Non-CTA buttons (edit, back, resend, etc.)
            return {
                "success": True,
                "button": button_name,
                "message": f"Button '{button_name}' clicked successfully.",
                "response": None
            }
            
        except Exception as e:
            logger.error(f"Error clicking button {button_name}: {e}", extra=extra)
            return {
                "success": False,
                "button": button_name,
                "message": str(e),
                "response": None
            }

    async def get_form_state(self, session_id: str) -> Dict[str, Any]:
        """
        Get the current state of the form including current step and visible fields.
        
        Returns:
            Dict with current step and field values
        """
        extra = {'session_id': session_id}
        
        if session_id not in PLAYWRIGHT_SESSIONS:
            return {"success": False, "error": "Session not found"}
        
        session = PLAYWRIGHT_SESSIONS[session_id]
        page = session["page"]
        
        current_step = await self._get_current_step(page)
        form_state = {
            "current_step": current_step
        }
        
        # Get field values based on current step (handles duplicate elements from responsive layout)
        try:
            if current_step >= 1:
                # Step 1 fields
                try:
                    mobile_el = await self._get_visible_locator(page, "#mobile-input")
                    form_state["mobile"] = await mobile_el.input_value() if mobile_el else None
                except:
                    form_state["mobile"] = None
                try:
                    terms_el = await self._get_visible_locator(page, "#terms-checkbox")
                    form_state["terms_checked"] = await terms_el.is_checked() if terms_el else None
                except:
                    form_state["terms_checked"] = None
            
            if current_step >= 3:
                # Step 3 fields
                try:
                    pan_el = await self._get_visible_locator(page, "#pan-input")
                    form_state["pan"] = await pan_el.input_value() if pan_el else None
                except:
                    form_state["pan"] = None
                try:
                    name_el = await self._get_visible_locator(page, "#full-name-input")
                    form_state["full_name"] = await name_el.input_value() if name_el else None
                except:
                    form_state["full_name"] = None
            
            if current_step >= 4:
                # Step 4 fields
                fields_to_check = {
                    "email": "#email-input",
                    "dob": "#dob-input",
                    "income": "#income-input",
                    "building": "#building-input",
                    "road": "#road-input",
                    "pincode": "#pincode-input",
                    "city": "#city-input",
                }
                for field_name, selector in fields_to_check.items():
                    try:
                        field_el = await self._get_visible_locator(page, selector)
                        form_state[field_name] = await field_el.input_value() if field_el else None
                    except:
                        form_state[field_name] = None
        except Exception as e:
            logger.error(f"Error getting form state: {e}", extra=extra)
        
        return {
            "success": True,
            "form_state": form_state
        }

    async def navigate(self, session_id: str, url: str, wait_for: Optional[str] = None) -> Dict[str, Any]:
        """
        Move the live browser to another page of the demo site.

        Used for the hero -> application-form hop. This is a real navigation
        rather than a DOM click because the hero's CTA is a plain button with no
        router binding: a click would highlight and do nothing, and the caller
        would watch a dead page. Navigating directly is deterministic and shows
        up identically on the noVNC view.
        """
        extra = {'session_id': session_id}

        if session_id not in PLAYWRIGHT_SESSIONS:
            logger.error("Invalid session_id", extra=extra)
            return {"success": False, "error": f"Session {session_id} not found."}

        session = PLAYWRIGHT_SESSIONS[session_id]
        session["last_activity_at"] = datetime.now()
        page = session["page"]

        logger.info(f"Navigating to: {url}", extra=extra)
        try:
            await page.goto(url, timeout=60000, wait_until="domcontentloaded")
            if wait_for:
                await page.wait_for_selector(wait_for, timeout=15000)
            return {"success": True, "url": url, "message": f"Navigated to {url}"}
        except Exception as e:
            logger.error(f"Navigation failed: {e}", extra=extra)
            return {"success": False, "error": f"Could not load {url}: {e}"}

    async def show_offers(self, session_id: str, offers_url: str) -> Dict[str, Any]:
        """
        Navigate the live browser to the offer-results page and read the cards back.

        This is the IIFL equivalent of the muthoot/DMI "Step 4 -> Step 5" hop: the
        caller sees the offers appear on screen, and the scraped cards come back in
        the tool response so the agent can read one or two of them aloud.

        The page computes the offers itself (frontend src/lib/offerTable.ts) from
        query params, so this method never invents numbers -- it only reports what
        is actually rendered on screen.
        """
        extra = {'session_id': session_id}

        if session_id not in PLAYWRIGHT_SESSIONS:
            logger.error("Invalid session_id", extra=extra)
            return {"success": False, "error": f"Session {session_id} not found.", "offers": []}

        session = PLAYWRIGHT_SESSIONS[session_id]
        session["last_activity_at"] = datetime.now()
        page = session["page"]

        logger.info(f"Navigating to offers: {offers_url}", extra=extra)
        try:
            await page.goto(offers_url, timeout=60000, wait_until="domcontentloaded")
            await page.wait_for_selector("#offer-card-0", timeout=15000)
        except Exception as e:
            logger.error(f"Could not load offers page: {e}", extra=extra)
            return {"success": False, "error": f"Could not load offers page: {e}", "offers": []}

        offers = []
        index = 0
        while True:
            card = await self._get_visible_locator(page, f"#offer-card-{index}")
            if not card:
                break
            try:
                if not await card.is_visible(timeout=500):
                    break
            except Exception:
                break

            offer = {"index": index}
            # Scheme name + the amount in the card header.
            for key, sel in (("scheme", "span.font-semibold"), ("amount", "p.font-bold.text-xl")):
                try:
                    el = card.locator(sel).first
                    if await el.is_visible(timeout=300):
                        offer[key] = (await el.text_content() or "").strip()
                except Exception:
                    offer[key] = ""
            # The 3-column grid: Monthly EMI / Tenure / Interest rate.
            try:
                items = card.locator(".grid > div")
                for i in range(await items.count()):
                    it = items.nth(i)
                    label = ((await it.locator("p.text-xs").first.text_content()) or "").strip().lower()
                    value = ((await it.locator("p.font-semibold").first.text_content()) or "").strip()
                    if "emi" in label:
                        offer["monthly_emi"] = value
                    elif "tenure" in label:
                        offer["tenure"] = value
                    elif "rate" in label:
                        offer["interest_rate"] = value
            except Exception as e:
                logger.debug(f"Could not parse grid for offer {index}: {e}", extra=extra)

            offers.append(offer)
            index += 1
            if index > 10:  # safety stop
                break

        logger.info(f"Read {len(offers)} offer(s) from the page", extra=extra)
        return {
            "success": True,
            "count": len(offers),
            "offers": offers,
            "message": f"Offers page is now on screen with {len(offers)} offer(s).",
        }

    async def destroy_session(self, session_id: str) -> Dict[str, Any]:
        """
        Close page, context, browser and remove from registry.

        Returns:
            Dict with success status
        """
        extra = {'session_id': session_id}
        
        if session_id not in PLAYWRIGHT_SESSIONS:
            logger.warning("Session already destroyed or invalid session_id", extra=extra)
            return {"success": True, "message": "Session already closed"}

        session = PLAYWRIGHT_SESSIONS[session_id]
        
        logger.info("Destroying session", extra=extra)
        
        try:
            await session["page"].close()
            await session["context"].close()
            await session["browser"].close()
        except Exception as e:
            logger.error(f"Error during session destruction: {e}", extra=extra)
        finally:
            del PLAYWRIGHT_SESSIONS[session_id]
            logger.info("Session removed from registry", extra=extra)
        
        return {
            "success": True,
            "message": "Browser session closed successfully"
        }

    async def cleanup_idle_sessions(self, idle_seconds: int = 3600) -> int:
        """
        Destroy any Playwright session whose last_activity_at is older than
        `idle_seconds` ago. Frees the underlying Chromium processes (each one
        is ~200-500 MB resident) so the container doesn't accumulate orphaned
        browsers from abandoned conversations.

        Returns the number of sessions reaped.
        """
        now = datetime.now()
        cutoff = now - timedelta(seconds=idle_seconds)
        to_destroy = []
        for sid, sess in PLAYWRIGHT_SESSIONS.items():
            last_activity = sess.get("last_activity_at") or sess.get("created_at")
            if last_activity and last_activity < cutoff:
                to_destroy.append((sid, last_activity))

        for sid, last_activity in to_destroy:
            idle_for = (now - last_activity).total_seconds()
            logger.info(
                f"Reaping idle session (idle for {idle_for:.0f}s)",
                extra={'session_id': sid},
            )
            try:
                await self.destroy_session(sid)
            except Exception as e:
                logger.error(
                    f"Failed to destroy idle session: {e}",
                    extra={'session_id': sid},
                )

        return len(to_destroy)

    async def shutdown(self):
        """
        Clean up playwright instance and all active sessions.
        """
        session_ids = list(PLAYWRIGHT_SESSIONS.keys())
        for sid in session_ids:
            await self.destroy_session(sid)

        if self.playwright_instance:
            await self.playwright_instance.stop()
            self.playwright_instance = None
        logger.info("Playwright service shutdown complete", extra={'session_id': 'N/A'})


# Global service instance for use by app.py
playwright_service = PlaywrightService()


async def test_playwright_service():
    """
    Manual testing function to demonstrate functionality using the local loan form.
    Tests the 5-step form flow.
    """
    from pathlib import Path
    
    service = PlaywrightService()
    try:
        # Get absolute path to the local index.html (or use a URL)
        test_url = "http://localhost:3000/loan-application"  # Update this to your form URL
        
        print("\n--- Starting Manual Test with 5-Step Loan Form ---")
        print(f"URL: {test_url}")
        print("Note: Browser is in slow_mo=500 mode. You will see actions clearly.")
        
        session_id = "test-session-001"
        
        # 1. Start session
        result = await service.start_session(test_url, session_id)
        print(f"Start Session: {result}")
        
        # Step 1: Mobile Number Entry
        await asyncio.sleep(10)
        print("\n--- Step 1: Mobile Number Entry ---")
        print(await service.fill_field(session_id, "mobile", "6363720158"))
        await asyncio.sleep(1)
        await service.fill_field(session_id, "terms", "true")
        await asyncio.sleep(1)
        
        result = await service.click_button(session_id, "apply_now")
        print(f"Apply Now Result: {result}")
        
        # if result.get("success"):
        #     # Step 2: OTP Verification
        #     print("\n--- Step 2: OTP Verification ---")
        #     await asyncio.sleep(1)
        #     await service.fill_field(session_id, "otp", "123456")
        #     await asyncio.sleep(0.3)
            
        #     result = await service.click_button(session_id, "verify_continue")
        #     print(f"Verify Continue Result: {result}")
            
        #     if result.get("success"):
        #         # Step 3: PAN & Consent
        #         print("\n--- Step 3: PAN & Consent ---")
        #         await service.fill_field(session_id, "pan", "ABCDE1234F")
        #         await asyncio.sleep(0.3)
        #         await service.fill_field(session_id, "full_name", "Test User")
        #         await asyncio.sleep(0.3)
        #         await service.fill_field(session_id, "consent1", "true")
        #         await asyncio.sleep(0.3)
        #         await service.fill_field(session_id, "consent2", "true")
        #         await asyncio.sleep(0.3)
                
        #         result = await service.click_button(session_id, "continue")
        #         print(f"Continue Result: {result}")
                
        #         if result.get("success"):
        #             # Step 4: Additional Details
        #             print("\n--- Step 4: Additional Details ---")
        #             await service.fill_field(session_id, "email", "test@example.com")
        #             await asyncio.sleep(0.3)
        #             await service.fill_field(session_id, "dob", "1990-01-15")
        #             await asyncio.sleep(0.3)
        #             await service.fill_field(session_id, "gender", "male")
        #             await asyncio.sleep(0.3)
        #             await service.fill_field(session_id, "employment", "salaried")
        #             await asyncio.sleep(0.3)
        #             await service.fill_field(session_id, "income", "50000")
        #             await asyncio.sleep(0.3)
        #             await service.fill_field(session_id, "building", "123, Test Building")
        #             await asyncio.sleep(0.3)
        #             await service.fill_field(session_id, "road", "Test Road, Test Area")
        #             await asyncio.sleep(0.3)
        #             await service.fill_field(session_id, "pincode", "110001")
        #             await asyncio.sleep(0.3)
        #             await service.fill_field(session_id, "city", "Delhi")
        #             await asyncio.sleep(0.3)
        #             await service.fill_field(session_id, "state", "Delhi")
        #             await asyncio.sleep(0.3)
                    
        #             result = await service.click_button(session_id, "get_loan_offer")
        #             print(f"Get Loan Offer Result: {result}")
                    
        #             if result.get("success") and result.get("response"):
        #                 print("\n--- Step 5: Loan Offers ---")
        #                 offers = result.get("response")
        #                 print(f"Found {len(offers)} loan offer(s):")
        #                 for offer in offers:
        #                     print(f"  - {offer}")
        
        # # Wait for user to observe
        # print("\nWaiting 10 seconds for observation...")
        # await asyncio.sleep(10)

        # # Get the page from the session registry, not from result
        # session = PLAYWRIGHT_SESSIONS[session_id]
        # offers = await service._read_loan_offers(session["page"])
        # print(f"Loan Offers: {offers}")

        # # Back to step 4
        # print("\n--- Back to Step 4 ---")
        # result = await service.click_button(session_id, "back_to_step4")
        # print(f"Back to Step 4 Result: {result}")

        # print("\nWaiting 10 seconds for observation...")
        # await asyncio.sleep(10)
        # # Back to step 3
        # print("\n--- Back to Step 3 ---")
        # result = await service.click_button(session_id, "back_to_step3")
        # print(f"Back to Step 3 Result: {result}")
        # print("\nWaiting 10 seconds for observation...")
        # await asyncio.sleep(10)
        
        # Destroy session
        result = await service.destroy_session(session_id)
        print(f"Destroy Session: {result}")
        
    except Exception as e:
        print(f"Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await service.shutdown()


if __name__ == "__main__":
    asyncio.run(test_playwright_service())
