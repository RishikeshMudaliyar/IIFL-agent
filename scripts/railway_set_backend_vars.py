#!/usr/bin/env python3
"""
Push backend env vars from a run-env.yaml to a Railway service, with cross-ref overrides.

Run from the repo dir (must be `railway link`ed / `railway init`ed). Requires the
`railway` CLI, authenticated.

NOTE: the committed backend/run-env.yaml has PLACEHOLDER secrets. Point --run-env at a
local copy holding the REAL secret values, or set the secret vars manually afterwards.

Usage:
  python3 scripts/railway_set_backend_vars.py --service muthoot-backend \
      --run-env backend/run-env.yaml \
      --form-url https://muthoot-frontend-production.up.railway.app/loan-application \
      --backend-url https://muthoot-backend-production.up.railway.app
"""
import argparse, subprocess, sys

def parse_env(path):
    out = {}
    for line in open(path):
        line = line.rstrip("\n")
        if not line or line.lstrip().startswith("#") or ":" not in line:
            continue
        k, v = line.split(":", 1)
        k, v = k.strip(), v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
            v = v[1:-1]
        if k:
            out[k] = v
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--service", required=True)
    ap.add_argument("--run-env", default="backend/run-env.yaml")
    ap.add_argument("--form-url", help="FORM_URL (deployed frontend /loan-application)")
    ap.add_argument("--backend-url", help="sets API_BASE_URL and WEBSOCKET_URL")
    ap.add_argument("--dry-run", action="store_true", help="print the vars that would be set; do not call railway")
    a = ap.parse_args()

    env = parse_env(a.run_env)
    if a.form_url:
        env["FORM_URL"] = a.form_url
    if a.backend_url:
        b = a.backend_url.rstrip("/")
        env["API_BASE_URL"] = b
        env["WEBSOCKET_URL"] = "wss://" + b.split("://", 1)[-1] + "/ws"

    placeholders = [k for k, v in env.items() if v == "SET_IN_RAILWAY"]
    if placeholders:
        print(f"WARNING: still placeholder (edit run-env or set manually): {placeholders}")

    secret = {"DB_PASSWORD", "TWILIO_AUTH_TOKEN", "TWILIO_ACCOUNT_SID", "SMSLOCAL_API_KEY"}
    if a.dry_run:
        print(f"[dry-run] would set {len(env)} vars on {a.service}:")
        for k, v in env.items():
            print(f"    {k}={'***' if k in secret else v}")
        return
    args = ["railway", "variables", "--service", a.service]
    for k, v in env.items():
        args += ["--set", f"{k}={v}"]
    print(f"setting {len(env)} vars on {a.service} ...")
    r = subprocess.run(args, capture_output=True, text=True)
    print(r.returncode, (r.stdout or r.stderr)[-300:])
    sys.exit(r.returncode)

if __name__ == "__main__":
    main()
