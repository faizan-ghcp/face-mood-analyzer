from deepface import DeepFace
from server.utils import base64_to_pil, pil_to_np
import numpy as np
from typing import Dict, Any


def _normalize_deepface_output(analysis_raw: Any) -> Dict[str, Any]:
    """Normalize DeepFace.analyze output to a dict with keys 'dominant_emotion' and 'emotion'.

    DeepFace may return either a dict (single face) or a list (multiple faces). If a list is
    returned, pick the first detected face. If fields are missing, return sensible defaults.
    """
    if isinstance(analysis_raw, list):
        if len(analysis_raw) == 0:
            return {"dominant_emotion": "neutral", "emotion": {}}
        analysis = analysis_raw[0]
    elif isinstance(analysis_raw, dict):
        analysis = analysis_raw
    else:
        # Unknown shape
        return {"dominant_emotion": "neutral", "emotion": {}}

    emotions_raw = analysis.get("emotion") if isinstance(analysis, dict) else None
    if not isinstance(emotions_raw, dict):
        emotions_raw = {}

    dominant = analysis.get("dominant_emotion") if isinstance(analysis, dict) else None
    return {"dominant_emotion": dominant or None, "emotion": emotions_raw}


def analyze_image(image_base64: str) -> dict:
    """Return dominant emotion and emotion scores (0-100) from a base64 image.

    Always returns a dict: {"dominant_emotion": str, "emotions": dict}
    """
    pil = base64_to_pil(image_base64)
    img = pil_to_np(pil)

    # DeepFace can accept a numpy array directly. enforce_detection=True will raise if no face is found.
    analysis_raw = DeepFace.analyze(img_path=img, actions=["emotion"], enforce_detection=True)

    normalized = _normalize_deepface_output(analysis_raw)
    emotions_raw = normalized.get("emotion", {})
    emotions = {k: round(float(v), 2) for k, v in emotions_raw.items()} if isinstance(emotions_raw, dict) else {}

    dominant = normalized.get("dominant_emotion") or (max(emotions, key=emotions.get) if emotions else "neutral")
    return {"dominant_emotion": dominant, "emotions": emotions}
