#!/usr/bin/env python
"""v8 conversational-quality simulation — agent-under-test is the LIVE v8 prompt.

Not a pass/fail gate. The question is: what does this call FEEL like to the person
on the other end? So the caller personas are realistic rather than cooperative —
a real gold-loan caller is cautious about handing over their jewellery and their
Aadhaar to a voice on the phone.

Runs the real deployed model (gemma-4-31b) so the transcript reflects what an
audience would actually hear, not what the prompt hopes for.
"""
import httpx, json, pathlib, re, sys

D = pathlib.Path(__file__).parent
ENV = D.parent.parent.parent / ".env"
etxt = ENV.read_text()
m = re.search(r'^SIMULATION_SERVICE_URL=(.*)$', etxt, re.M)
SIM_URL = m.group(1).strip() if m else "https://v-agent-sim-in.dev.nurixlabs.tech"
TOK = re.search(r'^SIMULATION_SERVICE_TOKEN=(.*)$', etxt, re.M).group(1).strip()
SIM_MODEL = "gemma-4-31b-it"
HDR = {"Content-Type": "application/json", "Authorization": f"Bearer {TOK}"}

AGENT_SYS = (D / "dsl-prompt" / "_live-v8-prompt.txt").read_text()
AGENT_SYS = AGENT_SYS.replace("<system>", "").replace("</system>", "").strip()


def llm(messages, max_tokens=400, temperature=0.7):
    r = httpx.post(f"{SIM_URL}/v1/chat/completions", headers=HDR, timeout=90,
                   json={"model": SIM_MODEL, "messages": messages, "stream": False,
                         "temperature": temperature, "max_tokens": max_tokens,
                         "chat_template_kwargs": {"enable_thinking": False},
                         "priority": 100})
    r.raise_for_status()
    return r.json()["choices"][0]["message"].get("content") or ""


def seed_vars(name, loan_type, pincode):
    return (f"\n\n[CALL VARIABLES for this session]\n"
            f"name = {name}\nloan_type = {loan_type}\npincode = {pincode}\n"
            f"pincode_spoken = {' '.join(pincode)}\n"
            f"phone = 9876543210\nphone_e164 = +919876543210\nsession_id = sim-v8-001\n")


TOOL_RESULTS = {
    "start_session": "[tool result: session_started=true]",
    "go_to_form":    "[tool result: form_ready=true]",
    "fill_field":    "[tool result: fill_ok=true]",
    "click_button":  "[tool result: click_ok=true]",
    "show_offers":   ("[tool result: offers=[{scheme:'IIFL Swarna Balance', amount:200000, "
                      "rate:'14.4%', emi:12421, tenure:'18 months'}, {scheme:'IIFL Swarna Max', "
                      "amount:200000, rate:'17.4%', emi:9927, tenure:'24 months'}]]"),
}


def detect_tool(t):
    m = re.search(r'\b(start_session|go_to_form|fill_field|click_button|show_offers)\b', t)
    return m.group(1) if m else None


