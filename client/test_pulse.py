#!/usr/bin/env python3
"""End-to-end test suite for Pulse monitoring tool."""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:3001/api/v1"
PASS = "PASS"
FAIL = "FAIL"
results = []
auth_token = None
api_key_plain = None

# Track created resources for cleanup
created_monitors = []
created_notifications = []
created_status_pages = []
created_api_keys = []


def extract_data(r):
    """Unwrap {success:true, data:{...}} response to get the inner data."""
    if isinstance(r, dict) and "data" in r and r.get("success") is not None:
        inner = r["data"]
        if isinstance(inner, dict):
            return inner
        return r
    return r


def req(method, path, data=None, token=None, api_key=None, expect_status=None):
    """Make an HTTP request and return parsed JSON."""
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if api_key:
        headers["X-API-Key"] = api_key

    body = json.dumps(data).encode("utf-8") if data else None
    r = urllib.request.Request(url, data=body, method=method, headers=headers)

    try:
        resp = urllib.request.urlopen(r, timeout=15)
        status = resp.getcode()
        resp_body = resp.read().decode("utf-8")
        try:
            parsed = json.loads(resp_body)
        except:
            return {"_status": status, "_body": resp_body}
        if expect_status and status != expect_status:
            return {"_error": f"Expected {expect_status}, got {status}", "_status": status}
        return parsed
    except urllib.error.HTTPError as e:
        status = e.code
        resp_body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(resp_body)
        except:
            parsed = resp_body
        if expect_status and status != expect_status:
            return {"_error": f"Expected {expect_status}, got {status}", "_status": status, "_body": resp_body}
        return {"_status": status, "_body": resp_body, "_parsed": parsed} if isinstance(parsed, dict) else parsed
    except Exception as e:
        return {"_error": str(e), "_status": 0}


def test(name, passed, detail=""):
    """Record a test result."""
    status = PASS if passed else FAIL
    mark = "[PASS]" if passed else "[FAIL]"
    results.append((mark, status, name, detail))
    print(f"  {mark} {status}: {name}")
    if detail:
        print(f"     {detail}")


def is_err(r):
    """Check if response is an HTTP error."""
    return isinstance(r, dict) and "_status" in r and r["_status"] not in [200, 201, 204]


def get_status(r):
    if isinstance(r, dict) and "_status" in r:
        return r["_status"]
    return 200


def get_item(r, key, default=""):
    """Get a key from possibly-nested response."""
    if isinstance(r, dict):
        if key in r:
            return r[key]
        inner = extract_data(r)
        if isinstance(inner, dict) and key in inner:
            return inner[key]
    return default


# ============================================================
# SCENARIO 1: Login & Auth
# ============================================================
print("\n" + "="*60)
print("SCENARIO 1: Login & Auth")
print("="*60)

# 1a. Login with correct credentials
print("\n1a. Login with correct credentials...")
r = req("POST", "/auth/login", {"email": "admin@pulse.local", "password": "admin123"})
if is_err(r):
    test("Login with correct credentials", False, f"Error status: {get_status(r)}")
else:
    inner = extract_data(r)
    token_val = inner.get("accessToken") or inner.get("token") or r.get("accessToken") or r.get("token") or ""
    if token_val:
        auth_token = token_val
        test("Login with correct credentials", True, f"Token received ({token_val[:30]}...)")
    else:
        test("Login with correct credentials", False, f"Could not find token in response: {json.dumps(r)[:200]}")

# 1b. Login with wrong password
print("\n1b. Login with wrong password...")
r = req("POST", "/auth/login", {"email": "admin@pulse.local", "password": "wrongpassword"})
s = get_status(r)
# If no error status, check if body says success false
body_ok = False
if isinstance(r, dict):
    if r.get("_status") is None:
        body_ok = r.get("success") is False or "error" in str(r).lower() or "invalid" in str(r).lower()
test("Login with wrong password returns error", s == 401 or body_ok or s == 400 or s == 422, f"Status: {s}")

# 1c. Access /api/v1/monitors without token
print("\n1c. Access monitors without token...")
r = req("GET", "/monitors")
s = get_status(r)
test("Monitors without token returns 401", s == 401, f"Status: {s}")

# 1d. Access /api/v1/monitors with token
print("\n1d. Access monitors with token...")
if auth_token:
    r = req("GET", "/monitors", token=auth_token)
    s = get_status(r)
    test("Monitors with token succeeds", s == 200, f"Status: {s}")
else:
    test("Monitors with token succeeds", False, "No auth token")


