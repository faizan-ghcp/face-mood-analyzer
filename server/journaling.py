def delete_entry(entry_id: int) -> bool:
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM mood_history WHERE id = ?", (entry_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()
import sqlite3
import json
import os
from datetime import datetime
from typing import List, Dict, Any
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
    note TEXT
);
"""

def init_db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()

def save_entry(dominant: str, intensity: float, emotions: Dict[str, float], name: str | None = None) -> int:
    ts = datetime.utcnow().isoformat() + "Z"
    emotions_json = json.dumps(emotions)
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO mood_history (timestamp, dominant, intensity, emotions, note) VALUES (?, ?, ?, ?, ?)",
            (ts, dominant, intensity, emotions_json, name)
        )
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()

def get_history(limit: int = 200) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, timestamp, dominant, intensity, emotions, note as name FROM mood_history ORDER BY id DESC LIMIT ?", (limit,))
        rows = cur.fetchall()
        result = []
        for r in rows:
            eid, timestamp, dominant, intensity, emotions_json, name = r
            try:
                emotions = json.loads(emotions_json)
            except Exception:
                emotions = {}
            result.append({
                "id": eid,
                "timestamp": timestamp,
                "dominant": dominant,
                "intensity": float(intensity),
                "emotions": emotions,
                "name": name
            })
        return result
    finally:
        conn.close()
