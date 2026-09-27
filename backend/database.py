# backend/database.py

import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import execute_values
import hmac
import json
import os
import time
import uuid
import bcrypt
from dotenv import load_dotenv
from typing import Optional
from datetime import datetime, timezone

from qr_codes import build_user_qr_png, new_qr_token, qr_payload

# Load variables from .env (for local development)
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# --- HIGH LOAD CONFIGURATION: CONNECTION POOL ---
# Initialize a global connection pool (min 2, max 20 threads/connections)
def _create_pool(retries: int = 4, delay: float = 1.5) -> ThreadedConnectionPool:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    last_error = None
    for attempt in range(1, retries + 1):
        try:
            return ThreadedConnectionPool(2, 20, dsn=DATABASE_URL)
        except psycopg2.OperationalError as exc:
            last_error = exc
            if attempt == retries:
                break
            time.sleep(delay)
    raise last_error or RuntimeError("Could not connect to the database")


db_pool = _create_pool()

def get_connection():
    """Retrieves a functional connection from the connection pool"""
    return db_pool.getconn()

def release_connection(conn):
    """Safely returns a connection back to the pool"""
    db_pool.putconn(conn)

def init_db():
    """Schema is managed by Alembic. Run from backend/: alembic upgrade head"""
    pass

# --- PASSWORD CRYPTOGRAPHY HELPERS ---

def hash_password(password: str) -> str:
    """Hashes a plain-text password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain-text password against a hashed match"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# --- USER FUNCTIONS ---

def register_user_db(username: str, password: str, public_key, encrypted_private_key: str, email: Optional[str] = None) -> bool:
    """Registers a new user with a hashed password, public key, and synced private key.
    With an email the account starts unverified (is_verified = FALSE)."""
    conn = get_connection()
    cursor = conn.cursor()
    
    if isinstance(public_key, dict):
        public_key_str = json.dumps(public_key)
    else:
        public_key_str = public_key
    
    hashed_pw = hash_password(password)
    qr_token = new_qr_token()
    qr_png = build_user_qr_png(username, qr_token)
    
    try:
        cursor.execute(
            '''
            INSERT INTO users (
                username, password_hash, public_key, encrypted_private_key, qr_token, qr_png, email, is_verified
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, FALSE)
            ''',
            (username, hashed_pw, public_key_str, encrypted_private_key, qr_token, psycopg2.Binary(qr_png), email)
        )
        conn.commit()
        return True
    except psycopg2.IntegrityError:
        conn.rollback()
        return False
    finally:
        release_connection(conn)

def login_user_db(username: str, password: str):
    """Authenticates a user and returns their keys for cross-device synchronization"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT password_hash, public_key, encrypted_private_key, email, is_verified FROM users WHERE username = %s', (username,))
        row = cursor.fetchone()
        
        if row is None:
            return None
            
        db_hash, db_pub_key_str, db_enc_priv_key = row[0], row[1], row[2]
        
        if verify_password(password, db_hash):
            try:
                pub_key_obj = json.loads(db_pub_key_str)
            except (json.JSONDecodeError, TypeError):
                pub_key_obj = db_pub_key_str
                
            return {
                "public_key": pub_key_obj,
                "encrypted_private_key": db_enc_priv_key,
                "email": row[3],
                "is_verified": bool(row[4]),
            }
        return None
    finally:
        release_connection(conn)


# --- EMAIL VERIFICATION (alembic 0011) ---

def email_in_use_db(email: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM users WHERE LOWER(email) = LOWER(%s)", (email,))
        return cursor.fetchone() is not None
    finally:
        release_connection(conn)


def get_user_by_email_db(email: str) -> Optional[dict]:
    """The account behind an email (keys included, as login returns them)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT username, is_verified, public_key, encrypted_private_key, email FROM users WHERE LOWER(email) = LOWER(%s)",
            (email,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        try:
            public_key = json.loads(row[2])
        except (json.JSONDecodeError, TypeError):
            public_key = row[2]
        return {
            "username": row[0],
            "is_verified": bool(row[1]),
            "public_key": public_key,
            "encrypted_private_key": row[3],
            "email": row[4],
        }
    finally:
        release_connection(conn)


def store_email_otp_db(email: str, username: str, code_hash: str, ttl_seconds: int, cooldown_seconds: int) -> bool:
    """Store a fresh code for this email (resetting attempts). False — and
    nothing changes — when the last one went out under `cooldown_seconds` ago."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO email_otps (email, username, code_hash, expires_at, attempts, last_sent_at)
            VALUES (%s, %s, %s, NOW() + make_interval(secs => %s), 0, NOW())
            ON CONFLICT (email) DO UPDATE
               SET username = EXCLUDED.username,
                   code_hash = EXCLUDED.code_hash,
                   expires_at = EXCLUDED.expires_at,
                   attempts = 0,
                   last_sent_at = NOW()
             WHERE email_otps.last_sent_at <= NOW() - make_interval(secs => %s)
            RETURNING 1
            """,
            (email, username, code_hash, ttl_seconds, cooldown_seconds),
        )
        stored = cursor.fetchone() is not None
        conn.commit()
        return stored
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def email_otp_retry_after_db(email: str, cooldown_seconds: int) -> int:
    """Seconds until another code may be sent for this email (0 = now)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (last_sent_at + make_interval(secs => %s) - NOW()))))
            FROM email_otps WHERE email = %s
            """,
            (cooldown_seconds, email),
        )
        row = cursor.fetchone()
        return int(row[0]) if row else 0
    finally:
        release_connection(conn)


def consume_email_otp_db(email: str, code_hash: str, max_attempts: int) -> tuple[str, Optional[str]]:
    """Check a code for this email, atomically.
    ("ok", username): it matched — used up, and the account is now verified.
    ("invalid" | "expired" | "locked" | "missing", None) otherwise; a wrong
    code counts an attempt, and at `max_attempts` the code is dead."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT username, code_hash, expires_at > NOW(), attempts FROM email_otps WHERE email = %s FOR UPDATE",
            (email,),
        )
        row = cursor.fetchone()
        if not row:
            conn.rollback()
            return "missing", None
        username, stored_hash, alive, attempts = row
        if not alive:
            cursor.execute("DELETE FROM email_otps WHERE email = %s", (email,))
            conn.commit()
            return "expired", None
        if attempts >= max_attempts:
            conn.rollback()
            return "locked", None
        if not hmac.compare_digest(stored_hash, code_hash):
            cursor.execute("UPDATE email_otps SET attempts = attempts + 1 WHERE email = %s", (email,))
            conn.commit()
            return ("locked" if attempts + 1 >= max_attempts else "invalid"), None
        cursor.execute("DELETE FROM email_otps WHERE email = %s", (email,))
        cursor.execute("UPDATE users SET is_verified = TRUE WHERE username = %s", (username,))
        conn.commit()
        return "ok", username
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)