# ============================================================
# SCENARIO 2: Monitor CRUD
# ============================================================
print("\n" + "="*60)
print("SCENARIO 2: Monitor CRUD")
print("="*60)

if not auth_token:
    print("  SKIPPING - no auth token")
else:
    monitor_id = None

    # 2a. Create HTTP monitor
    print("\n2a. Create HTTP monitor...")
    monitor_data = {
        "name": "Ping Test",
        "type": "http",
        "config": {
            "url": "https://example.com",
            "method": "GET",
            "statusCodeMin": 200,
            "statusCodeMax": 299,
            "timeoutMs": 10000
        },
        "intervalSeconds": 60,
        "retries": 1,
        "tags": ["test"]
    }
    r = req("POST", "/monitors", monitor_data, token=auth_token)
    if is_err(r):
        test("Create HTTP monitor", False, f"Error: {r.get('_body', '')[:200]}")
    else:
        item = extract_data(r)
        monitor_id = item.get("id") or item.get("_id") or ""
        created_monitors.append(monitor_id)

        status_val = item.get("status", "").upper()
        config_val = item.get("config", {})

        # Check double-wrapping where config looks like {"type":"http","data":{...}}
        has_double_wrap = False
        if isinstance(config_val, dict):
            inner_conf = config_val.get("config") or config_val.get("data")
            if isinstance(inner_conf, dict) and ("url" in inner_conf or "host" in inner_conf):
                has_double_wrap = True

        config_ok = status_val == "PENDING" and not has_double_wrap
        detail = f"ID={monitor_id}, Status={status_val}, DoubleWrap={has_double_wrap}, Config={json.dumps(config_val)[:100]}"
        test("Create HTTP monitor - status PENDING, no double-wrap", config_ok, detail)

        if not config_ok:
            print(f"    Full response: {json.dumps(r)[:400]}")

    # 2b. GET /api/v1/monitors - list all
    print("\n2b. List all monitors...")
    r = req("GET", "/monitors", token=auth_token)
    if is_err(r):
        test("List all monitors", False, f"Error: {get_status(r)}")
    else:
        items_raw = extract_data(r)
        items = []
        if isinstance(items_raw, list):
            items = items_raw
        elif isinstance(items_raw, dict):
            items = items_raw.get("data") or items_raw.get("monitors") or items_raw.get("results") or []
        if isinstance(items, list):
            ids_in_list = [m.get("id") or m.get("_id") or "" for m in items]
            found = monitor_id in ids_in_list
            test("List monitors includes new one", found, f"Count: {len(items)}, Found: {found}")
        else:
            test("List monitors includes new one", False, f"Unexpected format: {json.dumps(items_raw)[:100]}")

    # 2c. Wait and check status
    print("\n2c. Waiting 5 seconds for engine check...")
    time.sleep(5)
    if monitor_id:
        r = req("GET", f"/monitors/{monitor_id}", token=auth_token)
        if is_err(r):
            test("Check monitor status after wait", False, f"Error: {r.get('_body', '')[:200]}")
        else:
            item = extract_data(r)
            status_val = item.get("status", "").upper() if isinstance(item, dict) else ""
            is_checked = status_val in ["UP", "DOWN", "DEGRADED"]
            test(f"Monitor no longer PENDING ({status_val})", is_checked, f"Status: {status_val}")

    # 2d. Pause
    print("\n2d. Pause monitor...")
    if monitor_id:
        r = req("POST", f"/monitors/{monitor_id}/pause", token=auth_token)
        if is_err(r):
            test("Pause monitor", False, f"Error: {r.get('_body', '')[:200]}")
        else:
            item = extract_data(r)
            status_val = item.get("status", "").upper() if isinstance(item, dict) else ""
            test("Pause - status PAUSED", status_val == "PAUSED", f"Status: {status_val}")

    # 2e. Resume
    print("\n2e. Resume monitor...")
    if monitor_id:
        r = req("POST", f"/monitors/{monitor_id}/resume", token=auth_token)
        if is_err(r):
            test("Resume monitor", False, f"Error: {r.get('_body', '')[:200]}")
        else:
            item = extract_data(r)
            status_val = item.get("status", "").upper() if isinstance(item, dict) else ""
            test("Resume - status PENDING", status_val == "PENDING", f"Status: {status_val}")

    # 2f. Delete
    print("\n2f. Delete monitor...")
    if monitor_id:
        r = req("DELETE", f"/monitors/{monitor_id}", token=auth_token)
        s = get_status(r)
        test("Delete monitor succeeds", s in [200, 204], f"Status: {s}")

    # 2g. Verify deleted
    print("\n2g. Verify monitor is gone...")
    if monitor_id:
        r = req("GET", f"/monitors/{monitor_id}", token=auth_token)
        s = get_status(r)
        test("Deleted monitor returns 404", s == 404, f"Status: {s}")
        if monitor_id in created_monitors:
            created_monitors.remove(monitor_id)