SCENARIOS = [
    {
        "name": "hesitant_comparer",
        "vars": ("Rishikesh", "gold", "400086"),
        "turns": 22,
        "caller": (
            "You are Rishikesh, a 34-year-old from Ghatkopar, Mumbai. You enquired online about a "
            "gold loan because you need about 2 lakh for your sister's wedding. You are NOT an "
            "eager buyer — you are cautious and a bit sceptical, the way a real person is when "
            "handing over family gold.\n\n"
            "Behave like a real person on a phone call:\n"
            "- Speak in natural Hinglish, SHORT turns (one or two sentences), like actual speech.\n"
            "- Turn 1: respond to her greeting normally.\n"
            "- Early on, ask 'gold ka kya hoga, safe rahega na?' — you genuinely worry about this.\n"
            "- When she mentions interest rates or schemes, push back once: "
            "'Muthoot mein toh kam rate bola tha yaar' — you actually did check.\n"
            "- Later, when she asks for your PAN or Aadhaar, hesitate: 'ye sab phone pe dena "
            "safe hai kya?'\n"
            "- Near the end, say 'sochkar batata hoon' at least once — you are not ready to commit.\n"
            "- Answer factual questions when asked: 2 lakh needed, about 30 grams, 22 carat, "
            "PAN CXIPM4742A, Aadhaar 1234 5678 9012, no existing gold loan.\n"
            "- If she says something that sounds like a sales pitch or pressures you, react like a "
            "real person would — get slightly annoyed or go quiet ('hmm').\n"
            "Never break character. Never write stage directions. Only speak your line."
        ),
    },
    {
        "name": "rushed_pragmatist",
        "vars": ("Meera", "gold", "400014"),
        "turns": 20,
        "caller": (
            "You are Meera from Dadar, 41. You need 1.5 lakh urgently for a medical bill and you "
            "are in a hurry — you have little patience for chit-chat.\n\n"
            "- Natural Hinglish, VERY short turns. Often just the answer, nothing else.\n"
            "- If the agent talks too long or gives you marketing lines, cut in: "
            "'haan haan, wo sab theek hai, aage boliye' or 'mujhe jaldi hai'.\n"
            "- Ask ONE thing you actually care about: 'paisa aaj mil jayega?'\n"
            "- Answer when asked: 1.5 lakh, 25 grams, 22 carat, PAN ABCPM1234K, "
            "Aadhaar 9876 5432 1098, no existing loan.\n"
            "- You do NOT want the branch tour. If she offers it, say 'nahi nahi, application "
            "hi shuru karo'.\n"
            "Never break character. Only speak your line."
        ),
    },
]


def run(sc):
    name, loan_type, pincode = sc["vars"]
    agent_msgs = [{"role": "system", "content": AGENT_SYS + seed_vars(name, loan_type, pincode)}]
    caller_msgs = [{"role": "system", "content": sc["caller"]}]
    transcript = []

    # Platform speaks the static opening first.
    opening = ("नमस्ते! IIFL Finance से Ira बात कर रही हूँ. एक second, "
               "मैं आपकी loan application ready कर रही हूँ.")
    transcript.append(("IRA(opening)", opening))
    agent_msgs.append({"role": "assistant", "content": opening})
    caller_msgs.append({"role": "user", "content": opening})

    for _ in range(sc["turns"]):
        cal = llm(caller_msgs, max_tokens=120, temperature=0.85).strip()
        if not cal:
            break
        transcript.append(("CALLER", cal))
        caller_msgs.append({"role": "assistant", "content": cal})
        agent_msgs.append({"role": "user", "content": cal})

        ag = llm(agent_msgs, max_tokens=420, temperature=0.7).strip()
        transcript.append(("IRA", ag))
        agent_msgs.append({"role": "assistant", "content": ag})
        caller_msgs.append({"role": "user", "content": ag})

        if "<EOC/>" in ag:
            break

        tool = detect_tool(ag)
        if tool:
            res = TOOL_RESULTS[tool]
            transcript.append((f"[TOOL {tool}]", res))
            agent_msgs.append({"role": "user", "content": res})
            ag2 = llm(agent_msgs, max_tokens=420, temperature=0.7).strip()
            if ag2:
                transcript.append(("IRA", ag2))
                agent_msgs.append({"role": "assistant", "content": ag2})
                caller_msgs.append({"role": "user", "content": ag2})
                if "<EOC/>" in ag2:
                    break
    return transcript


out_dir = D / "evals" / "sim-v8-quality"
out_dir.mkdir(parents=True, exist_ok=True)
for sc in [x for x in SCENARIOS if x["name"]=="hesitant_comparer"]:
    print(f"\n{'='*78}\nSCENARIO: {sc['name']}\n{'='*78}")
    try:
        t = run(sc)
    except Exception as e:
        print("ERROR:", type(e).__name__, e)
        continue
    lines = []
    for who, txt in t:
        lines.append(f"{who}: {txt}")
        print(f"{who}: {txt}\n")
    (out_dir / f"{sc['name']}.txt").write_text("\n\n".join(lines))
print(f"\nsaved -> {out_dir}")
