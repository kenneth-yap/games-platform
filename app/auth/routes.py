"""Authentication endpoints: register and login.

Register: create an account (username + hashed password).
Login: verify credentials, issue a JWT.
Both follow the flow drawn on paper.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from pydantic import BaseModel

from app.core.database import get_session
from app.auth.models import User
from app.auth.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


# Request/response shapes. Defining these explicitly means the API
# documents itself and validates input automatically.
class Credentials(BaseModel):
    """What register and login both accept."""
    username: str
    password: str


class TokenResponse(BaseModel):
    """What login returns: the JWT and how to use it."""
    access_token: str
    token_type: str = "bearer"


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(creds: Credentials, session: Session = Depends(get_session)) -> dict:
    """Create a new account. The password is hashed; the original is discarded."""
    # Reject duplicate usernames with a clear message (the DB would also
    # refuse, but checking first gives a friendlier error).
    existing = session.exec(select(User).where(User.username == creds.username)).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    user = User(
        username=creds.username,
        hashed_password=hash_password(creds.password),  # ONE-WAY hash
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"id": user.id, "username": user.username}


@router.post("/login")
def login(creds: Credentials, session: Session = Depends(get_session)) -> TokenResponse:
    """Verify credentials and issue a JWT.

    Note the deliberately VAGUE error: we don't reveal whether it was the
    username or the password that was wrong, so an attacker can't probe
    which usernames exist.
    """
    user = session.exec(select(User).where(User.username == creds.username)).first()

    # Check the user exists AND the password matches. One combined check,
    # one vague message — never "no such user" vs "wrong password".
    if user is None or not verify_password(creds.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)