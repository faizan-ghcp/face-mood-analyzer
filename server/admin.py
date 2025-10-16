import sqlite3
import os
from werkzeug.security import generate_password_hash, check_password_hash

def init_admin_db():
    conn = sqlite3.connect('questionresponse.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
    )''')
    conn.commit()
    conn.close()

def create_admin(username, password):
    conn = sqlite3.connect('questionresponse.db')
    c = conn.cursor()
    c.execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)',
              (username, generate_password_hash(password)))
    conn.commit()
    conn.close()

def verify_admin(username, password):
    conn = sqlite3.connect('questionresponse.db')
    c = conn.cursor()
    c.execute('SELECT password_hash FROM admins WHERE username=?', (username,))
    row = c.fetchone()
    conn.close()
    if row and check_password_hash(row[0], password):
        return True
    return False
