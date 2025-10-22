
import sqlite3
import os
import hashlib
import jwt
from datetime import datetime, timedelta
from typing import Optional
import config

SECRET_KEY = getattr(config, 'SECRET_KEY', 'face-mood-2025-super-secret-key')
DB_DIR = os.path.join(os.getcwd(), getattr(config, 'DB_DIR', 'data'))
DB_PATH = os.path.join(DB_DIR, 'auth.db')

def init_db() -> None:
    """Initialize the users table if it does not exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password_hash TEXT
        )''')
        conn.commit()

def hash_password(password: str) -> str:
    """Hash a password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()

def signup(username: str, password: str) -> bool:
    """Register a new user. Returns True if successful, False if username exists."""
    try:
        with sqlite3.connect(DB_PATH) as conn:
            c = conn.cursor()
            c.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)',
                      (username, hash_password(password)))
            conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False

def login(username: str, password: str) -> Optional[str]:
    """Authenticate user and return JWT if valid, else None."""
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('SELECT id, password_hash FROM users WHERE username = ?', (username,))
        row = c.fetchone()
    if row and row[1] == hash_password(password):
        payload = {
            'user_id': row[0],
            'username': username,
            'exp': datetime.utcnow() + timedelta(hours=12)
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
        return token
    return None
