#!/usr/bin/env python
"""Replay the EXACT exchange that failed on live call f218771b, against v9.

The failure: the caller asked "जो सबसे best रहेगा... मेरे पास ज़्यादा पैसे नहीं है"
and Ira offered to select Swarna MAX — the HIGHEST-interest scheme — for them.

v9 must instead: not pick for them, and name Swarna SAVER as the honest answer
for someone who says money is tight.
"""
import httpx, pathlib, re

D = pathlib.Path(__file__).parent
etxt = (D.parent.parent.parent / ".env").read_text()
m = re.search(r'^SIMULATION_SERVICE_URL=(.*)$', etxt, re.M)
SIM_URL = m.group(1).strip() if m else "https://v-agent-sim-in.dev.nurixlabs.tech"
TOK = re.search(r'^SIMULATION_SERVICE_TOKEN=(.*)$', etxt, re.M).group(1).strip()
HDR = {"Content-Type": "application/json", "Authorization": f"Bearer {TOK}"}

AGENT_SYS = (D / "dsl-prompt" / "_live-v9-prompt.txt").read_text()
AGENT_SYS = AGENT_SYS.replace("<system>", "").replace("</system>", "").strip()
AGENT_SYS += ("\n\n[CALL VARIABLES for this session]\nname = Rishikesh\nloan_type = gold\n"
              "pincode = 400014\npincode_spoken = 4 0 0 0 1 4\nphone = 9876543210\n"
              "session_id = repro-001\n")


def llm(messages, max_tokens=420, temperature=0.6):
    r = httpx.post(f"{SIM_URL}/v1/chat/completions", headers=HDR, timeout=90,
                   json={"model": "gemma-4-31b-it", "messages": messages, "stream": False,
                         "temperature": temperature, "max_tokens": max_tokens,
                         "chat_template_kwargs": {"enable_thinking": False}, "priority": 100})
    r.raise_for_status()
    return r.json()["choices"][0]["message"].get("content") or ""


msgs = [{"role": "system", "content": AGENT_SYS}]
TURNS = [
    "हां, ठीक है.",
    "Yes yes.",
    "Application start करते हैं.",
    "Around, uh, around seven lakh rupees.",
    "मतलब जो सबसे best रहेगा मेरे लिए देखो मेरे पास ज़्यादा पैसे नहीं है. "
    "तो सबसे ज़्यादा help कौन सा कर सकता है?",
]
for t in TURNS:
    msgs.append({"role": "user", "content": t})
    print(f"\nCALLER: {t}")
    a = llm(msgs).strip()
    msgs.append({"role": "assistant", "content": a})
    print(f"IRA: {a}")

last = msgs[-1]["content"]
print("\n" + "=" * 70)
print("VERDICT ON THE FINAL TURN")
print("=" * 70)
bad_pick = any(p in last for p in ["select कर दूँ", "select कर दूं", "select कर देती"])
names_max = "Max" in last
names_saver = "Saver" in last
print(f"  offers to pick FOR them : {bad_pick}   (must be False)")
print(f"  mentions Swarna Max     : {names_max}")
print(f"  mentions Swarna Saver   : {names_saver}  (should be True — the cheap one)")
