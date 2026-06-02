"""Authentication dependency: extract the current user from a request.

This is the reusable 'who is calling?' piece. Any endpoint that needs a
logged-in user adds `Depends(get_current_user)` — the SAME mechanism
that injects the database session. Protected endpoints get the real
User; unauthenticated requests get rejected with 401.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session

from app.core.database import get_session
from app.auth.security import decode_access_token
from app.auth.models import User

# Reads the "Authorization: Bearer <token>" header off the request.
_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> User:
    """Return the authenticated User, or raise 401 if the token is missing/invalid.

    Flow: pull the token from the header -> verify it (signature + expiry)
    -> extract the user id -> load that user from the database.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = session.get(User, user_id)
    if user is None:
        # Token was valid but the user no longer exists (e.g. deleted).
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user