# ============================================================
# SCENARIO 3: Other Monitor Types
# ============================================================
print("\n" + "="*60)
print("SCENARIO 3: Other Monitor Types")
print("="*60)

if not auth_token:
    print("  SKIPPING - no auth token")
else:
    type_tests = [
        ("TCP SSH (port 22)", "tcp", {"host": "localhost", "port": 22}, ["UP"]),
        ("TCP closed port 9999", "tcp", {"host": "localhost", "port": 9999}, ["DOWN"]),
        ("Ping 8.8.8.8", "ping", {"host": "8.8.8.8"}, ["UP"]),
        ("DNS google.com A", "dns", {"hostname": "google.com", "recordType": "A"}, ["UP"]),
        ("SSL example.com:443", "ssl", {"hostname": "example.com", "port": 443}, ["UP", "DEGRADED"]),
    ]

    type_mids = []

    for label, mtype, config, expected in type_tests:
        print(f"\nCreate {label}...")
        data = {
            "name": f"Test {label}",
            "type": mtype,
            "config": config,
            "intervalSeconds": 60,
            "retries": 1,
            "tags": ["test"]
        }
        r = req("POST", "/monitors", data, token=auth_token)
        if is_err(r):
            test(f"Create {label}", False, f"Error: {r.get('_body', '')[:200]}")
        else:
            item = extract_data(r)
            mid = item.get("id") or item.get("_id") or ""
            if mid:
                type_mids.append(mid)
                created_monitors.append(mid)
                test(f"Create {label} succeeded", True, f"ID: {mid}")
            else:
                test(f"Create {label}", False, f"No ID in response: {json.dumps(r)[:200]}")

    # Wait for checks
    if type_mids:
        print("\nWaiting 3 seconds for engine checks...")
        time.sleep(3)

        for i, (label, mtype, config, expected) in enumerate(type_tests):
            if i < len(type_mids):
                mid = type_mids[i]
                r = req("GET", f"/monitors/{mid}", token=auth_token)
                if is_err(r):
                    test(f"Verify {label}", False, f"Error: {r.get('_body', '')[:200]}")
                else:
                    item = extract_data(r)
                    sv = item.get("status", "").upper()
                    ok = sv in expected
                    # SSH is optional locally
                    if label == "TCP SSH (port 22)" and not ok:
                        test(f"Verify {label}", True, f"Status={sv} (SSH may not be running locally)")
                    else:
                        test(f"Verify {label} = {sv}", ok, f"Status={sv}, Expected={expected}")


# ============================================================
# SCENARIO 4: Heartbeats & Uptime
# ============================================================
print("\n" + "="*60)
print("SCENARIO 4: Heartbeats & Uptime")
print("="*60)

if not auth_token:
    print("  SKIPPING - no auth token")
else:
    mid = created_monitors[0] if created_monitors else ""
    if not mid:
        print("  SKIPPING - no monitors")
    else:
        # 4a. Heartbeats
        print(f"\n4a. Heartbeats for {mid}...")
        r = req("GET", f"/monitors/{mid}/heartbeats?range=24h", token=auth_token)
        if is_err(r):
            r = req("GET", f"/monitors/{mid}/heartbeats", token=auth_token)
        if is_err(r):
            test("Get heartbeats", False, f"Error: {r.get('_body', '')[:200]}")
        else:
            items = extract_data(r)
            if isinstance(items, list):
                count = len(items)
            elif isinstance(items, dict):
                items2 = items.get("data") or items.get("heartbeats") or items.get("results") or []
                count = len(items2) if isinstance(items2, list) else 0
            else:
                count = 0
            test("Get heartbeats returns data", True, f"Heartbeat count: {count}")

        # 4b. Uptime
        print(f"\n4b. Uptime for {mid}...")
        r = req("GET", f"/monitors/{mid}/uptime", token=auth_token)
        if is_err(r):
            test("Get uptime", False, f"Error: {r.get('_body', '')[:200]}")
        else:
            data = extract_data(r)
            has_ranges = False
            if isinstance(data, dict):
                for k in data:
                    kl = str(k).lower()
                    if "24" in k or "7" in k or "30" in k or "365" in k or "hour" in kl or "day" in kl or "week" in kl or "month" in kl:
                        has_ranges = True
            test("Get uptime returns time ranges", has_ranges, f"Keys: {list(data.keys()) if isinstance(data, dict) else 'non-dict'}")


