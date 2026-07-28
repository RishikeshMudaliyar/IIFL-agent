"""
Branch, scheme and formatting facts shared by every outbound message.

Extracted from email_service.py when WhatsApp was added (v13). Both channels tell
the caller about the SAME branch and the SAME scheme, so the data has exactly one
home — a second copy would drift, and a WhatsApp that contradicts the email the
branch manager receives is worse than sending nothing.

Mirrors frontend/src/lib/branches.ts and frontend/src/lib/goldSchemes.ts, which
remain the product source of truth. Never invent a rate or an address here.
"""

import re
from typing import Any, Dict

# Spoken scheme id -> the published product name and its headline terms.
# Mirrors frontend/src/lib/goldSchemes.ts.
SCHEMES = {
    "saver":   ("IIFL Swarna Saver",   "55% LTV", "₹7,300/gram", "11.88% p.a."),
    "balance": ("IIFL Swarna Balance", "65% LTV", "₹8,635/gram", "14.4% p.a."),
    "max":     ("IIFL Swarna Max",     "75% LTV", "₹9,960/gram", "17.4% p.a."),
}

# Branch + local event per pincode. The addresses are real, the events are demo
# colour. The DSL prompt's branch_knowledge block must agree with this or the
# message will contradict what the caller just heard on the call.
BRANCHES = {
    "400059": {
        "area": "Andheri East",
        "address": ("1st Floor, Tarani Business Centre, Marol Maroshi Road, "
                    "Opposite Lok Bharti Complex, Marol, Andheri East, Mumbai — 400059"),
        "directions": "On Marol Maroshi Road, right opposite Lok Bharti Complex.",
        "phone": "+91 22 7107 4667",
        "manager": "Branch Manager, IIFL Finance Andheri East",
        "event": ("Free gold purity checking camp this Saturday in Marol, "
                  "10:00 AM – 4:00 PM. Bring your gold, get it checked free of charge."),
    },
    "400086": {
        "area": "Ghatkopar West",
        "address": ("Shop No. 5 & 6, Ground Floor, Anupam B Building, LBS Marg, "
                    "Ghatkopar West, Mumbai — 400086"),
        "directions": "On LBS Marg, ground floor of Anupam Building — five minutes from Ghatkopar station.",
        "phone": "+91 22 7107 4600",
        "manager": "Branch Manager, IIFL Finance Ghatkopar West",
        "event": ("'Seedhi Baat' gold loan awareness session this Sunday, 11:00 AM, "
                  "near LBS Marg market. How gold loans work, explained plainly."),
    },
    "400097": {
        "area": "Malad East",
        "address": ("Shop No. 2, Kurar Sangita Building, Shantaram Talao Road, "
                    "Near St George High School, Kurar, Malad East, Mumbai — 400097"),
        "directions": "On Shantaram Talao Road, near St George High School in Kurar village.",
        "phone": "+91 22 7107 4610",
        "manager": "Branch Manager, IIFL Finance Malad East",
        "event": ("Financial literacy camp next week near St George School, Kurar — "
                  "gold loans, savings and interest explained simply. Free entry."),
    },
    "400014": {
        "area": "Dadar East",
        "address": ("201, 2nd Floor, Parasmani Shopping Centre, 95 Naigaum Cross Road, "
                    "MMGS Marg, Near Dadar Railway Station, Dadar East, Mumbai — 400014"),
        "directions": "Right next to Dadar station, Parasmani Shopping Centre, second floor.",
        "phone": "+91 22 7107 4620",
        "manager": "Branch Manager, IIFL Finance Dadar East",
        "event": ("Branch open house later this month, 5:00 – 7:00 PM — come talk "
                  "through a gold loan with no pressure. Refreshments provided."),
    },
}

FALLBACK_PINCODE = "400059"
BRANCH_HOURS = "9:30 AM – 6:00 PM (Sunday closed)"


def clean(v: Any) -> str:
    """Drop unresolved template tokens — an unset DSL variable arrives literally
    as '<<scheme>>' and must never reach the customer or the branch manager."""
    if v is None:
        return ""
    s = str(v).strip()
    if not s or s.lower() in ("none", "null", "undefined"):
        return ""
    if ("<<" in s and ">>" in s) or ("{{" in s and "}}" in s):
        return ""
    return s


def branch_for(pincode: str) -> Dict[str, str]:
    """The branch block for this pincode, falling back to Andheri East.

    Never raises and never returns None — an unknown pincode still produces a
    coherent message rather than an empty address.
    """
    key = re.sub(r"\D", "", clean(pincode))
    return BRANCHES.get(key) or BRANCHES[FALLBACK_PINCODE]


def format_amount(raw: str) -> str:
    """Render a rupee amount with Indian digit grouping (₹5,00,000)."""
    digits = re.sub(r"[^\d]", "", str(raw or ""))
    if not digits:
        return str(raw or "")
    n = digits[::-1]
    groups = [n[:3]] + [n[i:i + 2] for i in range(3, len(n), 2)]
    return "₹" + ",".join(groups)[::-1]


def to_e164_india(raw: str) -> str:
    """Normalise an Indian mobile to E.164 (+91XXXXXXXXXX).

    The agent is handed a pre-normalised <<phone_e164>>, but a live call can also
    deliver a bare 10-digit number, a 0-prefixed one, or one with spaces. Twilio
    rejects anything that is not E.164, so normalise defensively.

    Returns "" when the input cannot be a valid Indian mobile — callers treat an
    empty string as "no recipient" rather than attempting a doomed send.
    """
    digits = re.sub(r"\D", "", clean(raw))
    if not digits:
        return ""
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    if len(digits) == 13 and digits.startswith("091"):
        return f"+{digits[1:]}"
    return ""
