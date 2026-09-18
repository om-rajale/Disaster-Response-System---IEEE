import sys
import time
import requests

BASE_URL = "http://127.0.0.1:8000"


def print_summary_table(results):
    col_w = [4, 44, 8, 38]
    sep = f"+-{'-'*col_w[0]}-+-{'-'*col_w[1]}-+-{'-'*col_w[2]}-+-{'-'*col_w[3]}-+"
    header = f"| {'#':<{col_w[0]}} | {'Test Requirement':<{col_w[1]}} | {'Status':<{col_w[2]}} | {'Details':<{col_w[3]}} |"
    
    print("\n" + "=" * 102)
    print("                      AEDIRS PIPELINE VERIFICATION RESULTS SUMMARY")
    print("=" * 102)
    print(sep)
    print(header)
    print(sep)
    for r in results:
        idx = str(r.get("id", ""))
        name = str(r.get("name", ""))[:col_w[1]]
        status = str(r.get("status", ""))
        details = str(r.get("details", ""))[:col_w[3]]
        print(f"| {idx:<{col_w[0]}} | {name:<{col_w[1]}} | {status:<{col_w[2]}} | {details:<{col_w[3]}} |")
    print(sep + "\n")


def run_pipeline_verification():
    results = []
    
    # Pre-check: server health
    try:
        health_check = requests.get(f"{BASE_URL}/openapi.json", timeout=5)
        if health_check.status_code != 200:
            print(f"[!] Warning: Server returned status {health_check.status_code} on openapi.json")
    except Exception as e:
        print(f"[ERROR] Cannot connect to {BASE_URL}. Ensure the backend server is running.\nDetails: {e}")
        sys.exit(1)

    ts = int(time.time())
    admin_email = f"admin_{ts}@aedirs.org"
    rescue_email = f"rescue_{ts}@aedirs.org"
    password = "TestPassword2026!"

    admin_id = None
    rescue_id = None
    admin_token = None
    rescue_token = None
    incident1_id = None
    incident1_score = None

    # -------------------------------------------------------------------------
    # 1. Register admin and rescue_team user via POST /auth/register
    # -------------------------------------------------------------------------
    try:
        admin_res = requests.post(
            f"{BASE_URL}/auth/register",
            json={"name": f"Admin {ts}", "email": admin_email, "password": password, "role": "admin"}
        )
        assert admin_res.status_code == 201, f"Admin register failed: {admin_res.status_code} {admin_res.text}"
        admin_id = admin_res.json()["id"]

        rescue_res = requests.post(
            f"{BASE_URL}/auth/register",
            json={"name": f"Rescue {ts}", "email": rescue_email, "password": password, "role": "rescue_team"}
        )
        assert rescue_res.status_code == 201, f"Rescue register failed: {rescue_res.status_code} {rescue_res.text}"
        rescue_id = rescue_res.json()["id"]

        results.append({
            "id": 1,
            "name": "Register Admin & Rescue Users",
            "status": "PASS",
            "details": f"Admin ID: {admin_id}, Rescue ID: {rescue_id}"
        })
    except Exception as e:
        results.append({
            "id": 1,
            "name": "Register Admin & Rescue Users",
            "status": "FAIL",
            "details": str(e)
        })
        print_summary_table(results)
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 2. Log in via POST /auth/login and retrieve JWT tokens
    # -------------------------------------------------------------------------
    try:
        admin_login = requests.post(
            f"{BASE_URL}/auth/login",
            data={"username": admin_email, "password": password}
        )
        assert admin_login.status_code == 200, f"Admin login failed: {admin_login.status_code} {admin_login.text}"
        admin_token = admin_login.json()["access_token"]
        assert admin_token, "Admin access token empty"

        rescue_login = requests.post(
            f"{BASE_URL}/auth/login",
            data={"username": rescue_email, "password": password}
        )
        assert rescue_login.status_code == 200, f"Rescue login failed: {rescue_login.status_code} {rescue_login.text}"
        rescue_token = rescue_login.json()["access_token"]
        assert rescue_token, "Rescue access token empty"

        results.append({
            "id": 2,
            "name": "Login & Retrieve JWT Tokens",
            "status": "PASS",
            "details": f"Acquired JWTs for Admin & Rescue"
        })
    except Exception as e:
        results.append({
            "id": 2,
            "name": "Login & Retrieve JWT Tokens",
            "status": "FAIL",
            "details": str(e)
        })
        print_summary_table(results)
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 3. Submit a critical report via POST /process_report
    #    Verify: status="pending", score >= 50, priority is High/Critical, coords exist
    # -------------------------------------------------------------------------
    try:
        report1_text = f"Major building collapse near Swargate {ts}, multiple injured trapped under rubble!"
        rep1_res = requests.post(
            f"{BASE_URL}/process_report",
            json={"text": report1_text, "reporter_id": rescue_id}
        )
        assert rep1_res.status_code == 201, f"Report 1 submission failed: {rep1_res.status_code} {rep1_res.text}"
        rep1_data = rep1_res.json()
        incident1_id = rep1_data["id"]
        incident1_score = rep1_data.get("severity_score", 0.0)
        status_val = rep1_data.get("status")
        priority_val = rep1_data.get("priority")
        lat = rep1_data.get("latitude")
        lon = rep1_data.get("longitude")

        assert status_val == "pending", f"Expected status='pending', got '{status_val}'"
        assert incident1_score >= 50.0, f"Expected score >= 50, got {incident1_score}"
        assert priority_val in ["High", "Critical"], f"Expected High or Critical, got '{priority_val}'"
        assert lat is not None and lon is not None, f"Coordinates missing: lat={lat}, lon={lon}"

        results.append({
            "id": 3,
            "name": "Submit Critical Incident Report",
            "status": "PASS",
            "details": f"ID: {incident1_id}, Score: {incident1_score}, {priority_val}"
        })
    except Exception as e:
        results.append({
            "id": 3,
            "name": "Submit Critical Incident Report",
            "status": "FAIL",
            "details": str(e)
        })
        print_summary_table(results)
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 4. Submit semantically similar report & verify duplicate + inherited severity
    # -------------------------------------------------------------------------
    try:
        report2_text = f"Structure fell down near Swargate {ts}, people stuck in debris and hurt"
        rep2_res = requests.post(
            f"{BASE_URL}/process_report",
            json={"text": report2_text, "reporter_id": rescue_id}
        )
        assert rep2_res.status_code == 201, f"Report 2 submission failed: {rep2_res.status_code} {rep2_res.text}"
        rep2_data = rep2_res.json()
        incident2_id = rep2_data["id"]
        status2_val = rep2_data.get("status")
        score2_val = rep2_data.get("severity_score")
        expected_status = f"duplicate_of_{incident1_id}"

        assert status2_val == expected_status, f"Expected '{expected_status}', got '{status2_val}'"
        assert abs(score2_val - incident1_score) < 0.01, (
            f"Inherited score mismatch: {score2_val} vs {incident1_score}"
        )

        results.append({
            "id": 4,
            "name": "Duplicate Detection & Score Inherit",
            "status": "PASS",
            "details": f"ID: {incident2_id} -> {expected_status}"
        })
    except Exception as e:
        results.append({
            "id": 4,
            "name": "Duplicate Detection & Score Inherit",
            "status": "FAIL",
            "details": str(e)
        })
        print_summary_table(results)
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 5. Query GET /dashboard/public without token (assert 200 OK)
    # -------------------------------------------------------------------------
    try:
        pub_res = requests.get(f"{BASE_URL}/dashboard/public")
        assert pub_res.status_code == 200, f"Public dashboard failed: {pub_res.status_code} {pub_res.text}"
        pub_data = pub_res.json()
        assert isinstance(pub_data, list), "Public dashboard must return a list"

        results.append({
            "id": 5,
            "name": "Public Dashboard (No Token)",
            "status": "PASS",
            "details": f"200 OK, {len(pub_data)} public incidents returned"
        })
    except Exception as e:
        results.append({
            "id": 5,
            "name": "Public Dashboard (No Token)",
            "status": "FAIL",
            "details": str(e)
        })
        print_summary_table(results)
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 6. Query GET /dashboard/rescue with rescue token (assert 200 OK)
    # -------------------------------------------------------------------------
    try:
        rescue_res = requests.get(
            f"{BASE_URL}/dashboard/rescue",
            headers={"Authorization": f"Bearer {rescue_token}"}
        )
        assert rescue_res.status_code == 200, f"Rescue dashboard failed: {rescue_res.status_code} {rescue_res.text}"
        rescue_data = rescue_res.json()
        assert isinstance(rescue_data, list), "Rescue dashboard must return a list"

        results.append({
            "id": 6,
            "name": "Rescue Dashboard (Rescue Token)",
            "status": "PASS",
            "details": f"200 OK, {len(rescue_data)} active incidents returned"
        })
    except Exception as e:
        results.append({
            "id": 6,
            "name": "Rescue Dashboard (Rescue Token)",
            "status": "FAIL",
            "details": str(e)
        })
        print_summary_table(results)
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 7. Query GET /dashboard/admin with admin token (assert 200 OK)
    # -------------------------------------------------------------------------
    try:
        admin_dash_res = requests.get(
            f"{BASE_URL}/dashboard/admin",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert admin_dash_res.status_code == 200, f"Admin dashboard failed: {admin_dash_res.status_code} {admin_dash_res.text}"
        admin_data = admin_dash_res.json()
        assert isinstance(admin_data, list), "Admin dashboard must return a list"

        admin_ids = [inc.get("id") for inc in admin_data]
        assert incident1_id in admin_ids, f"Incident {incident1_id} missing from admin dashboard"

        results.append({
            "id": 7,
            "name": "Admin Dashboard (Admin Token)",
            "status": "PASS",
            "details": f"200 OK, {len(admin_data)} total incidents visible"
        })
    except Exception as e:
        results.append({
            "id": 7,
            "name": "Admin Dashboard (Admin Token)",
            "status": "FAIL",
            "details": str(e)
        })
        print_summary_table(results)
        sys.exit(1)

    # -------------------------------------------------------------------------
    # 8. Update incident status via PATCH /incidents/{id}/status to "in_progress"
    # -------------------------------------------------------------------------
    try:
        patch_res = requests.patch(
            f"{BASE_URL}/incidents/{incident1_id}/status",
            json={"new_status": "in_progress"}
        )
        assert patch_res.status_code == 200, f"Status update failed: {patch_res.status_code} {patch_res.text}"
        updated_data = patch_res.json()
        assert updated_data.get("status") == "in_progress", (
            f"Expected status 'in_progress', got '{updated_data.get('status')}'"
        )

        results.append({
            "id": 8,
            "name": "Status Transition to 'in_progress'",
            "status": "PASS",
            "details": f"Incident #{incident1_id} updated successfully"
        })
    except Exception as e:
        results.append({
            "id": 8,
            "name": "Status Transition to 'in_progress'",
            "status": "FAIL",
            "details": str(e)
        })
        print_summary_table(results)
        sys.exit(1)

    # Print final summary table
    print_summary_table(results)
    print(" [SUCCESS] All 8 pipeline verification steps completed successfully!\n")


if __name__ == "__main__":
    run_pipeline_verification()
