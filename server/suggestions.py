def generate_tips(emotion: str, intensity: float):
    emotion = (emotion or "").lower()
    tips = []

    if intensity >= 70:
        severity = "high"
    elif intensity >= 40:
        severity = "moderate"
    else:
        severity = "low"

    if emotion == "happy":
        tips.append("Nice! Keep doing what you're doing — try to capture this moment.")
        tips.append("Share your happiness with someone or jot down three things you're grateful for.")
    elif emotion == "sad":
        tips.append("Try writing about what's bothering you — journaling often helps.")
        tips.append("Connect with a friend or take a short walk to change environment.")
        if severity == "high":
            tips.append("If sadness is intense or persistent, consider talking to a mental health professional.")
    elif emotion == "angry":
        tips.append("Pause: take 5 slow deep breaths (inhale 4s, hold 4s, exhale 6s)." )
        tips.append("Step away from the trigger for a few minutes — a short walk can help calm your body.")
        if severity == "high":
            tips.append("Use progressive muscle relaxation or count back from 100 to refocus.")
    elif emotion == "surprise":
        tips.append("Take a moment to orient yourself and label what surprised you.")
        tips.append("If surprised positively, jot it down; if negatively, take a deep breath and assess.")
    elif emotion == "fear":
        tips.append("Grounding: name 5 things you can see, 4 you can touch, 3 you can hear.")
        tips.append("Try controlled breathing and remind yourself you are safe right now.")
        if severity == "high":
            tips.append("If fear/anxiety is frequent, consider talking to a counselor.")
    elif emotion == "disgust":
        tips.append("Shift attention to something neutral or pleasant (favorite song, gentle stretch)." )
        tips.append("Practice slow breathing and try to reframe the thought causing disgust.")
    else:
        tips.append("You're neutral — maybe try a short activity you enjoy (music, stretch, drink water)." )

    prefix = {
        'low': 'Mild intensity detected — a short break may help.',
    'moderate': 'Moderate intensity — try 5-10 minutes of intentional grounding or breathing.',
    'high': 'High intensity — prioritize calming actions now.'
    }

    return [prefix.get(severity, '')] + tips
