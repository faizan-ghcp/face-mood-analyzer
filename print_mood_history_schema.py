import sqlite3
import os

db_path = os.path.join('data', 'mood_history.db')

conn = sqlite3.connect(db_path)
c = conn.cursor()

# Print schema
print('Current schema:')
for row in c.execute("select * from mood_history order by id desc limit 5"):
    print(row)

conn.close()
