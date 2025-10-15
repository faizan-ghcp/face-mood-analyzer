from server.journaling import init_db, save_entry, get_history
import os

def test_journaling_save_and_get():
    # Ensure DB exists
    init_db()
    emotions = {"happy": 70.0, "sad": 5.0, "neutral": 25.0}
    rowid = save_entry("happy", 70.0, emotions, name="unit test")
    assert isinstance(rowid, int) and rowid > 0

    history = get_history(limit=5)
    assert isinstance(history, list)
    assert any(h["id"] == rowid for h in history) or any(h["id"] == rowid for h in history)
    rec = next(h for h in history if h["id"] == rowid)
    assert rec["dominant"] == "happy"
    assert abs(rec["intensity"] - 70.0) < 1e-6
    assert isinstance(rec["emotions"], dict)
    assert rec["name"] == "unit test"
