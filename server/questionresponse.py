import sqlite3
import os
from typing import Optional

DB_PATH = os.path.join(os.getcwd(), 'questionresponse.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
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
    conn.close()

def save_response(question_id: int, question_text: str, selected_option: str, name: Optional[str] = None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''INSERT INTO responses (question_id, question_text, selected_option, name) VALUES (?, ?, ?, ?)''',
              (question_id, question_text, selected_option, name))
    conn.commit()
    conn.close()



# make signup/login system, save initial response with user id, make user menu, history of results, music therapy/ chatbot