def get_user_for_reset_db(email: str) -> Optional[dict]:
    """The account a "Forgot password?" request is for: looked up by email
    only (case-insensitive), and only once that email is verified — a reset
    link goes to an address the account has proven it owns. None otherwise."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT username, email FROM users WHERE LOWER(email) = LOWER(%s) AND is_verified",
            (email,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return {"username": row[0], "email": row[1]}
    finally:
        release_connection(conn)


def create_password_reset_token_db(username: str, token_hash: str, ttl_seconds: int, cooldown_seconds: int) -> bool:
    """Store a new reset link for this account; any earlier unused link dies.
    False — and nothing changes — when the last link went out under
    `cooldown_seconds` ago (so the endpoint can't be used to spam a mailbox)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Serialize concurrent requests for the same account.
        cursor.execute("SELECT 1 FROM users WHERE username = %s FOR UPDATE", (username,))
        cursor.execute(
            """
            SELECT 1 FROM password_reset_tokens
             WHERE username = %s AND created_at > NOW() - make_interval(secs => %s)
            """,
            (username, cooldown_seconds),
        )
        if cursor.fetchone():
            conn.rollback()
            return False
        cursor.execute("UPDATE password_reset_tokens SET used = TRUE WHERE username = %s AND NOT used", (username,))
        cursor.execute(
            """
            INSERT INTO password_reset_tokens (id, username, token_hash, expires_at)
            VALUES (%s, %s, %s, NOW() + make_interval(secs => %s))
            """,
            (str(uuid.uuid4()), username, token_hash, ttl_seconds),
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def reset_password_db(token_hash: str, new_password: str, public_key, encrypted_private_key: str) -> tuple:
    """Redeem a reset link, atomically: (status, username, ended session ids).
    status "ok": the password and the key pair are replaced (the client made
    the new pair; the private key arrives encrypted with the new password),
    the email counts as verified (the link proved the mailbox), every link of
    the account is spent, its undelivered queue (encrypted to the old key) is
    dropped and every auth session ends. "invalid" | "used" | "expired" —
    nothing changes."""
    public_key_str = json.dumps(public_key) if isinstance(public_key, dict) else public_key
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT username, used, expires_at > NOW() FROM password_reset_tokens WHERE token_hash = %s FOR UPDATE",
            (token_hash,),
        )
        row = cursor.fetchone()
        if not row:
            conn.rollback()
            return "invalid", None, []
        username, used, alive = row
        if used:
            conn.rollback()
            return "used", None, []
        if not alive:
            conn.rollback()
            return "expired", None, []
        cursor.execute(
            """
            UPDATE users
               SET password_hash = %s, public_key = %s, encrypted_private_key = %s, is_verified = TRUE
             WHERE username = %s
            """,
            (hash_password(new_password), public_key_str, encrypted_private_key, username),
        )
        cursor.execute("UPDATE password_reset_tokens SET used = TRUE WHERE username = %s", (username,))
        cursor.execute("DELETE FROM offline_messages WHERE receiver = %s", (username,))
        cursor.execute("DELETE FROM auth_sessions WHERE username = %s RETURNING id", (username,))
        revoked = [str(r[0]) for r in cursor.fetchall()]
        conn.commit()
        return "ok", username, revoked
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def search_users_db(query: str, current_username: str, limit: int = 20) -> list:
    """Search users by username without returning the whole database."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        safe_limit = max(1, min(limit, 50))
        normalized_query = query.lower().strip()
        like_query = normalized_query.replace('\\', '\\\\').replace('_', '\\_')
        cursor.execute('''
            SELECT username, public_key, display_name, bio, avatar_data
            FROM users
            WHERE username <> %s
              AND username ~ '^[a-z0-9_]+$'
              AND (
                  username LIKE %s ESCAPE '\\'
                  OR LOWER(COALESCE(display_name, '')) LIKE %s ESCAPE '\\'
              )
            ORDER BY
                CASE
                    WHEN username = %s THEN 0
                    WHEN username LIKE %s ESCAPE '\\' THEN 1
                    WHEN LOWER(COALESCE(display_name, '')) LIKE %s ESCAPE '\\' THEN 2
                    ELSE 3
                END,
                username
            LIMIT %s
        ''', (
            current_username,
            f'%{like_query}%',
            f'%{like_query}%',
            normalized_query,
            f'{like_query}%',
            f'{like_query}%',
            safe_limit
        ))
        rows = cursor.fetchall()
        return [_user_row_to_dict(row) for row in rows]
    finally:
        release_connection(conn)

def conversation_exists_db(user: str, partner: str) -> bool:
    """Returns True when at least one message exists between two users."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT 1
            FROM chat_history
            WHERE (sender = %s AND receiver = %s)
               OR (sender = %s AND receiver = %s)
            LIMIT 1
        ''', (user, partner, partner, user))
        return cursor.fetchone() is not None
    finally:
        release_connection(conn)

def get_unread_count_db(username: str, partner: str) -> int:
    """Count incoming messages from partner not yet marked read."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT COUNT(*)
            FROM chat_history ch
            LEFT JOIN conversation_read_state crs
              ON crs.username = %s AND crs.partner = %s
            WHERE ch.receiver = %s
              AND ch.sender = %s
              AND ch.id > COALESCE(crs.last_read_message_id, 0)
        ''', (username, partner, username, partner))
        row = cursor.fetchone()
        return int(row[0]) if row else 0
    finally:
        release_connection(conn)