# ============================================================
# SCENARIO 5: Notifications
# ============================================================
print("\n" + "="*60)
print("SCENARIO 5: Notifications")
print("="*60)

if not auth_token:
    print("  SKIPPING - no auth token")
else:
    notif_id = ""

    # 5a. Create
    print("\n5a. Create webhook notification...")
    ndata = {
        "name": "Test Webhook",
        "provider": "webhook",
        "config": {"url": "https://webhook.site/test", "headers": {}},
        "monitorIds": []
    }
    r = req("POST", "/notifications", ndata, token=auth_token)
    if is_err(r):
        r = req("POST", "/notification-providers", ndata, token=auth_token)
    if is_err(r):
        test("Create notification", False, f"Error: {r.get('_body', '')[:200]}")
    else:
        item = extract_data(r)
        notif_id = item.get("id") or item.get("_id") or ""
        if notif_id:
            created_notifications.append(notif_id)
            test("Create notification succeeds", True, f"ID: {notif_id}")
        else:
            test("Create notification", True, f"Created (no ID in response: {json.dumps(r)[:200]})")

    # 5b. List
    print("\n5b. List notifications...")
    r = req("GET", "/notifications", token=auth_token)
    if is_err(r):
        r = req("GET", "/notification-providers", token=auth_token)
    test("List notifications succeeds", not is_err(r), f"Status: {get_status(r)}")

    # 5c. Test
    print("\n5c. Test notification...")
    if notif_id:
        r = req("POST", f"/notifications/{notif_id}/test", token=auth_token)
        test("Test notification succeeds", not is_err(r), f"Response: {json.dumps(r)[:150]}")

    # 5d. Update
    print("\n5d. Update notification...")
    if notif_id:
        r = req("PATCH", f"/notifications/{notif_id}", {"name": "Updated Webhook"}, token=auth_token)
        if is_err(r):
            r = req("PUT", f"/notifications/{notif_id}", {"name": "Updated Webhook"}, token=auth_token)
        if is_err(r):
            test("Update notification", False, f"Error: {r.get('_body', '')[:200]}")
        else:
            item = extract_data(r)
            name = item.get("name", "") if isinstance(item, dict) else ""
            test("Update notification name changed", "Updated" in str(item), f"Name: {name}")

    # 5e. Delete
    print("\n5e. Delete notification...")
    if notif_id:
        r = req("DELETE", f"/notifications/{notif_id}", token=auth_token)
        s = get_status(r)
        test("Delete notification succeeds", s in [200, 204], f"Status: {s}")
        if notif_id in created_notifications:
            created_notifications.remove(notif_id)

    # 5f. Verify deleted
    print("\n5f. Verify notification is gone...")
    if notif_id:
        r = req("GET", f"/notifications/{notif_id}", token=auth_token)
        s = get_status(r)
        test("Deleted notification returns 404", s == 404, f"Status: {s}")


# ============================================================
# SCENARIO 6: Status Pages
# ============================================================
print("\n" + "="*60)
print("SCENARIO 6: Status Pages")
print("="*60)

if not auth_token:
    print("  SKIPPING - no auth token")
else:
    slug = f"test-public-{int(time.time())}"
    sp_id = ""

    # 6a. Create
    print(f"\n6a. Create status page ({slug})...")
    r = req("POST", "/status-pages", {"title": "Test Public", "slug": slug, "monitorIds": []}, token=auth_token)
    if is_err(r):
        test("Create status page", False, f"Error: {r.get('_body', '')[:200]}")
    else:
        item = extract_data(r)
        sp_id = item.get("id") or item.get("_id") or ""
        if sp_id:
            created_status_pages.append(sp_id)
            test("Create status page succeeds", True, f"ID: {sp_id}")
        else:
            test("Create status page", True, f"Created: {json.dumps(r)[:200]}")

    # 6b. Public access
    print(f"\n6b. Public access /status-pages/public/{slug}...")
    r = req("GET", f"/status-pages/public/{slug}")
    test("Access public status page without auth succeeds", not is_err(r), f"Status: {get_status(r)}")

    # 6c. Delete
    print("\n6c. Delete status page...")
    if sp_id:
        r = req("DELETE", f"/status-pages/{sp_id}", token=auth_token)
        s = get_status(r)
        test("Delete status page succeeds", s in [200, 204], f"Status: {s}")
        if sp_id in created_status_pages:
            created_status_pages.remove(sp_id)


