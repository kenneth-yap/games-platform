"""Security primitives: password hashing and JWT tokens.

Isolated here so the sensitive logic lives in ONE place. Uses
established libraries (passlib/bcrypt, pyjwt) rather than hand-rolled
crypto — rolling your own is the classic security disaster.
"""

from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext

from app.core.config import settings

# bcrypt handles salting and deliberate slowness for us. We never
# touch the raw algorithm — passlib manages it.
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# How long an issued token stays valid. Short-ish because JWTs can't
# easily be revoked before expiry (the stateless tradeoff).
TOKEN_EXPIRE_MINUTES = 60
ALGORITHM = "HS256"


def hash_password(plain_password: str) -> str:
    """One-way hash a password for storage. The original is discarded."""
    return _pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a submitted password against a stored hash.

    Re-hashes the submission and compares. Returns True on match. The
    original password is never recovered — only compared.
    """
    return _pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: int) -> str:
    """Create a signed JWT carrying the user's id.

    The signature is computed with the secret key (only the backend
    knows it), so the token can be verified as genuine and unaltered.
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),   # "subject" — who the token is about
        "exp": expire,         # expiry — verified automatically on decode
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int | None:
    """Verify a token and return the user id inside, or None if invalid.

    jwt.decode checks the signature AND the expiry. Tampered or expired
    tokens raise, which we catch and treat as 'not authenticated'.
    """
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None