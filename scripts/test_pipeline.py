import sys
import time
import json
import requests

BASE_URL = "http://127.0.0.1:8000"

def log_step(step_num: int, title: str):
    print(f"\n[{step_num}] {title}")
    print("-" * 65)

def pass_step(message: str):
    print(f"    PASS: {message}")

def fail_step(message: str):
    print(f"    FAIL: {message}")
    sys.exit(1)

def run_pipeline_test():
    print("=" * 70)
    print(" AEDIRS END-TO-END BACKEND PIPELINE VERIFICATION")
    print("=" * 70)

    # Health check
    try:
        health = requests.get(f"{BASE_URL}/openapi.json", timeout=5)
        if health.status_code != 200:
            fail_step(f"Server is not healthy, status {health.status_code}")
    except Exception as e:
        fail_step(f"Cannot reach server at {BASE_URL}: {e}")

    ts = int(time.time())
    admin_email = f"admin_{ts}@aedirs-test.org"
    rescue_email = f"rescue_{ts}@aedirs-test.org"
    password = "PipelineTestPassword2026!"

    # -------------------------------------------------------------------------
    # 1. Register admin & rescue_team users
    # -------------------------------------------------------------------------
    log_step(1, "Registering Admin & Rescue Team Users via POST /auth/register")
    
    # Admin registration
    admin_reg_res = requests.post(
        f"{BASE_URL}/auth/register",
        json={"name": f"Admin User {ts}", "email": admin_email, "password": password, "role": "admin"}
    )
    assert admin_reg_res.status_code == 201, f"Admin registration failed: {admin_reg_res.text}"
    admin_id = admin_reg_res.json()["id"]
    pass_step(f"Registered Admin User (ID: {admin_id}, Email: {admin_email})")

    # Rescue Team registration
    rescue_reg_res = requests.post(
        f"{BASE_URL}/auth/register",
        json={"name": f"Rescue Team {ts}", "email": rescue_email, "password": password, "role": "rescue_team"}
    )
    assert rescue_reg_res.status_code == 201, f"Rescue team registration failed: {rescue_reg_res.text}"
    rescue_id = rescue_reg_res.json()["id"]
    pass_step(f"Registered Rescue Team User (ID: {rescue_id}, Email: {rescue_email})")

    # -------------------------------------------------------------------------
    # 2. Login & Extract JWT Access Tokens
    # -------------------------------------------------------------------------
    log_step(2, "Logging In via POST /auth/login and Extracting JWT Tokens")

    admin_login_res = requests.post(f"{BASE_URL}/auth/login", data={"username": admin_email, "password": password})
    assert admin_login_res.status_code == 200, f"Admin login failed: {admin_login_res.text}"
    admin_token = admin_login_res.json()["access_token"]
    pass_step(f"Admin Token extracted: {admin_token[:28]}...")

    rescue_login_res = requests.post(f"{BASE_URL}/auth/login", data={"username": rescue_email, "password": password})
    assert rescue_login_res.status_code == 200, f"Rescue login failed: {rescue_login_res.text}"
    rescue_token = rescue_login_res.json()["access_token"]
    pass_step(f"Rescue Team Token extracted: {rescue_token[:28]}...")

    # Dismiss any prior matching test incidents to ensure test idempotency
    try:
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        existing_res = requests.get(f"{BASE_URL}/dashboard/admin", headers=admin_headers)
        if existing_res.status_code == 200:
            for inc in existing_res.json():
                if "Pune Station" in inc.get("text", "") and inc.get("status") != "dismissed":
                    requests.patch(f"{BASE_URL}/incidents/{inc['id']}/status", json={"new_status": "dismissed"})
    except Exception:
        pass

    # -------------------------------------------------------------------------
    # 3. Submit Report 1
    # -------------------------------------------------------------------------
    log_step(3, "Submitting Primary Emergency Report 1 via POST /process_report")
    text_1 = "Major flooding near Pune Station, elderly people trapped in houses!"
    print(f"    Payload text: \"{text_1}\"")

    rep1_res = requests.post(f"{BASE_URL}/process_report", json={"text": text_1, "reporter_id": rescue_id})
    assert rep1_res.status_code == 201, f"Report 1 submission failed: {rep1_res.text}"
    rep1_data = rep1_res.json()
    rep1_id = rep1_data["id"]
    pass_step(f"Incident #{rep1_id} created successfully")

    # -------------------------------------------------------------------------
    # 4. Verify Report 1 Properties
    # -------------------------------------------------------------------------
    log_step(4, "Verifying Report 1: Status, Priority, Coordinates & Tactical AI Notes")
    print(f"    Status:         {rep1_data.get('status')}")
    print(f"    Priority:       {rep1_data.get('priority')}")
    print(f"    Severity Score: {rep1_data.get('severity_score')}")
    print(f"    Latitude:       {rep1_data.get('latitude')}")
    print(f"    Longitude:      {rep1_data.get('longitude')}")
    print(f"    Recommendation: {rep1_data.get('ai_recommendation')}")

    assert rep1_data["status"] == "pending", f"Expected status 'pending', got '{rep1_data['status']}'"
    pass_step("Report 1 status is 'pending'")

    assert rep1_data["priority"] in ["High", "Critical"], f"Expected High or Critical priority, got '{rep1_data['priority']}'"
    pass_step(f"Report 1 priority is '{rep1_data['priority']}'")

    assert rep1_data.get("latitude") is not None and rep1_data.get("longitude") is not None, "Coordinates missing"
    pass_step(f"Report 1 geocoded at ({rep1_data['latitude']}, {rep1_data['longitude']})")

    ai_rec = rep1_data.get("ai_recommendation")
    assert ai_rec is not None, "ai_recommendation field is missing"
    # Check if recommendation has tactical notes
    rec_json = {}
    try:
        rec_json = json.loads(ai_rec) if isinstance(ai_rec, str) else ai_rec
    except Exception:
        pass
    tactical_note = rec_json.get("tactical_action") or ai_rec
    assert tactical_note, "Tactical guidance note is missing from ai_recommendation"
    pass_step(f"Report 1 tactical guidance present: \"{tactical_note}\"")

    # -------------------------------------------------------------------------
    # 5. Submit Report 2 (Semantic Duplicate)
    # -------------------------------------------------------------------------
    log_step(5, "Submitting Semantically Identical Report 2 via POST /process_report")
    text_2 = "Water logging at Pune Station, folks stuck inside homes"
    print(f"    Payload text: \"{text_2}\"")

    rep2_res = requests.post(f"{BASE_URL}/process_report", json={"text": text_2, "reporter_id": rescue_id})
    assert rep2_res.status_code == 201, f"Report 2 submission failed: {rep2_res.text}"
    rep2_data = rep2_res.json()
    rep2_id = rep2_data["id"]
    pass_step(f"Incident #{rep2_id} created successfully")

    # -------------------------------------------------------------------------
    # 6. Verify Report 2 Duplicate Status & Inherited Severity
    # -------------------------------------------------------------------------
    log_step(6, "Verifying Report 2 Duplicate Linking & Severity Score Inheritance")
    expected_status = f"duplicate_of_{rep1_id}"
    print(f"    Report 2 Status:         {rep2_data.get('status')} (Expected: '{expected_status}')")
    print(f"    Report 2 Severity Score: {rep2_data.get('severity_score')} (Report 1: {rep1_data.get('severity_score')})")

    assert rep2_data["status"] == expected_status, (
        f"Expected status '{expected_status}', got '{rep2_data['status']}'"
    )
    pass_step(f"Report 2 correctly linked as '{expected_status}'")

    assert abs(rep2_data["severity_score"] - rep1_data["severity_score"]) < 0.01, (
        f"Severity mismatch: Report 2 has {rep2_data['severity_score']} vs Report 1 {rep1_data['severity_score']}"
    )
    pass_step(f"Report 2 inherited severity score {rep2_data['severity_score']} from Report 1")

    # -------------------------------------------------------------------------
    # 7. Query GET /dashboard/public (without token)
    # -------------------------------------------------------------------------
    log_step(7, "Querying GET /dashboard/public (Public Access, No Token)")
    pub_res = requests.get(f"{BASE_URL}/dashboard/public")
    assert pub_res.status_code == 200, f"Public dashboard failed with status {pub_res.status_code}: {pub_res.text}"
    pub_incidents = pub_res.json()
    pass_step(f"GET /dashboard/public returned 200 OK ({len(pub_incidents)} public incidents visible)")
    
    # Verify non-sensitive fields
    if pub_incidents:
        keys = set(pub_incidents[0].keys())
        expected_keys = {"id", "category", "priority", "latitude", "longitude", "created_at"}
        assert keys == expected_keys, f"Public feed contains unexpected fields: {keys}"
        pass_step(f"Verified public fields match Leaflet requirements: {keys}")

    # -------------------------------------------------------------------------
    # 8. Query GET /dashboard/admin (with admin token)
    # -------------------------------------------------------------------------
    log_step(8, "Querying GET /dashboard/admin (Admin Access, Token Required)")
    admin_dash_res = requests.get(f"{BASE_URL}/dashboard/admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert admin_dash_res.status_code == 200, f"Admin dashboard failed with status {admin_dash_res.status_code}: {admin_dash_res.text}"
    admin_incidents = admin_dash_res.json()
    admin_incident_ids = [inc["id"] for inc in admin_incidents]
    pass_step(f"GET /dashboard/admin returned 200 OK ({len(admin_incidents)} total incidents)")

    assert rep1_id in admin_incident_ids, f"Report 1 (ID {rep1_id}) missing from admin dashboard"
    pass_step(f"Incident #{rep1_id} is visible in admin dashboard")

    assert rep2_id in admin_incident_ids, f"Report 2 (ID {rep2_id}) missing from admin dashboard"
    pass_step(f"Incident #{rep2_id} (duplicate) is visible in admin dashboard")

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print(" ALL BACKEND MILESTONES END-TO-END TESTS PASSED SUCCESSFULLY! ")
    print("=" * 70)
    print(f" 1. Admin & Rescue Team Accounts Registered")
    print(f" 2. JWT Access Tokens Acquired")
    print(f" 3. Primary Incident #{rep1_id} Ingested & Triaged (Status: 'pending', Priority: '{rep1_data['priority']}')")
    print(f" 4. Coordinates Geocoded ({rep1_data['latitude']}, {rep1_data['longitude']}) & Tactical Guidance Populated")
    print(f" 5. Duplicate Incident #{rep2_id} Identified & Linked ('{expected_status}')")
    print(f" 6. Severity Score ({rep1_data['severity_score']}) Inherited Accurately")
    print(f" 7. Public Dashboard Accessible Without Token (Sanitized Fields)")
    print(f" 8. Admin Dashboard Verified With Role Auth (Both Incidents Visible)")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    try:
        run_pipeline_test()
    except Exception as e:
        print(f"\n Execution failed: {e}", file=sys.stderr)
        sys.exit(1)