def get_unread_counts_db(username: str) -> dict:
    """Returns {partner: unread_count} for all conversations."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            WITH partners AS (
                SELECT DISTINCT
                    CASE
                        WHEN sender = %s THEN receiver
                        ELSE sender
                    END AS partner
                FROM chat_history
                WHERE sender = %s OR receiver = %s
            )
            SELECT
                p.partner,
                COUNT(ch.id)::int
            FROM partners p
            LEFT JOIN conversation_read_state crs
              ON crs.username = %s AND crs.partner = p.partner
            LEFT JOIN chat_history ch
              ON ch.sender = p.partner
             AND ch.receiver = %s
             AND ch.id > COALESCE(crs.last_read_message_id, 0)
            GROUP BY p.partner
        ''', (username, username, username, username, username))
        return {row[0]: row[1] for row in cursor.fetchall()}
    finally:
        release_connection(conn)

def mark_conversation_read_db(username: str, partner: str, up_to_message_id: int) -> int:
    """Marks all incoming messages from partner up to message id as read."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO conversation_read_state (username, partner, last_read_message_id, updated_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (username, partner)
            DO UPDATE SET
                last_read_message_id = GREATEST(
                    conversation_read_state.last_read_message_id,
                    EXCLUDED.last_read_message_id
                ),
                updated_at = CURRENT_TIMESTAMP
        ''', (username, partner, up_to_message_id))

        cursor.execute('''
            UPDATE chat_history
            SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
            WHERE sender = %s
              AND receiver = %s
              AND id <= %s
              AND read_at IS NULL
        ''', (partner, username, up_to_message_id))
        updated = cursor.rowcount
        conn.commit()
        return updated
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)

def mark_message_delivered_db(message_id: int) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE chat_history
            SET delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
            WHERE id = %s
        ''', (message_id,))
        updated = cursor.rowcount > 0
        conn.commit()
        return updated
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)

def get_chat_partners_db(username: str, limit: int = 50) -> list:
    """Returns sidebar contacts: users with at least one message, newest first."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        safe_limit = max(1, min(limit, 100))
        cursor.execute('''
            WITH partners AS (
                SELECT
                    CASE
                        WHEN sender = %s THEN receiver
                        ELSE sender
                    END AS partner,
                    MAX(timestamp) AS last_message_at,
                    MAX(id) AS last_message_id
                FROM chat_history
                WHERE sender = %s OR receiver = %s
                GROUP BY partner
            )
            SELECT
                p.partner,
                u.public_key,
                u.display_name,
                u.bio,
                u.avatar_data,
                p.last_message_at,
                p.last_message_id,
                COALESCE((
                    SELECT COUNT(ch.id)::int
                    FROM chat_history ch
                    LEFT JOIN conversation_read_state crs
                      ON crs.username = %s AND crs.partner = p.partner
                    WHERE ch.sender = p.partner
                      AND ch.receiver = %s
                      AND ch.id > COALESCE(crs.last_read_message_id, 0)
                ), 0) AS unread_count
            FROM partners p
            INNER JOIN users u ON u.username = p.partner
            ORDER BY p.last_message_at DESC NULLS LAST, p.last_message_id DESC
            LIMIT %s
        ''', (username, username, username, username, username, safe_limit))
        rows = cursor.fetchall()
        return [{
            "username": row[0],
            "public_key": _parse_public_key(row[1]),
            "display_name": row[2] or "",
            "bio": row[3] or "",
            "avatar_data": row[4] if row[4] else None,
            "last_message_at": row[5].isoformat() if row[5] else None,
            "last_message_id": row[6],
            "unread_count": row[7] or 0,
        } for row in rows]
    finally:
        release_connection(conn)

def get_user_db(username: str):
    """Return one user public key by exact username."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT username, public_key, display_name, bio, avatar_data
            FROM users
            WHERE username = %s
              AND username ~ '^[a-z0-9_]+$'
        ''', (username,))
        row = cursor.fetchone()
        return _user_row_to_dict(row) if row else None
    finally:
        release_connection(conn)

def resolve_user_db(username: str):
    """Public profile for a deeplink (/chat/@username), matched case-insensitively."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT username, public_key, display_name, bio, avatar_data
            FROM users
            WHERE lower(username) = lower(%s)
            LIMIT 1
        ''', (username,))
        row = cursor.fetchone()
        return _user_row_to_dict(row) if row else None
    finally:
        release_connection(conn)

def update_user_profile_db(
    username: str,
    display_name: str,
    bio: str,
    avatar_data: Optional[str],
) -> bool:
    """Persist public profile metadata (display name, bio, avatar)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            UPDATE users
            SET display_name = %s, bio = %s, avatar_data = %s
            WHERE username = %s
        ''', (display_name, bio, avatar_data, username))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        release_connection(conn)

def get_user_profile_db(username: str) -> Optional[dict]:
    """Return profile fields for one user."""
    user = get_user_db(username)
    if not user:
        return None
    return {
        "username": user["username"],
        "display_name": user.get("display_name", ""),
        "bio": user.get("bio", ""),
        "avatar_data": user.get("avatar_data"),
        "status": user.get("status") or "",
    }

def ensure_user_qr_db(username: str) -> Optional[dict]:
    """Return QR payload and PNG, creating them if this user predates the column."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'SELECT qr_token, qr_png FROM users WHERE username = %s',
            (username,),
        )
        row = cursor.fetchone()
        if row is None:
            return None

        token = str(row[0]) if row[0] else new_qr_token()
        # Rebuild so visual style updates (liquid Telegram look) apply to existing users.
        png = build_user_qr_png(username, token)
        cursor.execute(
            'UPDATE users SET qr_token = %s, qr_png = %s WHERE username = %s',
            (token, psycopg2.Binary(png), username),
        )
        conn.commit()
        return {
            "username": username,
            "token": token,
            "payload": qr_payload(username, token),
            "png": png,
        }
    except Exception as exc:
        conn.rollback()
        raise exc
    finally:
        release_connection(conn)

# --- OPTIMIZED MESSAGE FUNCTIONS WITH BATCHING & PAGINATION ---

def save_chat_history_batch(messages_batch: list):
    """Executes a highly efficient high-load bulk INSERT for history packets"""
    if not messages_batch:
        return
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Transforming objects into a structured data tuple for psycopg2 extras
        query_data = [
            (
                msg['sender'],
                msg['receiver'],
                json.dumps(msg['content_recipient']),
                json.dumps(msg['content_sender']),
                msg.get('client_message_id')
            )
            for msg in messages_batch
        ]
        execute_values(
            cursor,
            "INSERT INTO chat_history (sender, receiver, content_recipient, content_sender, client_message_id) VALUES %s",
            query_data
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)

