#!/usr/bin/env python3
"""
Discover Nurix agents, channel-connections, and widget API keys for a workspace.

Reads the values you need to wire the frontend hooks (agent_id, channel-connection-id,
account_id) and repoint workflows. Read-only.

Env:
  NURIX_WORKSPACE_ID   the client's workspace uuid
  NURIX_ADMIN_KEY      agentx admin/discovery key (x-admin-key)

Usage:
  NURIX_WORKSPACE_ID=... NURIX_ADMIN_KEY=... python3 scripts/nurix_discover.py
"""
import os, sys, json, urllib.request, urllib.error

WS = os.environ.get("NURIX_WORKSPACE_ID")
KEY = os.environ.get("NURIX_ADMIN_KEY")
BASE = os.environ.get("NURIX_AGENTX_HOST", "https://agentx-in.nurixlabs.tech")
if not WS or not KEY:
    sys.exit("set NURIX_WORKSPACE_ID and NURIX_ADMIN_KEY")

def get(path):
    r = urllib.request.Request(BASE + path)
    for k, v in {"workspace-id": WS, "x-admin-key": KEY, "x-api-key": KEY, "user-id": "discover"}.items():
        r.add_header(k, v)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as e:
        return None, str(e)

def as_list(d, *keys):
    if isinstance(d, list):
        return d
    for k in keys:
        if isinstance(d, dict) and isinstance(d.get(k), list):
            return d[k]
    return []

print(f"workspace {WS}\n")

c, agents = get("/agent/list")
print(f"# Agents  (/agent/list -> {c})")
for a in as_list(agents, "agents", "data", "items"):
    if isinstance(a, dict):
        print(f"  {str(a.get('agent_type','?')):6} {a.get('agent_id')}  {a.get('agent_name')}")

c, conns = get("/channels/connections/")
print(f"\n# Channel connections  (/channels/connections/ -> {c})")
for cc in as_list(conns, "data", "connections", "items"):
    if not isinstance(cc, dict):
        continue
    ccid = cc.get("id")
    _, wk = get(f"/chat-widget/api-key?channel_con_id={ccid}")
    data = wk.get("data") if isinstance(wk, dict) else None
    widget_key = data.get("api_key") if isinstance(data, dict) else None
    print(f"  cc={ccid}  agent={cc.get('agent_id')}  account={cc.get('account_id')}  name={cc.get('channel_connection_name')!r}")
    print(f"       gateway_api_key={cc.get('gateway_api_key')}  widget_api_key={widget_key}")
