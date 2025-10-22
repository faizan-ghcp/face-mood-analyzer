
import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import config

DB_DIR = os.path.join(os.getcwd(), config.DB_DIR)
DB_PATH = os.path.join(DB_DIR, config.DB_NAME)

SCHEMA = """
CREATE TABLE IF NOT EXISTS mood_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    dominant TEXT NOT NULL,
    intensity REAL NOT NULL,
    emotions TEXT NOT NULL,
    note TEXT,
    username TEXT
);
"""

def get_db_connection() -> sqlite3.Connection:
    """Get a new database connection to the mood_history DB."""
    return sqlite3.connect(DB_PATH)

def init_db() -> None:
    """Initialize the mood_history table if it does not exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript(SCHEMA)
        conn.commit()

def save_entry(
    dominant: str,
    intensity: float,
    emotions: Dict[str, float],
    username: Optional[str] = None,
    note: Optional[str] = None
) -> int:
    """Save a mood entry to the database."""
    ts = datetime.utcnow().isoformat() + "Z"
    emotions_json = json.dumps(emotions)
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO mood_history (timestamp, dominant, intensity, emotions, note, username) VALUES (?, ?, ?, ?, ?, ?)",
            (ts, dominant, intensity, emotions_json, note, username)
        )
        conn.commit()
        return cur.lastrowid

def get_history(limit: int = 200) -> List[Dict[str, Any]]:
    """Retrieve mood history entries, most recent first."""
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, timestamp, dominant, intensity, emotions, note, username FROM mood_history ORDER BY id DESC LIMIT ?",
            (limit,)
        )
        rows = cur.fetchall()
        result = []
        for r in rows:
            eid, timestamp, dominant, intensity, emotions_json, note, username = r
            try:
                emotions = json.loads(emotions_json)
            except Exception:
                emotions = {}
            if username is None:
                username = "Anonymous"
            result.append({
                "id": eid,
                "timestamp": timestamp,
                "dominant": dominant,
                "intensity": float(intensity),
                "emotions": emotions,
                "note": note,
                "username": username
            })
        return result

def delete_entry(entry_id: int) -> bool:
    """Delete a mood entry by its ID. Returns True if deleted."""
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM mood_history WHERE id = ?", (entry_id,))
        conn.commit()
        return cur.rowcount > 0
