import os
from typing import Optional

import firebase_admin
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth, firestore, exceptions, credentials

# --------------------------------------------------
# Firebase initialization (RUNS ONCE)
# --------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(__file__))  # backend/
FIREBASE_KEY_PATH = os.path.join(BASE_DIR, "firebase_key.json")

if not firebase_admin._apps:
    if os.path.exists(FIREBASE_KEY_PATH):
        cred = credentials.Certificate(FIREBASE_KEY_PATH)
        firebase_admin.initialize_app(cred)
    else:
        print(f"WARNING: Firebase key not found at {FIREBASE_KEY_PATH}. Running in mock mode.")

# --------------------------------------------------
# Global Firestore client
# --------------------------------------------------

if os.path.exists(FIREBASE_KEY_PATH):
    firestore_db = firestore.client()
else:
    class MockFirestore:
        def collection(self, name):
            return self
        def document(self, name):
            return self
        def set(self, data):
            print(f"MOCK DB SET: {data}")
        def get(self):
            class MockDoc:
                exists = True
                def to_dict(self):
                    return {"status": "MOCK_DONE"}
            return MockDoc()
    firestore_db = MockFirestore()

# --------------------------------------------------
# Auth dependency
# --------------------------------------------------

security = HTTPBearer(auto_error=False)


def firebase_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    # If no key, return mock user
    if not os.path.exists(FIREBASE_KEY_PATH):
        return {"uid": "mock_user_123", "email": "mock@example.com"}

    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication credentials",
        )

    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token

    except exceptions.FirebaseError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token",
        )


def analyze_endpoint_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Optional[dict]:
    """
    For POST /analyze:
    - No firebase_key.json: same as legacy firebase_auth — always mock user (async jobs in dev).
    - Firebase configured + Bearer → verified user dict (async dashboard).
    - Firebase configured + no Bearer → None (public sync demo for landing; requires no auth).
    """
    if not os.path.exists(FIREBASE_KEY_PATH):
        return {"uid": "mock_user_123", "email": "mock@example.com"}

    if not credentials or credentials.scheme.lower() != "bearer":
        return None

    try:
        return auth.verify_id_token(credentials.credentials)
    except exceptions.FirebaseError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token",
        )