from transformers import pipeline
from collections import defaultdict
from flask import jsonify
classifier = pipeline(
    "text-classification",
    model="joeddav/distilbert-base-uncased-go-emotions-student",
    return_all_scores=True,
    top_k=None  # get all classes
)

# Define genre mappings
emoji_to_genres = {
    "happy": ["Happy", "Uplifting", "Light-hearted"],
    "sad": ["Sad", "Emotional", "Reflective"],
    "angry": ["Tense", "Dark"],
    "tired": ["Happy", "Light-hearted"],
    "love": ["Romantic", "Emotional"],
    "cool": ["Adventurous", "Light-hearted"],
    "shocked": ["Suspense", "Tense"],
    "thinking": ["Reflective", "Emotional"]
}

emotion_to_genres = {
    "joy": [("Happy", 0.4), ("Light-hearted", 0.3), ("Adventurous", 0.3)],
    "anger": [("Tense", 0.4), ("Dark", 0.3), ("Suspense", 0.3)],
    "sadness": [("Sad", 0.4), ("Emotional", 0.3), ("Uplifting", 0.2), ("Happy", 0.1)],
    "surprise": [("Adventurous", 0.4), ("Suspense", 0.3), ("Scary", 0.3)],
    "love": [("Romantic", 0.4), ("Emotional", 0.3), ("Happy", 0.3)],
    "fear": [("Scary", 0.4), ("Tense", 0.3), ("Suspense", 0.3)],
    "disgust": [("Dark", 0.4), ("Tense", 0.3), ("Reflective", 0.3)],
    "neutral": [("Reflective", 0.2), ("Adventurous", 0.2), ("Romantic", 0.2), ("Suspense", 0.2), ("Light-hearted", 0.2)],
    "admiration": [("Romantic", 0.4), ("Emotional", 0.3), ("Happy", 0.3)],
    "approval": [("Uplifting", 0.3), ("Light-hearted", 0.3), ("Happy", 0.3), ("Romantic", 0.1)],
    "caring": [("Emotional", 0.4), ("Reflective", 0.3), ("Romantic", 0.3)],
    "curiosity": [("Adventurous", 0.4), ("Suspense", 0.3), ("Reflective", 0.3)],
    "desire": [("Romantic", 0.2), ("Adventurous", 0.3), ("Emotional", 0.2), ("Light-hearted", 0.3)],
    "embarrassment": [("Reflective", 0.4), ("Sad", 0.3), ("Light-hearted", 0.3)],
    "excitement": [("Adventurous", 0.4), ("Happy", 0.3), ("Suspense", 0.3)],
    "gratitude": [("Uplifting", 0.3), ("Happy", 0.3), ("Light-hearted", 0.3), ("Emotional", 0.1)],
    "nervousness": [("Tense", 0.4), ("Suspense", 0.3), ("Reflective", 0.3)],
    "optimism": [("Adventurous", 0.4), ("Happy", 0.3), ("Light-hearted", 0.3)],
    "pride": [("Happy", 0.4), ("Adventurous", 0.3), ("Reflective", 0.3)],
    "realization": [("Reflective", 0.4), ("Emotional", 0.3), ("Uplifting", 0.3)],
    "relief": [("Light-hearted", 0.4), ("Happy", 0.3), ("Uplifting", 0.3)],
    "remorse": [("Dark", 0.4), ("Reflective", 0.3), ("Sad", 0.3)],
    "confusion": [("Suspense", 0.4), ("Reflective", 0.3), ("Emotional", 0.3)],
    "grief": [("Sad", 0.4), ("Emotional", 0.3), ("Reflective", 0.2), ("Uplifting", 0.1)],
    "annoyance": [("Tense", 0.4), ("Dark", 0.3), ("Suspense", 0.3)],
    "disappointment": [("Sad", 0.4), ("Reflective", 0.3), ("Emotional", 0.3)],
    "amusement": [("Light-hearted", 0.4), ("Happy", 0.3), ("Uplifting", 0.3)]
}

def analyze_mood(text, emoji):
    # Get emotion scores
    raw_results = classifier(text)[0]

    top_emotions = sorted(raw_results, key=lambda x: x["score"], reverse=True)[:3]


    # Accumulate genre scores
    genre_scores = defaultdict(float)

    # From text emotion
    for emo in top_emotions:
        label = emo["label"].lower()
        score = emo["score"]
        genres = emotion_to_genres.get(label, [])

        for genre, weight in genres:
            genre_scores[genre] += score * weight


    # From emoji (optional boost)
    emoji_genres = emoji_to_genres.get(emoji, [])
    for g in emoji_genres:
        genre_scores[g] += 0.1
        genre_scores[g] = min(genre_scores[g], 1)

    # Filter and sort genres 
    ranked_genres = sorted(
        [{"genre": genre, "score": round(score, 3)} for genre, score in genre_scores.items()],
        key=lambda x: x["score"],
        reverse=True
    )[:4]

    print("Filtered Genres:", ranked_genres)
    print("Filtered Emotions:", top_emotions)

    return ranked_genres, top_emotions

