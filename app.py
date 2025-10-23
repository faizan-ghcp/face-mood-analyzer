from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response
from functools import wraps
from werkzeug.security import check_password_hash
import jwt
import datetime
import functools
import sqlite3
import json

# --- Internal imports ---
from server.analysis import analyze_image
from server.suggestions import generate_tips
from server import journaling, auth, admin
from server.journaling import get_db_connection, DB_PATH
import config


# --- Flask app setup ---
app = Flask(__name__, static_folder="static", template_folder="templates")
app.config['SECRET_KEY'] = getattr(config, 'SECRET_KEY', 'face-mood-2025-super-secret-key')

# --- Initialize databases ---
journaling.init_db()
auth.init_db()
admin.init_admin_db()

# ============================================================
#  JWT / AUTH HELPERS
# ============================================================

def admin_token_required(f):
    """Protect admin-only routes with JWT verification."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('admin_token')
        if not token:
            return redirect(url_for('admin_login'))
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            if not data.get('is_admin'):
                return redirect(url_for('admin_login'))
        except Exception:
            return redirect(url_for('admin_login'))
        return f(*args, **kwargs)
    return decorated


def login_required(f):
    """Protect user routes (JWT from header or cookie)."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check Authorization header
        if 'Authorization' in request.headers:
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ', 1)[1]
        # Fallback: check cookie
        if not token:
            token = request.cookies.get('jwt')
        if not token:
            return redirect(url_for('login_page'))
        try:
            jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        except Exception:
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated


# ============================================================
#  ADMIN ROUTES
# ============================================================

@app.route('/admin/check_session')
def admin_check_session():
    """Frontend JS session check for admin panel."""
    token = request.cookies.get('admin_token')
    if not token:
        return jsonify({'error': 'Not authenticated'}), 401
    try:
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        if not data.get('is_admin'):
            return jsonify({'error': 'Not admin'}), 401
    except Exception:
        return jsonify({'error': 'Invalid or expired token'}), 401
    return jsonify({'ok': True})


@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']

        if admin.verify_admin(username, password):
            payload = {
                'username': username,
                'is_admin': True,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
            }
            token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm="HS256")
            resp = redirect(url_for('admin_dashboard'))
            # For dev — set secure=False; use secure=True in production
            resp.set_cookie('admin_token', token, httponly=True, samesite='Lax', secure=False)
            return resp
        else:
            return render_template('admin_login.html', error="Invalid credentials")
    return render_template('admin_login.html')


@app.route('/admin/dashboard')
@admin_token_required
def admin_dashboard():
    return render_template('admin_dashboard.html')


@app.route('/logout_admin')
def logout_admin():
    """Clear admin session cookie."""
    resp = redirect(url_for('admin_login'))
    resp.set_cookie('admin_token', '', expires=0)
    return resp


@app.route('/admin/history')
@admin_token_required
def admin_history():
    return render_template('admin_history.html')


