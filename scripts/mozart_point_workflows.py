#!/usr/bin/env python3
"""
Point a client's Mozart *_<client> workflows at a backend base URL (draft -> publish).

Sets each workflow's HTTP node url to <base>/agent/<endpoint>, then publishes and
verifies. Only touches the three `*_<client>` workflows you name via --client, so it
CANNOT touch the `*_dmi` originals unless you literally pass --client dmi.

Env:
  NURIX_WORKSPACE_ID   the client's workspace uuid

Usage:
  NURIX_WORKSPACE_ID=... python3 scripts/mozart_point_workflows.py \
      --client muthoot --base-url https://muthoot-backend-production.up.railway.app
"""
import os, sys, json, argparse, urllib.request, urllib.error

WS = os.environ.get("NURIX_WORKSPACE_ID")
BASE = os.environ.get("NURIX_MOZART_HOST", "https://mozart-in.nurixlabs.tech")

# workflow displayName prefix -> backend endpoint
FLOWS = {
    "start_playwright_connection_flow": "/agent/session/start",
    "fill_field_flow": "/agent/fill-field",
    "click_button_flow": "/agent/click-button",
}

def req(method, path, body=None):
    r = urllib.request.Request(BASE + path, data=body.encode() if body else None, method=method)
    r.add_header("workspace-id", WS)
    if body:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=40) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return None, str(e)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--client", required=True, help="workflow suffix, e.g. muthoot")
    ap.add_argument("--base-url", required=True, help="backend base, e.g. https://x.up.railway.app")
    a = ap.parse_args()
    if not WS:
        sys.exit("set NURIX_WORKSPACE_ID")
    base = a.base_url.rstrip("/")
    for prefix, endpoint in FLOWS.items():
        name = f"{prefix}_{a.client}"
        st, raw = req("GET", f"/api/metadata/workflow/{name}?isDisplayName=true")
        if st != 200:
            print(f"[{name}] resolve failed HTTP {st}"); continue
        uid = json.loads(raw).get("name")
        st, raw = req("GET", f"/api/metadata/workflow/{uid}/draft")
        if st != 200:
            print(f"[{name}] draft GET {st}"); continue
        d = json.loads(raw)
        node = next((n for n in d.get("nodes", []) if n.get("type") == "http"), None)
        if not node:
            print(f"[{name}] no http node in draft"); continue
        target = base + endpoint
        node["data"]["url"] = target
        pst, praw = req("PUT", f"/api/metadata/workflow/{uid}/draft", json.dumps(d))
        if pst not in (200, 201):
            print(f"[{name}] PUT {pst}: {praw[:120]}"); continue
        cst, _ = req("POST", f"/api/metadata/workflow/{uid}/publish")
        gst, graw = req("GET", f"/api/metadata/workflow/{uid}")
        try:
            pub = json.loads(graw)["tasks"][0]["inputParameters"]["http_request"]["uri"]
        except Exception:
            pub = "?"
        print(f"[{name}] -> {pub}  (PUT {pst}, publish {cst})  {'OK' if pub == target else 'CHECK'}")

if __name__ == "__main__":
    main()
