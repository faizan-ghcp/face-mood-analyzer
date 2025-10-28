# Emotion Aware AI

A Flask web app that captures a webcam image, performs emotion analysis using DeepFace, returns emotion intensities and suggestions, and stores optional mood-history entries locally (SQLite).

## Quick start (local)

1. Create and activate virtualenv
   ```bash
   python -m venv venv
   source venv/bin/activate   # Windows: venv\Scripts\activate
   ```

2. Install dependencies
   ```bash
   pip install -r requirements.txt
   ```

3. Run the server
   ```bash
   python app.py
   ```

4. Open http://localhost:5000

> name: DeepFace will download pretrained models on first run (network access required) and may take several minutes.

## Features included
- Webcam capture and emotion detection (DeepFace)
- Emotion intensity chart (Chart.js)
- Contextual suggestions based on emotion + intensity
- Optional save to local SQLite mood history (names supported)
- History dashboard with timeline and table
- Lightweight tests for journaling

## Privacy and ethics
This app processes images for emotion inference. If you run it on a public server:
- Obtain explicit user consent before analyzing or storing images.
- Secure the SQLite DB and consider encryption for stored data.
- Add clear disclaimers: not for clinical or high-stakes use.
