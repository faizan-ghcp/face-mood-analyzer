import base64
import io
from PIL import Image
import numpy as np

def base64_to_pil(b64str: str) -> Image.Image:
    # b64str expected like "data:image/png;base64,...."
    if b64str.startswith("data:"):
        b64str = b64str.split(",", 1)[1]
    img_bytes = base64.b64decode(b64str)
    return Image.open(io.BytesIO(img_bytes)).convert("RGB")

def pil_to_np(img: Image.Image) -> np.ndarray:
    return np.array(img)
