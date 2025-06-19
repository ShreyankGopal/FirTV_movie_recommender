from flask import Flask, request, jsonify
import numpy as np
import pinecone
from addUserEmbeddings import getColdStartUserEmbedding
from flask_cors import CORS
from transformers import pipeline
from collections import defaultdict
from getUserEmbeddings import getRecommendation
from getBertEmbedding import get_bert_embedding
from moodDetector import analyze_mood
import torch
from transformers import BertTokenizer, BertModel
from MoodEmbeddingPrompt import build_embedding_prompt
app = Flask(__name__)
CORS(app)
tokenizer = BertTokenizer.from_pretrained("bert-base-uncased")
bert_model = BertModel.from_pretrained("bert-base-uncased")
# Load the emotion model
# classifier = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", return_all_scores=True)

# Initialize Pinecone client
pinecone_client = pinecone.Pinecone(
    api_key="pcsk_2Jm5Rp_4UAaRmLzEAAxZTMHGdrADfVZBFMym3FYYcXW478wG8SKLL5Q1hRTVh1P6JqbhaV",
    environment="us-east-1"
)
index_name = "movies-index"
pinecone_index = pinecone_client.Index(index_name)
@app.route('/getMoodRecommendation', methods=['POST'])
def getMoodRecommendation():
    data = request.json
    text = data.get("text", "")
    emoji = (data.get("emoji") or "").lower()

    # Step 1: Analyze mood → Get genres and emotions
    ranked_genres, top_emotions = analyze_mood(text, emoji)

    # Step 2: Build text prompts
    emotion_labels = [emo["label"] for emo in top_emotions[:3]]  # Top 3 emotions
    genre_labels = [g["genre"] for g in ranked_genres[:3]]        # Top 3 genres

    emotion_text = f"The user is feeling {', '.join(emotion_labels)}."
    genre_text = f"Recommended genres are {', '.join(genre_labels)}."
    user_text = f"User input: {text}"

    # Step 3: Get embeddings
    emotion_embedding = get_bert_embedding(emotion_text, tokenizer, bert_model)
    genre_embedding = get_bert_embedding(genre_text, tokenizer, bert_model)
    text_embedding = get_bert_embedding(user_text, tokenizer, bert_model)

    # Step 4: Weighted combination of embeddings
    weight_text = 0.4
    weight_emotion = 0.3
    weight_genre = 0.3

    combined_embedding = (
        weight_text * text_embedding +
        weight_emotion * emotion_embedding +
        weight_genre * genre_embedding
    )

    # Step 5: Query Pinecone
    response = pinecone_index.query(
        vector=combined_embedding.tolist(),
        top_k=10,
        namespace="",  # default namespace
        include_metadata=False
    )

    movie_ids = [match['id'].split('.')[0] for match in response['matches']]

    # Step 6: Return response
    return jsonify({
        "emoji": emoji,
        "text_emotions": [
            {"label": emo["label"], "score": round(emo["score"], 3)}
            for emo in top_emotions
        ],
        "ranked_genres": ranked_genres,
        "movie_ids": movie_ids
    })

@app.route('/getRecommendation', methods=['POST'])
def get_recommendation():
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        print("Flask received user_id:", user_id)

        # Call your existing recommendation function
        index = pinecone_client.Index(index_name)
        recommended_movie_ids = getRecommendation(user_id, index)
        print("Recommended movie IDs:", recommended_movie_ids)

        return jsonify({"recommended_movie_ids": recommended_movie_ids}), 200
    except Exception as e:
        print("Error in Flask /getRecommendation:", str(e))
        return jsonify({"error": str(e)}), 500

@app.route('/AddUserEmbedding', methods=['POST'])
def add_user_embedding():
    try:
        data = request.get_json()
        print("Incoming data:", data)
        
        if not data or 'user_id' not in data or 'movie_ids' not in data:
            return jsonify({"error": "Missing required fields: 'user_id' and 'movie_ids' are required"}), 400
        
        user_id = data['user_id']
        movie_ids = data['movie_ids']
        
        if not isinstance(movie_ids, list) or len(movie_ids) == 0:
            return jsonify({"error": "'movie_ids' must be a non-empty list"}), 400
        
        # Get the Pinecone index
        index = pinecone_client.Index(index_name)
        
        # Get user embedding + the actual movie IDs used
        movie_embedding_pairs, user_embedding = getColdStartUserEmbedding(user_id, movie_ids, index)

        # Extract valid movie IDs that were found in Pinecone
        valid_movie_ids = [movie_id for movie_id, _ in movie_embedding_pairs]
        print("Valid movie IDs used:", valid_movie_ids)

        # Upsert the user embedding to Pinecone
        index.upsert(
            vectors=[(str(user_id), user_embedding.tolist())],
            namespace="users"
        )
        test = index.fetch(ids=[str(user_id)], namespace="users")
        print("Post-upsert check:", test.vectors)
        print(f"User embedding for {user_id} upserted into Pinecone.")

        return jsonify({
            "user_id": user_id,
            "embedding": user_embedding.tolist(),
            "valid_movie_ids": valid_movie_ids,
            "message": "User embedding generated and stored successfully"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True)
