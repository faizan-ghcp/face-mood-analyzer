

from flask import Flask, render_template, request, jsonify
from server.analysis import analyze_image
from server.suggestions import generate_tips
from server import journaling
import config

app = Flask(__name__, static_folder="static", template_folder="templates")

# Initialize DB on startup
journaling.init_db()


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