@app.route('/admin/mood_history')
@admin_token_required
def admin_mood_history_data():
    """Return all users' mood history."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT id, username, dominant, intensity, timestamp, note FROM mood_history ORDER BY id DESC')
    rows = [
        {'id': r[0], 'username': r[1], 'mood': r[2], 'intensity': r[3], 'date': r[4], 'note': r[5]}
        for r in cur.fetchall()
    ]
    conn.close()
    return jsonify(rows)


@app.route('/admin/delete_mood/<int:id>', methods=['DELETE'])
@admin_token_required
def admin_delete_mood(id):
    """Delete a mood entry by ID."""
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM mood_history WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return '', 204


# ============================================================
#  USER AUTH ROUTES
# ============================================================

@app.route("/login")
def login_page():
    return render_template("login.html")


@app.route("/signup")
def signup_page():
    return render_template("signup.html")


@app.route("/api/signup", methods=["POST"])
def api_signup():
    payload = request.get_json()
    username = payload.get("username")
    password = payload.get("password")

    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400

    success = auth.signup(username, password)
    if success:
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Username already exists"}), 400


@app.route("/api/login", methods=["POST"])
def api_login():
    payload = request.get_json()
    username = payload.get("username")
    password = payload.get("password")

    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400

    token = auth.login(username, password)
    if token:
        return jsonify({"token": token})
    else:
        return jsonify({"error": "Invalid credentials"}), 401


# ============================================================
#  MOOD ANALYSIS ROUTES
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    payload = request.get_json()
    img_b64 = payload.get("image")

    if not img_b64:
        return jsonify({"error": "No image provided"}), 400

    try:
        result = analyze_image(img_b64)
        dominant = result["dominant_emotion"]
        scores = result["emotions"]
        intensity = scores.get(dominant, 0)
        tips = generate_tips(dominant, intensity)

        return jsonify({
            "dominant_emotion": dominant,
            "intensity": intensity,
            "emotions": scores,
            "tips": tips
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/save_result", methods=["POST"])
def save_result():
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "No payload"}), 400

    dominant = payload.get("dominant_emotion")
    intensity = payload.get("intensity")
    emotions = payload.get("emotions")
    username = payload.get("name") or None
    note = payload.get("note") or None

    if not dominant or intensity is None or emotions is None:
        return jsonify({"error": "Missing fields"}), 400

    try:
        rowid = journaling.save_entry(dominant, float(intensity), emotions, username, note)
        return jsonify({"status": "ok", "id": rowid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/delete_entry", methods=["POST"])
def api_delete_entry():
    payload = request.get_json()
    entry_id = payload.get("id")
    if not entry_id:
        return jsonify({"error": "Missing id"}), 400

    try:
        deleted = journaling.delete_entry(int(entry_id))
        if deleted:
            return jsonify({"status": "ok"})
        else:
            return jsonify({"error": "Entry not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================
#  HISTORY ROUTES
# ============================================================

@app.route("/api/history", methods=["GET"])
def api_history():
    try:
        limit = int(request.args.get("limit", 200))
    except Exception:
        limit = 200

    date_filter = request.args.get("date")

    token = None
    if 'Authorization' in request.headers:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
    if not token:
        token = request.cookies.get('jwt')

    if not token:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        username = payload.get('username')
        is_admin = payload.get('is_admin', False)
    except Exception:
        return jsonify({"error": "Invalid or expired token"}), 401

    data = []
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        base_query = "SELECT id, timestamp, dominant, intensity, emotions, note, username FROM mood_history"
        where_clauses = []
        params = []
        if not is_admin and username:
            where_clauses.append("username = ?")
            params.append(username)
        if date_filter:
            # date_filter is YYYY-MM-DD, timestamp is ISO string
            where_clauses.append("date(timestamp) = ?")
            params.append(date_filter)
        where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
        order_limit_sql = " ORDER BY id DESC LIMIT ?"
        params.append(limit)
        query = base_query + where_sql + order_limit_sql
        cur.execute(query, tuple(params))
        rows = cur.fetchall()

        for r in rows:
            eid, timestamp, dominant, intensity, emotions_json, note, uname = r
            try:
                emotions = json.loads(emotions_json)
            except Exception:
                emotions = {}
            data.append({
                "id": eid,
                "timestamp": timestamp,
                "dominant": dominant,
                "intensity": float(intensity),
                "emotions": emotions,
                "note": note,
                "username": uname or "Anonymous"
            })
    return jsonify({"history": data})


@app.route("/history")
def history_page():
    return render_template("history.html")


@app.route('/view_moods_by_date')
def view_moods_by_date_page():
    return render_template('view_moods_by_date.html')


# ============================================================
#  APP ENTRY POINT
# ============================================================

if __name__ == "__main__":
    app.run(host=config.HOST, port=config.PORT, debug=True, use_reloader=True)
