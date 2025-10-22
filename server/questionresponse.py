

import sqlite3
import os
from typing import Optional
import config

DB_DIR = os.path.join(os.getcwd(), getattr(config, 'DB_DIR', 'data'))
DB_PATH = os.path.join(DB_DIR, 'questionresponse.db')

def init_db() -> None:
    """Initialize the responses table if it does not exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            question_id INTEGER,
            question_text TEXT,
            selected_option TEXT,
            name TEXT
        )''')
        conn.commit()

def save_response(
    question_id: int,
    question_text: str,
    selected_option: str,
    name: Optional[str] = None
) -> None:
    """Save a pre-analysis question response."""
    with sqlite3.connect(DB_PATH) as conn:
        c = conn.cursor()
        c.execute(
            '''INSERT INTO responses (question_id, question_text, selected_option, name) VALUES (?, ?, ?, ?)''',
            (question_id, question_text, selected_option, name)
        )
        conn.commit()
