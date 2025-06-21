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
from getMovieEmbedding import get_movie_embedding as get_embedding
from weatherDetector import weather_time_to_genres, get_weather_and_slot
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Fetch the API key
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

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

@app.route('/updateUserEmbedding', methods=['POST'])
def update_user_embedding():
    try:
        data = request.get_json()
        print("Received update user embedding request:", data)
        
        if not data or 'userId' not in data or 'ratings' not in data:
            return jsonify({"error": "Missing required fields: 'userId' and 'ratings' are required"}), 400
        
        user_id = data['userId']
        ratings = data['ratings']
        
        if not isinstance(ratings, list) or len(ratings) == 0:
            return jsonify({"error": "'ratings' must be a non-empty list"}), 400
            
        # Get the Pinecone index
        index = pinecone_client.Index(index_name)
        
        # Update user embedding based on ratings
        from addUserEmbedding import update_user_embedding as update_embedding
        result = update_embedding(user_id, ratings, tokenizer, bert_model, index)
        
        if 'error' in result:
            return jsonify(result), result.get('status_code', 500)
            
        return jsonify({
            "success": True,
            "message": "User embedding updated successfully",
            "user_id": user_id
        }), 200
        
    except Exception as e:
        print(f"Error in update_user_embedding: {str(e)}")
        return jsonify({"error": f"Failed to update user embedding: {str(e)}"}), 500
    
@app.route('/addMovieEmbedding', methods=['POST'])
def add_movie_embedding():
    try:
        data = request.get_json()
        print("Incoming data:", data)
        
        if not data or 'movieId' not in data:
            return jsonify({"error": "Missing required fields: 'movieId' is required"}), 400
        
        movie_id = data['movieId']
        index = pinecone_client.Index(index_name)

        # Check if movie already exists
        existing = index.fetch(ids=[str(movie_id)], namespace="")
        if str(movie_id) in existing.vectors:
            print(f"Movie ID {movie_id} already exists in Pinecone.")
            return jsonify({
                "movie_id": movie_id,
                "message": "Movie embedding already exists in Pinecone"
            }), 200

        # Get movie embedding
        
        movie_embedding = get_embedding(movie_id, index,tokenizer,bert_model)
        
        if not movie_embedding:
            return jsonify({"error": "Movie embedding not found"}), 404
        
        # Upsert to Pinecone
        index.upsert(
            vectors=[(str(movie_id), movie_embedding.tolist())],
            namespace=""
        )

        print(f"Movie embedding for {movie_id} upserted into Pinecone.")
        
        return jsonify({
            "movie_id": movie_id,
            "embedding": movie_embedding.tolist(),
            "message": "Movie embedding generated and stored successfully"
        }), 200
        
    except Exception as e:
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

@app.route('/getWeatherRecommendation', methods=['POST'])
def getWeatherRecommendation():
    data = request.json
    lat = data.get("lat")
    lon = data.get("lon")
    print("lat:",lat)
    print("lon:", lon)
    if lat is None or lon is None:
        return jsonify({"error": "Latitude and longitude are required"}), 400

    # Step 1: Get condition and slot
    condition, slot = get_weather_and_slot(lat, lon, OPENWEATHER_API_KEY)

    # Step 2: Lookup genres for (condition, slot)
    genre_tuples = weather_time_to_genres.get((condition, slot), [])
    ranked_genres = [{"genre": genre, "score": round(score, 3)} for genre, score in genre_tuples]

    # Step 3: Create descriptive prompt for each genre and time
    descriptions = [
        f"{genre} vibe for {slot}" for genre, _ in genre_tuples[:3]
    ]
    context_text = f"User is experiencing {condition.lower()} weather during {slot}. Suggested genres are: {', '.join([g['genre'] for g in ranked_genres[:3]])}."

    # Step 4: Get embedding
    weather_embedding = get_bert_embedding(context_text, tokenizer, bert_model)

    # Step 5: Query Pinecone
    response = pinecone_index.query(
        vector=weather_embedding.tolist(),
        top_k=10,
        namespace="",
        include_metadata=False
    )
    movie_ids = [match['id'].split('.')[0] for match in response['matches']]

    # Step 6: Return
    return jsonify({
        "weather_condition": condition,
        "time_slot": slot,
        "ranked_genres": ranked_genres,
        "movie_ids": movie_ids
    })
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=4000, debug=True)
