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
    "joy": ["Happy", "Uplifting", "Light-hearted"],
    "anger": ["Tense", "Dark"],
    "sadness": ["Sad", "Emotional", "Reflective"],
    "surprise": ["Adventurous", "Suspense"],
    "love": ["Romantic", "Emotional"],
    "fear": ["Scary", "Tense"],
    "disgust": ["Dark", "Tense"],
    "neutral": ["Reflective", "Emotional"],
    "admiration": ["Uplifting", "Emotional"],
    "approval": ["Uplifting", "Light-hearted"],
    "caring": ["Emotional", "Reflective"],
    "curiosity": ["Adventurous", "Light-hearted"],
    "desire": ["Romantic", "Emotional"],
    "embarrassment": ["Reflective", "Sad"],
    "excitement": ["Happy", "Adventurous"],
    "gratitude": ["Uplifting", "Light-hearted"],
    "nervousness": ["Tense", "Suspense"],
    "optimism": ["Uplifting", "Happy"],
    "pride": ["Happy", "Uplifting"],
    "realization": ["Reflective", "Emotional"],
    "relief": ["Light-hearted", "Uplifting"],
    "remorse": ["Sad", "Reflective"],
    "confusion": ["Suspense", "Reflective"],
    "grief": ["Sad", "Emotional"],
    "annoyance": ["Tense", "Dark"],
    "disappointment": ["Sad", "Reflective"],
    "amusement": ["Light-hearted", "Happy"]
}
def analyze_mood(text, emoji):
    # Get emotion scores
    raw_results = classifier(text)[0]
    print(raw_results)
    # Filter top emotions with score > 0.6
    top_emotions = [emo for emo in raw_results if emo["score"] > 0.1]
    top_emotions = sorted(top_emotions, key=lambda x: x["score"], reverse=True)
   
    # Accumulate genre scores
    genre_scores = defaultdict(float)

    # From text emotion
    for emo in top_emotions:
        label = emo["label"].lower()
        score = emo["score"]
        genres = emotion_to_genres.get(label, [])
        for g in genres:
            genre_scores[g] += score

    # From emoji (optional boost)
    emoji_genres = emoji_to_genres.get(emoji, [])
    for g in emoji_genres:
        genre_scores[g] += 0.1
        genre_scores[g] = min(genre_scores[g], 1)

    # Filter and sort genres with score > 0.6
    ranked_genres = sorted(
        [{"genre": genre, "score": round(score, 3)} for genre, score in genre_scores.items() if score > 0.1],
        key=lambda x: x["score"],
        reverse=True
    )

    print("Filtered Genres:", ranked_genres)
    print("Filtered Emotions:", top_emotions)

    return ranked_genres, top_emotions

