import sqlite3
import os

db_path = os.path.join('data', 'mood_history.db')
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Check if 'username' column exists
def has_username_column():
    c.execute("PRAGMA table_info(mood_history)")
    cols = [row[1] for row in c.fetchall()]
    return 'username' in cols

if not has_username_column():
    print("Adding 'username' column to mood_history...")
    c.execute("ALTER TABLE mood_history ADD COLUMN username TEXT;")
    conn.commit()
    print("Column added.")
else:
    print("'username' column already exists.")

conn.close()