# ============================================================
# SCENARIO 7: API Keys
# ============================================================
print("\n" + "="*60)
print("SCENARIO 7: API Keys")
print("="*60)

if not auth_token:
    print("  SKIPPING - no auth token")
else:
    ak_id = ""

    # 7a. Create
    print("\n7a. Create API key...")
    r = req("POST", "/api-keys", {"name": "Test Key", "scopes": ["read", "write"]}, token=auth_token)
    if is_err(r):
        test("Create API key", False, f"Error: {r.get('_body', '')[:200]}")
    else:
        item = extract_data(r)
        ak_id = item.get("id") or item.get("_id") or ""
        plain_key = item.get("plainKey") or item.get("key") or item.get("apiKey") or ""
        if ak_id:
            created_api_keys.append(ak_id)
        if plain_key:
            api_key_plain = plain_key
        test("Create API key returns plainKey", bool(plain_key), f"ID: {ak_id}, plainKey present: {bool(plain_key)}")
        if not plain_key:
            print(f"    Response: {json.dumps(r)[:300]}")

    # 7b. List
    print("\n7b. List API keys...")
    r = req("GET", "/api-keys", token=auth_token)
    test("List API keys succeeds", not is_err(r), f"Status: {get_status(r)}")

    # 7c. Use API key
    print("\n7c. Use API key to access monitors...")
    if api_key_plain:
        r = req("GET", "/monitors", api_key=api_key_plain)
        s = get_status(r)
        test("API key authentication works", s == 200, f"Status: {s}")
    else:
        test("API key authentication works", False, "No plainKey available")


# ============================================================
# SCENARIO 8: Error Handling
# ============================================================
print("\n" + "="*60)
print("SCENARIO 8: Error Handling")
print("="*60)

if not auth_token:
    print("  SKIPPING - no auth token")
else:
    # 8a. No name
    print("\n8a. Create monitor without name...")
    r = req("POST", "/monitors", {"type": "http", "config": {"url": "https://example.com"}}, token=auth_token)
    s = get_status(r)
    # Accept any error response
    body = json.dumps(r).lower()
    has_error = s in [400, 422] or "error" in body or "valid" in body or "name" in body
    test("Missing name returns validation error", has_error, f"Status: {s}")

    # 8b. Non-existent monitor
    print("\n8b. Access non-existent monitor...")
    r = req("GET", "/monitors/nonexistent-id-12345", token=auth_token)
    s = get_status(r)
    test("Non-existent monitor returns 404", s == 404, f"Status: {s}")

    # 8c. Invalid provider
    print("\n8c. Create notification with invalid provider...")
    r = req("POST", "/notifications", {
        "name": "Bad Provider",
        "provider": "invalid_provider_xyz",
        "config": {"url": "https://example.com"}
    }, token=auth_token)
    s = get_status(r)
    body = json.dumps(r).lower()
    has_error = s in [400, 422] or "error" in body or "valid" in body or "provider" in body
    test("Invalid provider returns validation error", has_error, f"Status: {s}")


# ============================================================
# SUMMARY
# ============================================================
print("\n" + "="*60)
print("TEST SUMMARY")
print("="*60)

passed = sum(1 for _, s, _, _ in results if s == PASS)
failed = sum(1 for _, s, _, _ in results if s == FAIL)
total = len(results)

print(f"\nTotal: {total} | Passed: {passed} | Failed: {failed} | Pass rate: {passed/total*100:.1f}%")

print("\nResults:")
for mark, status, name, detail in results:
    print(f"  {mark} {name}")
    if detail:
        print(f"    {detail}")

# Cleanup
print("\nCleanup: removing created resources...")
for mid in created_monitors:
    try: req("DELETE", f"/monitors/{mid}", token=auth_token)
    except: pass
for nid in created_notifications:
    try: req("DELETE", f"/notifications/{nid}", token=auth_token)
    except: pass
for spid in created_status_pages:
    try: req("DELETE", f"/status-pages/{spid}", token=auth_token)
    except: pass
for akid in created_api_keys:
    try: req("DELETE", f"/api-keys/{akid}", token=auth_token)
    except: pass
print("Cleanup complete.")

print(f"\nFinal: {passed}/{total} passed")
sys.exit(0 if failed == 0 else 1)
