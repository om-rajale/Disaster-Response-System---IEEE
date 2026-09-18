import sys
import time
import requests

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=" * 70)
    print(" AEDIRS FULL PIPELINE VERIFICATION")
    print("=" * 70)
    
    timestamp = int(time.time())
    test_user_email = f"citizen_{timestamp}@aedirs-test.org"
    test_user_password = "SecurePassword2026!"
    test_user_name = f"Test Citizen {timestamp}"

    # ---------------------------------------------------------
    # TEST 1: POST /auth/register
    # ---------------------------------------------------------
    print("\n[TEST 1] Registering a new test citizen user...")
    register_payload = {
        "name": test_user_name,
        "email": test_user_email,
        "password": test_user_password,
        "role": "citizen"
    }
    
    reg_response = requests.post(f"{BASE_URL}/auth/register", json=register_payload)
    print(f"Status Code: {reg_response.status_code}")
    print(f"Response: {reg_response.text}")
    
    assert reg_response.status_code == 201, f"Expected 201, got {reg_response.status_code}: {reg_response.text}"
    reg_data = reg_response.json()
    user_id = reg_data.get("id")
    print(f" Registered user ID: {user_id}")

    # ---------------------------------------------------------
    # TEST 2: POST /auth/login
    # ---------------------------------------------------------
    print("\n[TEST 2] Logging in to retrieve JWT access token...")
    login_data = {
        "username": test_user_email,
        "password": test_user_password
    }
    
    login_response = requests.post(f"{BASE_URL}/auth/login", data=login_data)
    print(f"Status Code: {login_response.status_code}")
    print(f"Response: {login_response.text}")
    
    assert login_response.status_code == 200, f"Expected 200, got {login_response.status_code}: {login_response.text}"
    login_json = login_response.json()
    token = login_json.get("access_token")
    assert token, "Access token missing from login response"
    print(f" JWT Token retrieved successfully: {token[:30]}... (role: {login_json.get('role')})")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # ---------------------------------------------------------
    # TEST 3: POST /process_report (Initial Emergency Report)
    # ---------------------------------------------------------
    initial_text = "Building collapsed near Swargate, people injured and trapped!"
    print(f"\n[TEST 3] Sending initial emergency report:\n   \"{initial_text}\"")
    
    report1_payload = {
        "text": initial_text,
        "reporter_id": user_id
    }
    
    rep1_response = requests.post(f"{BASE_URL}/process_report", json=report1_payload, headers=headers)
    print(f"Status Code: {rep1_response.status_code}")
    print(f"Response: {rep1_response.text}")
    
    assert rep1_response.status_code == 201, f"Expected 201, got {rep1_response.status_code}: {rep1_response.text}"
    rep1_data = rep1_response.json()
    report1_id = rep1_data.get("id")
    report1_status = rep1_data.get("status")
    print(f" Report 1 created with ID: {report1_id}, Category: {rep1_data.get('category')}, Status: {report1_status}")

    # ---------------------------------------------------------
    # TEST 4: POST /process_report (Semantically Identical Emergency Report)
    # ---------------------------------------------------------
    duplicate_text = "Structure fell down at Swargate, multiple injured under rubble"
    print(f"\n[TEST 4] Sending semantically identical report:\n   \"{duplicate_text}\"")
    
    report2_payload = {
        "text": duplicate_text,
        "reporter_id": user_id
    }
    
    rep2_response = requests.post(f"{BASE_URL}/process_report", json=report2_payload, headers=headers)
    print(f"Status Code: {rep2_response.status_code}")
    print(f"Response: {rep2_response.text}")
    
    assert rep2_response.status_code == 201, f"Expected 201, got {rep2_response.status_code}: {rep2_response.text}"
    rep2_data = rep2_response.json()
    report2_id = rep2_data.get("id")
    report2_status = rep2_data.get("status")
    print(f" Report 2 created with ID: {report2_id}, Status: {report2_status}")

    # ---------------------------------------------------------
    # TEST 5: Verify Duplicate Linking
    # ---------------------------------------------------------
    print(f"\n[TEST 5] Verifying Report 2 is linked as duplicate of Report 1...")
    expected_status = f"duplicate_of_{report1_id}"
    print(f"Expected Status: '{expected_status}'")
    print(f"Actual Status:   '{report2_status}'")
    
    assert report2_status == expected_status, (
        f"FAILED: Expected Report 2 status to be '{expected_status}', but got '{report2_status}'"
    )
    
    print("\n" + "=" * 70)
    print(" ALL 5 PIPELINE TESTS PASSED SUCCESSFULLY! ")
    print(f"   - User Registered (ID: {user_id})")
    print(f"   - Token Generated")
    print(f"   - Primary Report #{report1_id} status: '{report1_status}'")
    print(f"   - Duplicate Report #{report2_id} status: '{report2_status}' (matches duplicate_of_{report1_id})")
    print("=" * 70)

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n Pipeline verification failed: {e}", file=sys.stderr)
        sys.exit(1)
