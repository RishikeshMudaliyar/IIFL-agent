#!/usr/bin/env python3
"""
Mint (or list) a domain-scoped widget API key for a channel-connection.

This mirrors the Nurix console Deploy page (zero.nurixlabs.tech/channel/<cc>/deploy);
the console is the usual path, this is the API equivalent for scripting.

Env: NURIX_WORKSPACE_ID, NURIX_ADMIN_KEY

Usage:
  # list existing keys for a channel-connection
  python3 scripts/mint_widget_key.py --cc 254
  # mint a key scoped to a deployed domain
  python3 scripts/mint_widget_key.py --cc 254 --domain muthoot-frontend-production.up.railway.app
"""
import os, sys, json, argparse, urllib.request, urllib.error

WS = os.environ.get("NURIX_WORKSPACE_ID")
KEY = os.environ.get("NURIX_ADMIN_KEY")
BASE = os.environ.get("NURIX_AGENTX_HOST", "https://agentx-in.nurixlabs.tech")

def call(method, path, body=None):
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body else None, method=method)
    for k, v in {"workspace-id": WS, "x-admin-key": KEY, "x-api-key": KEY, "user-id": "mint"}.items():
        r.add_header(k, v)
    if body:
        r.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return None, str(e)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cc", required=True, help="channel-connection id (e.g. 254)")
    ap.add_argument("--domain", help="deployed frontend host to whitelist; omit to just list")
    a = ap.parse_args()
    if not WS or not KEY:
        sys.exit("set NURIX_WORKSPACE_ID and NURIX_ADMIN_KEY")
    if a.domain:
        c, b = call("POST", "/chat-widget/api-key", {"channel_connection_id": int(a.cc), "domain": a.domain})
        print(f"mint -> HTTP {c}: {b}")
    c, b = call("GET", f"/chat-widget/api-key?channel_con_id={a.cc}")
    print(f"current -> HTTP {c}: {b}")

if __name__ == "__main__":
    main()