def get_chat_history_db(user: str, partner: str, limit: int = 50, offset: int = 0) -> list:
    """Fetches paginated E2EE chunks using the optimized composited b-tree database index"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, sender, receiver, content_recipient, content_sender, client_message_id, timestamp,
                   delivered_at, read_at, reply_to_message_id
            FROM chat_history 
            WHERE (sender = %s AND receiver = %s) OR (sender = %s AND receiver = %s)
            ORDER BY id DESC
            LIMIT %s OFFSET %s
        ''', (user, partner, partner, user, limit, offset))
        rows = cursor.fetchall()
        
        # Reverse the chunk before returning so it displays chronologically (oldest to newest)
        rows.reverse()

        message_ids = [r[0] for r in rows]
        reactions_map = get_reactions_for_message_ids_db(message_ids)
        
        return [{
            "id": r[0],
            "sender": r[1],
            "receiver": r[2],
            "content_recipient": json.loads(r[3]),
            "content_sender": json.loads(r[4]),
            "client_message_id": r[5],
            "timestamp": r[6].isoformat() if r[6] else None,
            "delivered_at": r[7].isoformat() if r[7] else None,
            "read_at": r[8].isoformat() if r[8] else None,
            "reply_to_message_id": r[9],
            "reactions": reactions_map.get(r[0], []),
        } for r in rows]
    finally:
        release_connection(conn)

def message_in_conversation_db(message_id: int, user_a: str, user_b: str) -> bool:
    """True if message_id belongs to the conversation between user_a and user_b."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT 1 FROM chat_history
            WHERE id = %s
              AND (
                (sender = %s AND receiver = %s)
                OR (sender = %s AND receiver = %s)
              )
            LIMIT 1
        ''', (message_id, user_a, user_b, user_b, user_a))
        return cursor.fetchone() is not None
    finally:
        release_connection(conn)


def get_message_participants_db(message_id: int) -> Optional[tuple]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            'SELECT sender, receiver FROM chat_history WHERE id = %s',
            (message_id,)
        )
        row = cursor.fetchone()
        return (row[0], row[1]) if row else None
    finally:
        release_connection(conn)


def save_chat_history_message(
    sender: str,
    receiver: str,
    content_recipient: list,
    content_sender: list,
    client_message_id: Optional[str] = None,
    reply_to_message_id: Optional[int] = None,
):
    """Persists one encrypted chat packet and returns its database identity."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO chat_history (
                sender, receiver, content_recipient, content_sender,
                client_message_id, reply_to_message_id
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, timestamp
        ''', (
            sender,
            receiver,
            json.dumps(content_recipient),
            json.dumps(content_sender),
            client_message_id,
            reply_to_message_id,
        ))
        row = cursor.fetchone()
        if row is None:
            raise RuntimeError("INSERT … RETURNING returned no row")
        conn.commit()
        return {
            "id": row[0],
            "timestamp": row[1].isoformat() if row[1] else None,
            "client_message_id": client_message_id
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)

ALLOWED_REACTION_EMOJI = frozenset({'👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'})


def get_reactions_for_message_ids_db(message_ids: list) -> dict:
    if not message_ids:
        return {}
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT message_id, username, emoji
            FROM message_reactions
            WHERE message_id = ANY(%s)
            ORDER BY message_id, updated_at ASC
        ''', (message_ids,))
        result = {}
        for message_id, username, emoji in cursor.fetchall():
            result.setdefault(message_id, []).append({
                "username": username,
                "emoji": emoji,
            })
        return result
    finally:
        release_connection(conn)


def set_message_reaction_db(username: str, message_id: int, emoji: Optional[str]) -> Optional[dict]:
    """Set or remove (emoji=None) a reaction. Returns sync payload or None if invalid."""
    if emoji is not None and emoji not in ALLOWED_REACTION_EMOJI:
        return None

    participants = get_message_participants_db(message_id)
    if not participants:
        return None
    sender, receiver = participants
    if username not in (sender, receiver):
        return None

    partner = receiver if sender == username else sender

    conn = get_connection()
    cursor = conn.cursor()
    try:
        if emoji is None:
            cursor.execute(
                'DELETE FROM message_reactions WHERE message_id = %s AND username = %s',
                (message_id, username),
            )
        else:
            cursor.execute('''
                INSERT INTO message_reactions (message_id, username, emoji, updated_at)
                VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (message_id, username)
                DO UPDATE SET emoji = EXCLUDED.emoji, updated_at = CURRENT_TIMESTAMP
            ''', (message_id, username, emoji))
        conn.commit()

        reactions = get_reactions_for_message_ids_db([message_id]).get(message_id, [])
        return {
            "message_id": message_id,
            "partner": partner,
            "username": username,
            "emoji": emoji,
            "reactions": reactions,
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def delete_chat_message_db(username: str, message_id: int) -> Optional[dict]:
    """Deletes one chat message if the user is a participant. Returns metadata for WS sync."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, sender, receiver, client_message_id
            FROM chat_history
            WHERE id = %s
              AND (sender = %s OR receiver = %s)
        ''', (message_id, username, username))
        row = cursor.fetchone()
        if not row:
            return None

        msg_id, sender, receiver, client_message_id = row
        partner = receiver if sender == username else sender

        cursor.execute('DELETE FROM message_reactions WHERE message_id = %s', (msg_id,))

        cursor.execute('''
            DELETE FROM chat_history
            WHERE id = %s
        ''', (msg_id,))

        cursor.execute('''
            DELETE FROM offline_messages
            WHERE chat_history_id = %s
              AND (sender = %s OR receiver = %s)
        ''', (msg_id, username, username))

        conn.commit()
        deleted_at = datetime.now(timezone.utc).isoformat()
        return {
            "message_id": msg_id,
            "chat_id": partner,
            "partner": partner,
            "sender": sender,
            "receiver": receiver,
            "deleted_by": username,
            "client_message_id": client_message_id,
            "deleted_at": deleted_at,
            "deleted_for_everyone": True,
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)

