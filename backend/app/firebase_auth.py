import json
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

_firebase_ready = False

if not firebase_admin._apps:
    # Option 1: key file on disk (local dev)
    if os.path.exists(FIREBASE_KEY_PATH):
        cred = credentials.Certificate(FIREBASE_KEY_PATH)
        firebase_admin.initialize_app(cred)
        _firebase_ready = True
    # Option 2: key JSON passed as environment variable (Render / cloud)
    elif os.environ.get("FIREBASE_KEY_JSON"):
        try:
            key_dict = json.loads(os.environ["FIREBASE_KEY_JSON"])
            cred = credentials.Certificate(key_dict)
            firebase_admin.initialize_app(cred)
            _firebase_ready = True
            print("Firebase initialized from FIREBASE_KEY_JSON env var.")
        except Exception as e:
            print(f"WARNING: Failed to initialize Firebase from env var: {e}. Running in mock mode.")
    else:
        print(f"WARNING: No Firebase credentials found. Running in mock mode.")
else:
    _firebase_ready = True

# --------------------------------------------------
# Global Firestore client
# --------------------------------------------------

if _firebase_ready:
    firestore_db = firestore.client()
else:
    class MockFirestore:
        def collection(self, name):
            return self
        def document(self, name):
            return self
        def update(self, data):
            print(f"MOCK DB UPDATE: {data}")
        def set(self, data):
            print(f"MOCK DB SET: {data}")
        def get(self):
            class MockDoc:
                exists = True
                def to_dict(self):
                    return {"status": "MOCK_DONE"}
            return MockDoc()
        def where(self, *a, **kw):
            return self
        def order_by(self, *a, **kw):
            return self
        def limit(self, *a, **kw):
            return self
        def stream(self):
            return []
    firestore_db = MockFirestore()

# --------------------------------------------------
# Auth dependency
# --------------------------------------------------

security = HTTPBearer(auto_error=False)


def firebase_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    if not _firebase_ready:
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
    - Firebase not configured: always mock user.
    - Firebase configured + Bearer → verified user dict (async dashboard).
    - Firebase configured + no Bearer → None (public sync demo).
    """
    if not _firebase_ready:
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
