
from flask import Flask, render_template, request, jsonify, redirect, url_for
from server.analysis import analyze_image
from server.suggestions import generate_tips
from server import journaling
from server.journaling import get_db_connection
from server import auth
from server import admin
import config
import jwt
import datetime
from functools import wraps
from werkzeug.security import check_password_hash

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config['SECRET_KEY'] = getattr(config, 'SECRET_KEY', 'your-very-secret-key')

from werkzeug.security import check_password_hash
# Initialize DB on startup
journaling.init_db()
auth.init_db()
admin.init_admin_db()

def admin_token_required(f):
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

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if admin.verify_admin(username, password):
            token = jwt.encode({
                'username': username,
                'is_admin': True,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=2)
            }, app.config['SECRET_KEY'], algorithm="HS256")
            resp = redirect(url_for('admin_dashboard'))
            resp.set_cookie('admin_token', token, httponly=True, samesite='Lax')
            return resp
        return render_template('admin_login.html', error="Invalid credentials")
    return render_template('admin_login.html')

@app.route('/admin/dashboard')
@admin_token_required
def admin_dashboard():
    return render_template('admin_dashboard.html')

@app.route('/logout_admin')
def logout_admin():
    resp = redirect(url_for('admin_login'))

# Admin mood history page
@app.route('/admin/history')
@admin_token_required
def admin_history():
    return render_template('admin_history.html')

# Admin mood history data API
@app.route('/admin/mood_history')
@admin_token_required
def admin_mood_history_data():
    # Show all users' mood history
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('SELECT id, username, mood, date FROM mood_history ORDER BY date DESC')
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return jsonify(rows)

# Admin delete mood entry
@app.route('/admin/delete_mood/<int:id>', methods=['DELETE'])
@admin_token_required
def admin_delete_mood(id):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute('DELETE FROM mood_history WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return '', 204
    resp.set_cookie('admin_token', '', expires=0)
    return resp

# Initialize DB on startup
journaling.init_db()
auth.init_db()


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
        scores = result["emotions"]  # dict of emotion: score (0-100)
        intensity = scores.get(dominant, 0)  # intensity percentage
        tips = generate_tips(dominant, intensity)

        return jsonify({
            "dominant_emotion": dominant,
            "intensity": intensity,
            "emotions": scores,
            "tips": tips
        })
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

@app.route("/save_result", methods=["POST"])
def save_result():
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "No payload"}), 400

    dominant = payload.get("dominant_emotion")
    intensity = payload.get("intensity")
    emotions = payload.get("emotions")
    name = payload.get("name") if payload.get("name") else None

    if not dominant or intensity is None or emotions is None:
        return jsonify({"error": "Missing fields"}), 400

    try:
        rowid = journaling.save_entry(dominant, float(intensity), emotions, name)
        return jsonify({"status": "ok", "id": rowid})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/history", methods=["GET"])
def api_history():
    try:
        limit = int(request.args.get("limit", 200))
    except Exception:
        limit = 200
    data = journaling.get_history(limit=limit)
    return jsonify({"history": data})

@app.route("/history")
def history_page():
    return render_template("history.html")


if __name__ == "__main__":
    # Config values from config.py
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