def delete_conversation_db(username: str, partner: str) -> int:
    """Deletes all stored packets for one conversation."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            DELETE FROM chat_history
            WHERE (sender = %s AND receiver = %s)
               OR (sender = %s AND receiver = %s)
        ''', (username, partner, partner, username))
        deleted = cursor.rowcount

        cursor.execute('''
            DELETE FROM offline_messages
            WHERE (sender = %s AND receiver = %s)
               OR (sender = %s AND receiver = %s)
        ''', (username, partner, partner, username))

        conn.commit()
        return deleted
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)

def save_offline_message(sender: str, receiver: str, content: list, chat_history_id: Optional[int] = None, client_message_id: Optional[str] = None, timestamp: Optional[str] = None):
    """Saves message for an offline user"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            '''
            INSERT INTO offline_messages (sender, receiver, content, chat_history_id, client_message_id, timestamp)
            VALUES (%s, %s, %s, %s, %s, COALESCE(%s::timestamp, CURRENT_TIMESTAMP))
            ''',
            (sender, receiver, json.dumps(content), chat_history_id, client_message_id, timestamp)
        )
        conn.commit()
    finally:
        release_connection(conn)

def get_and_delete_offline_messages(receiver: str) -> list:
    """Fetches all accumulated messages for a user and removes them from the queue"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Read messages
        cursor.execute('''
            SELECT sender, content, chat_history_id, client_message_id, timestamp
            FROM offline_messages
            WHERE receiver = %s
            ORDER BY id ASC
        ''', (receiver,))
        rows = cursor.fetchall()
        
        # Delete messages
        cursor.execute('DELETE FROM offline_messages WHERE receiver = %s', (receiver,))
        conn.commit()
        return [{
            "sender": row[0],
            "content": json.loads(row[1]),
            "id": row[2],
            "client_message_id": row[3],
            "timestamp": row[4].isoformat() if row[4] else None
        } for row in rows]
    finally:
        release_connection(conn)

ALLOWED_DEVICE_PLATFORMS = {
    "ios",
    "ipados",
    "macos",
    "windows",
    "android",
    "linux",
    "web",
    "unknown",
}


def parse_device_id(value) -> Optional[str]:
    if not value:
        return None
    try:
        return str(uuid.UUID(str(value).strip()))
    except (ValueError, AttributeError, TypeError):
        return None


def sanitize_device_text(value, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = "".join(ch for ch in value.strip() if ch.isprintable())
    return cleaned[:max_len]


def sanitize_device_platform(value) -> str:
    key = value.strip().lower() if isinstance(value, str) else ""
    return key if key in ALLOWED_DEVICE_PLATFORMS else "unknown"


def _session_row_to_dict(row) -> dict:
    last_seen = row[6]
    created_at = row[7]
    return {
        "id": row[0],
        "username": row[1],
        "device_id": str(row[2]),
        "device_name": row[3] or "",
        "platform": row[4] or "unknown",
        "os_version": row[5] or "",
        "last_seen": last_seen.isoformat() if last_seen else None,
        "created_at": created_at.isoformat() if created_at else None,
    }


def sanitize_apns_token(value) -> Optional[str]:
    if not isinstance(value, str):
        return None
    token = "".join(ch for ch in value if ch.isalnum()).lower()
    if 32 <= len(token) <= 256:
        return token
    return None


def upsert_user_session_db(
    username: str,
    device_id: str,
    device_name: str = "",
    platform: str = "unknown",
    os_version: str = "",
    apns_token: Optional[str] = None,
    apns_sandbox: Optional[bool] = None,
    notify_messages: Optional[bool] = None,
    notify_sound: Optional[bool] = None,
    notify_preview: Optional[bool] = None,
) -> Optional[dict]:
    parsed_id = parse_device_id(device_id)
    if not parsed_id:
        return None

    name = sanitize_device_text(device_name, 64)
    plat = sanitize_device_platform(platform)
    os_label = sanitize_device_text(os_version, 64)
    fallback_name = name or "Unknown device"
    token = sanitize_apns_token(apns_token)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO user_sessions (
                username, device_id, device_name, platform, os_version, last_seen,
                apns_token, apns_sandbox, notify_messages, notify_sound, notify_preview
            )
            VALUES (
                %s, %s, %s, %s, %s, CURRENT_TIMESTAMP,
                %s, COALESCE(%s, TRUE), COALESCE(%s, TRUE), COALESCE(%s, TRUE), COALESCE(%s, TRUE)
            )
            ON CONFLICT (username, device_id) DO UPDATE SET
                device_name = CASE
                    WHEN EXCLUDED.device_name <> '' AND EXCLUDED.device_name <> 'Unknown device'
                    THEN EXCLUDED.device_name
                    ELSE user_sessions.device_name
                END,
                platform = CASE
                    WHEN EXCLUDED.platform <> 'unknown' THEN EXCLUDED.platform
                    ELSE user_sessions.platform
                END,
                os_version = CASE
                    WHEN EXCLUDED.os_version <> '' THEN EXCLUDED.os_version
                    ELSE user_sessions.os_version
                END,
                last_seen = CURRENT_TIMESTAMP,
                apns_token = COALESCE(%s, user_sessions.apns_token),
                apns_sandbox = COALESCE(%s, user_sessions.apns_sandbox),
                notify_messages = COALESCE(%s, user_sessions.notify_messages),
                notify_sound = COALESCE(%s, user_sessions.notify_sound),
                notify_preview = COALESCE(%s, user_sessions.notify_preview)
            RETURNING id, username, device_id, device_name, platform, os_version, last_seen, created_at
            """,
            (
                username,
                parsed_id,
                fallback_name,
                plat,
                os_label,
                token,
                apns_sandbox,
                notify_messages,
                notify_sound,
                notify_preview,
                token,
                apns_sandbox,
                notify_messages,
                notify_sound,
                notify_preview,
            ),
        )
        row = cursor.fetchone()
        conn.commit()
        return _session_row_to_dict(row) if row else None
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


def list_user_sessions_db(username: str) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT id, username, device_id, device_name, platform, os_version, last_seen, created_at
            FROM user_sessions
            WHERE username = %s
            ORDER BY last_seen DESC
            """,
            (username,),
        )
        return [_session_row_to_dict(row) for row in cursor.fetchall()]
    finally:
        release_connection(conn)


def terminate_user_session_db(username: str, device_id: str) -> bool:
    """Drop a device's session and mark it revoked (tokens issued before now
    are refused for it). False when the user has no such session."""
    parsed_id = parse_device_id(device_id)
    if not parsed_id:
        return False
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM user_sessions WHERE username = %s AND device_id = %s",
            (username, parsed_id),
        )
        if cursor.rowcount == 0:
            conn.rollback()
            return False
        cursor.execute(
            """
            INSERT INTO revoked_device_sessions (username, device_id, revoked_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (username, device_id) DO UPDATE SET revoked_at = NOW()
            """,
            (username, parsed_id),
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def is_device_session_revoked_db(username: str, device_id: str, issued_at) -> bool:
    """Was this device terminated after the token (issued_at, UTC) was minted?
    A token minted later (a fresh sign-in) clears the revocation."""
    parsed_id = parse_device_id(device_id)
    if not parsed_id:
        return False
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT revoked_at FROM revoked_device_sessions WHERE username = %s AND device_id = %s",
            (username, parsed_id),
        )
        row = cursor.fetchone()
        if not row:
            return False
        if issued_at is not None and issued_at > row[0]:
            cursor.execute(
                "DELETE FROM revoked_device_sessions WHERE username = %s AND device_id = %s",
                (username, parsed_id),
            )
            conn.commit()
            return False
        return True
    finally:
        release_connection(conn)


# --- Auth sessions (refresh-token sessions, alembic 0010) -------------------

def _auth_session_row_to_dict(row) -> dict:
    return {
        "id": str(row[0]),
        "username": row[1],
        "device_name": row[2] or "",
        "user_agent": row[3] or "",
        "ip_address": row[4] or "",
        "last_active_at": row[5].isoformat() if row[5] else None,
        "expires_at": row[6].isoformat() if row[6] else None,
        "created_at": row[7].isoformat() if row[7] else None,
    }


_AUTH_SESSION_COLUMNS = "id, username, device_name, user_agent, ip_address, last_active_at, expires_at, created_at"


def create_auth_session_db(
    session_id: str,
    username: str,
    refresh_token_hash: str,
    device_name: str,
    user_agent: str,
    ip_address: str,
    ttl_seconds: int,
) -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            f"""
            INSERT INTO auth_sessions (id, username, refresh_token_hash, device_name, user_agent, ip_address, expires_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW() + make_interval(secs => %s))
            RETURNING {_AUTH_SESSION_COLUMNS}
            """,
            (
                session_id,
                username,
                refresh_token_hash,
                sanitize_device_text(device_name, 128),
                sanitize_device_text(user_agent, 512),
                sanitize_device_text(ip_address, 64),
                ttl_seconds,
            ),
        )
        row = cursor.fetchone()
        conn.commit()
        return _auth_session_row_to_dict(row)
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def get_auth_session_by_token_hash_db(refresh_token_hash: str) -> Optional[dict]:
    """The session a refresh token belongs to (whatever its age)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            f"""
            SELECT {_AUTH_SESSION_COLUMNS}
            FROM auth_sessions
            WHERE refresh_token_hash = %s
            """,
            (refresh_token_hash,),
        )
        row = cursor.fetchone()
        return _auth_session_row_to_dict(row) if row else None
    finally:
        release_connection(conn)


def is_auth_session_alive_db(session_id: str, idle_seconds: int) -> Optional[bool]:
    """True alive, False expired, None no such session."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT expires_at > NOW() AND last_active_at > NOW() - make_interval(secs => %s)
            FROM auth_sessions WHERE id = %s
            """,
            (idle_seconds, session_id),
        )
        row = cursor.fetchone()
        return None if row is None else bool(row[0])
    finally:
        release_connection(conn)


def touch_auth_session_db(session_id: str, ttl_seconds: int) -> None:
    """A refresh: the session is active now, and its expiry slides forward."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            UPDATE auth_sessions
            SET last_active_at = NOW(), expires_at = NOW() + make_interval(secs => %s)
            WHERE id = %s
            """,
            (ttl_seconds, session_id),
        )
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def auth_session_exists_db(session_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM auth_sessions WHERE id = %s", (session_id,))
        return cursor.fetchone() is not None
    finally:
        release_connection(conn)


def list_auth_sessions_db(username: str) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            f"""
            SELECT {_AUTH_SESSION_COLUMNS}
            FROM auth_sessions
            WHERE username = %s AND expires_at > NOW()
            ORDER BY last_active_at DESC
            """,
            (username,),
        )
        return [_auth_session_row_to_dict(row) for row in cursor.fetchall()]
    finally:
        release_connection(conn)


def delete_auth_session_db(session_id: str, username: Optional[str] = None) -> bool:
    """Delete one session (only the user's own when `username` is given)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if username is None:
            cursor.execute("DELETE FROM auth_sessions WHERE id = %s", (session_id,))
        else:
            cursor.execute("DELETE FROM auth_sessions WHERE id = %s AND username = %s", (session_id, username))
        deleted = cursor.rowcount > 0
        conn.commit()
        return deleted
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def delete_other_auth_sessions_db(username: str, keep_session_id: str) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM auth_sessions WHERE username = %s AND id <> %s",
            (username, keep_session_id),
        )
        count = cursor.rowcount
        conn.commit()
        return count
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def list_apns_targets_db(username: str) -> list:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT device_id, apns_token, apns_sandbox, notify_messages, notify_sound, notify_preview
            FROM user_sessions
            WHERE username = %s
              AND apns_token IS NOT NULL
              AND apns_token <> ''
            """,
            (username,),
        )
        return [
            {
                "device_id": str(row[0]),
                "apns_token": row[1],
                "apns_sandbox": bool(row[2]),
                "notify_messages": bool(row[3]) if row[3] is not None else True,
                "notify_sound": bool(row[4]) if row[4] is not None else True,
                "notify_preview": bool(row[5]) if row[5] is not None else True,
            }
            for row in cursor.fetchall()
        ]
    finally:
        release_connection(conn)


def clear_apns_token_db(apns_token: str) -> None:
    token = sanitize_apns_token(apns_token)
    if not token:
        return
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE user_sessions SET apns_token = NULL WHERE apns_token = %s",
            (token,),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


def set_muted_partners_db(username: str, partners: list) -> list:
    cleaned = []
    seen = set()
    for raw in partners:
        if not isinstance(raw, str):
            continue
        partner = raw.strip().lower()
        if not partner or partner == username or partner in seen:
            continue
        seen.add(partner)
        cleaned.append(partner)

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM muted_chats WHERE username = %s", (username,))
        for partner in cleaned:
            cursor.execute(
                """
                INSERT INTO muted_chats (username, partner)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
                """,
                (username, partner),
            )
        conn.commit()
        return cleaned
    except Exception:
        conn.rollback()
        raise
    finally:
        release_connection(conn)


def is_muted_db(username: str, partner: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT 1 FROM muted_chats WHERE username = %s AND partner = %s",
            (username, partner),
        )
        return cursor.fetchone() is not None
    finally:
        release_connection(conn)


def _parse_public_key(public_key_str):
    try:
        return json.loads(public_key_str)
    except (json.JSONDecodeError, TypeError):
        return public_key_str

def _user_row_to_dict(row):
    data = {
        "username": row[0],
        "public_key": _parse_public_key(row[1]),
    }
    if len(row) > 2:
        data["display_name"] = row[2] or ""
        data["bio"] = row[3] or ""
        data["avatar_data"] = row[4] if row[4] else None
    return data


def _pair(a: str, b: str) -> tuple[str, str]:
    """Order-independent key for a 1-on-1 chat."""
    return (a, b) if a <= b else (b, a)


def save_shared_message_db(username: str, message_id: int) -> Optional[dict]:
    """Marks a message saved for both participants (a reference only — no
    content). Idempotent. Returns metadata for WS sync, or None when the
    message doesn't exist or the user isn't in its chat."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT id, sender, receiver, client_message_id
            FROM chat_history
            WHERE id = %s
              AND (sender = %s OR receiver = %s)
        ''', (message_id, username, username))
        row = cursor.fetchone()
        if not row:
            return None
        msg_id, sender, receiver, client_message_id = row
        user_a, user_b = _pair(sender, receiver)
        cursor.execute('''
            INSERT INTO shared_saved_messages (message_id, user_a, user_b, saved_by)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (message_id) DO NOTHING
        ''', (msg_id, user_a, user_b, username))
        # Saving it for everyone again shares it with both again: earlier
        # per-user removals no longer apply.
        cursor.execute('DELETE FROM shared_saved_dismissals WHERE message_id = %s', (msg_id,))
        cursor.execute(
            'SELECT saved_by, saved_at FROM shared_saved_messages WHERE message_id = %s',
            (msg_id,),
        )
        saved_row = cursor.fetchone()
        if saved_row is None:
            raise RuntimeError("The shared save vanished mid-transaction")
        saved_by, saved_at = saved_row
        conn.commit()
        partner = receiver if sender == username else sender
        return {
            "message_id": msg_id,
            "client_message_id": client_message_id,
            "sender": sender,
            "receiver": receiver,
            "partner": partner,
            "saved_by": saved_by,
            "saved_at": saved_at.isoformat() if saved_at else None,
        }
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def get_shared_saved_messages_db(username: str, partner: str) -> list[dict]:
    """Messages saved for everyone in one chat (references only)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        user_a, user_b = _pair(username, partner)
        cursor.execute('''
            SELECT s.message_id, h.client_message_id, h.sender, s.saved_by, s.saved_at
            FROM shared_saved_messages s
            JOIN chat_history h ON h.id = s.message_id
            WHERE s.user_a = %s AND s.user_b = %s
              AND NOT EXISTS (
                  SELECT 1 FROM shared_saved_dismissals d
                  WHERE d.message_id = s.message_id AND d.username = %s
              )
            ORDER BY s.saved_at DESC
        ''', (user_a, user_b, username))
        return [
            {
                "message_id": message_id,
                "client_message_id": client_message_id,
                "sender": sender,
                "saved_by": saved_by,
                "saved_at": saved_at.isoformat() if saved_at else None,
            }
            for message_id, client_message_id, sender, saved_by, saved_at in cursor.fetchall()
        ]
    finally:
        release_connection(conn)




def dismiss_shared_saved_message_db(username: str, message_id: int) -> bool:
    """Remove a shared save from ONE user's Saved Messages (the other
    participant keeps theirs). False when there's no such share in a chat the
    user belongs to."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT 1 FROM shared_saved_messages
            WHERE message_id = %s AND (user_a = %s OR user_b = %s)
        ''', (message_id, username, username))
        if not cursor.fetchone():
            return False
        cursor.execute('''
            INSERT INTO shared_saved_dismissals (message_id, username)
            VALUES (%s, %s)
            ON CONFLICT (message_id, username) DO NOTHING
        ''', (message_id, username))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


# --- CHAT FOLDERS (alembic 0012) ---

_ROOT_NAMES = {"work": "Work", "personal": "Personal"}


def _folder_row_to_dict(row, chat_ids: list) -> dict:
    return {
        "id": str(row[0]),
        "kind": row[1],
        "root": row[1] if row[1] != "custom" else None,
        "parent_id": str(row[2]) if row[2] else None,
        "name": row[3],
        "icon": row[4],
        "position": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
        "chat_ids": chat_ids,
    }


def _ensure_folder_roots(cursor, username: str) -> dict:
    """Work / Personal for this user (made on first use) → {kind: id}."""
    for position, (kind, name) in enumerate(_ROOT_NAMES.items()):
        cursor.execute(
            """
            INSERT INTO folders (username, kind, name, position)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (username, kind) WHERE kind <> 'custom' DO NOTHING
            """,
            (username, kind, name, position),
        )
    cursor.execute(
        "SELECT kind, id FROM folders WHERE username = %s AND kind <> 'custom'",
        (username,),
    )
    return {kind: str(folder_id) for kind, folder_id in cursor.fetchall()}


def _set_folder_chats(cursor, username: str, folder_id: str, chat_ids: list) -> None:
    """Replace a folder's chats. Unknown usernames and the owner are skipped."""
    wanted = []
    for chat_id in chat_ids:
        partner = str(chat_id).strip().lower()
        if partner and partner != username and partner not in wanted:
            wanted.append(partner)
    cursor.execute("DELETE FROM folder_chats WHERE folder_id = %s", (folder_id,))
    if not wanted:
        return
    cursor.execute(
        """
        INSERT INTO folder_chats (folder_id, partner)
        SELECT %s, u.username FROM users u WHERE u.username = ANY(%s)
        ON CONFLICT DO NOTHING
        """,
        (folder_id, wanted),
    )


def _load_folders(cursor, username: str) -> list:
    cursor.execute(
        """
        SELECT f.id, f.kind, f.parent_id, f.name, f.icon, f.position, f.created_at,
               COALESCE(array_agg(fc.partner ORDER BY fc.added_at, fc.partner)
                        FILTER (WHERE fc.partner IS NOT NULL), '{}')
        FROM folders f
        LEFT JOIN folder_chats fc ON fc.folder_id = f.id
        WHERE f.username = %s
        GROUP BY f.id
        ORDER BY (f.kind = 'custom'), f.position, f.created_at
        """,
        (username,),
    )
    return [_folder_row_to_dict(row[:7], list(row[7])) for row in cursor.fetchall()]


def list_folders_db(username: str) -> list:
    """This user's folders — Work and Personal first, then custom ones by position — with chat_ids."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        _ensure_folder_roots(cursor, username)
        folders = _load_folders(cursor, username)
        conn.commit()
        return folders
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def get_folder_db(username: str, folder_id: str) -> Optional[dict]:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        return next((f for f in _load_folders(cursor, username) if f["id"] == folder_id), None)
    finally:
        release_connection(conn)


def create_folder_db(
    username: str,
    root: str,
    name: str,
    icon: Optional[str],
    chat_ids: list,
    folder_id: Optional[str] = None,
    position: Optional[int] = None,
) -> Optional[dict]:
    """A custom folder under Work or Personal. `folder_id` lets the client pick
    the id (optimistic UI); None when that id is already taken."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        roots = _ensure_folder_roots(cursor, username)
        if position is None:
            cursor.execute(
                "SELECT COALESCE(MAX(position) + 1, 0) FROM folders WHERE username = %s AND parent_id = %s",
                (username, roots[root]),
            )
            row = cursor.fetchone()
            position = int(row[0]) if row else 0
        cursor.execute(
            """
            INSERT INTO folders (id, username, kind, parent_id, name, icon, position)
            VALUES (COALESCE(%s::uuid, gen_random_uuid()), %s, 'custom', %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            RETURNING id
            """,
            (folder_id, username, roots[root], name, icon, position),
        )
        row = cursor.fetchone()
        if row is None:
            conn.rollback()
            return None
        new_id = str(row[0])
        _set_folder_chats(cursor, username, new_id, chat_ids)
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)
    return get_folder_db(username, new_id)


def update_folder_db(
    username: str,
    folder_id: str,
    name: Optional[str] = None,
    icon: Optional[str] = None,
    position: Optional[int] = None,
    chat_ids: Optional[list] = None,
    clear_icon: bool = False,
) -> Optional[str]:
    """Patch a folder. Returns None on success, else 'not_found' | 'root_locked'
    (Work / Personal can only change their chats)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT kind FROM folders WHERE id = %s AND username = %s FOR UPDATE",
            (folder_id, username),
        )
        row = cursor.fetchone()
        if row is None:
            conn.rollback()
            return "not_found"
        is_root = row[0] != "custom"
        if is_root and (name is not None or icon is not None or position is not None or clear_icon):
            conn.rollback()
            return "root_locked"
        if name is not None:
            cursor.execute("UPDATE folders SET name = %s WHERE id = %s", (name, folder_id))
        if icon is not None or clear_icon:
            cursor.execute("UPDATE folders SET icon = %s WHERE id = %s", (icon, folder_id))
        if position is not None:
            cursor.execute("UPDATE folders SET position = %s WHERE id = %s", (position, folder_id))
        if chat_ids is not None:
            _set_folder_chats(cursor, username, folder_id, chat_ids)
        conn.commit()
        return None
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def delete_folder_db(username: str, folder_id: str) -> Optional[str]:
    """Delete a custom folder (its chat links go with it; the chats stay).
    None on success, else 'not_found' | 'root_locked'."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT kind FROM folders WHERE id = %s AND username = %s", (folder_id, username))
        row = cursor.fetchone()
        if row is None:
            conn.rollback()
            return "not_found"
        if row[0] != "custom":
            conn.rollback()
            return "root_locked"
        cursor.execute("DELETE FROM folders WHERE id = %s", (folder_id,))
        conn.commit()
        return None
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


# --- ACCOUNT LIFECYCLE: password change, account deletion ---

def verify_user_password_db(username: str, password: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT password_hash FROM users WHERE username = %s", (username,))
        row = cursor.fetchone()
        return bool(row and row[0] and verify_password(password, row[0]))
    finally:
        release_connection(conn)


def change_password_db(
    username: str,
    new_password: str,
    new_encrypted_private_key: str,
    keep_session_id: Optional[str],
) -> list:
    """New password hash + the private key re-encrypted with it (the client
    did that — the server never sees the key), and every other auth session
    ends. Returns the ended session ids. One transaction."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE users SET password_hash = %s, encrypted_private_key = %s WHERE username = %s",
            (hash_password(new_password), new_encrypted_private_key, username),
        )
        if keep_session_id:
            cursor.execute(
                "DELETE FROM auth_sessions WHERE username = %s AND id <> %s RETURNING id",
                (username, keep_session_id),
            )
        else:
            cursor.execute("DELETE FROM auth_sessions WHERE username = %s RETURNING id", (username,))
        revoked = [str(row[0]) for row in cursor.fetchall()]
        conn.commit()
        return revoked
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)


def delete_account_db(username: str) -> list:
    """Erase an account and everything tied to it, in one transaction.
    Tables keyed by username without a foreign key (message history, offline
    queue, reactions, read state, shared saves, revoked devices, others'
    mutes of this user) are cleared explicitly; deleting the users row then
    cascades the rest (auth / device sessions, folders, email codes, mutes).
    Returns the auth session ids that ended (for the token cache)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM auth_sessions WHERE username = %s", (username,))
        sessions = [str(row[0]) for row in cursor.fetchall()]
        cursor.execute(
            "DELETE FROM shared_saved_messages WHERE user_a = %s OR user_b = %s OR saved_by = %s",
            (username, username, username),
        )
        cursor.execute("DELETE FROM shared_saved_dismissals WHERE username = %s", (username,))
        # Reactions by this user, and anyone's reactions on the messages going away
        # (message_reactions.message_id has no foreign key to cascade).
        cursor.execute(
            """
            DELETE FROM message_reactions
            WHERE username = %s
               OR message_id IN (SELECT id FROM chat_history WHERE sender = %s OR receiver = %s)
            """,
            (username, username, username),
        )
        cursor.execute(
            "DELETE FROM chat_history WHERE sender = %s OR receiver = %s",
            (username, username),
        )
        cursor.execute(
            "DELETE FROM offline_messages WHERE sender = %s OR receiver = %s",
            (username, username),
        )
        cursor.execute(
            "DELETE FROM conversation_read_state WHERE username = %s OR partner = %s",
            (username, username),
        )
        cursor.execute("DELETE FROM revoked_device_sessions WHERE username = %s", (username,))
        cursor.execute("DELETE FROM muted_chats WHERE partner = %s", (username,))
        cursor.execute("DELETE FROM users WHERE username = %s", (username,))
        conn.commit()
        return sessions
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        release_connection(conn)
