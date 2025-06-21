import requests
import numpy as np
import pinecone
import time
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from getBertEmbedding import get_bert_embedding

# TMDB API Configuration
TMDB_API_KEY = '3e1054df1980cf1fadeea7d6dbdcd0cd'
TMDB_BASE_URL = 'https://api.themoviedb.org/3'

# Configure session with retries
session = requests.Session()
retries = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET"]
)
session.mount('https://', HTTPAdapter(max_retries=retries))

# Request timeout in seconds
REQUEST_TIMEOUT = 10

def get_movie_details(movie_id, attempt=1, max_attempts=3):
    """
    Fetch movie details from TMDB API with retry mechanism
    
    Args:
        movie_id: TMDB movie ID
        attempt: Current attempt number
        max_attempts: Maximum number of retry attempts
        
    Returns:
        str: Combined text of movie details or None if failed
    """
    if not movie_id or not str(movie_id).strip():
        print(f"Invalid movie ID: {movie_id}")
        return None
        
    try:
        # Add delay between retries
        if attempt > 1:
            time.sleep(1 * (attempt - 1))  # Exponential backoff
            
        print(f"Fetching details for movie {movie_id} (attempt {attempt}/{max_attempts})")
        
        # Get movie details with timeout
        response = session.get(
            f"{TMDB_BASE_URL}/movie/{movie_id}",
            params={"api_key": TMDB_API_KEY, "language": "en-US"},
            timeout=REQUEST_TIMEOUT
        )
        response.raise_for_status()
        movie_data = response.json()
        
        # Validate required fields
        if not movie_data or 'status_code' in movie_data:
            error_msg = movie_data.get('status_message', 'Unknown error')
            print(f"TMDB API error for movie {movie_id}: {error_msg}")
            return None
        
        # Extract relevant information
        title = movie_data.get('title', '')
        overview = movie_data.get('overview', '')
        genres = ' '.join([genre['name'] for genre in movie_data.get('genres', [])])
        
        if not (title or overview or genres):
            print(f"Incomplete data for movie {movie_id}")
            return None
        
        # Combine all text data
        combined_text = f"{title} {overview} {genres}".strip()
        return combined_text
        
    except requests.exceptions.RequestException as e:
        if attempt < max_attempts:
            print(f"Attempt {attempt} failed for movie {movie_id}: {str(e)}. Retrying...")
            return get_movie_details(movie_id, attempt + 1, max_attempts)
        print(f"Failed to fetch movie {movie_id} after {max_attempts} attempts: {str(e)}")
        return None
    except Exception as e:
        print(f"Unexpected error fetching movie {movie_id}: {str(e)}")
        return None

def calculate_weighted_average(embeddings, ratings):
    """Calculate weighted average of embeddings based on ratings"""
    if not embeddings:
        return None
    
    # Convert to numpy arrays for vector operations
    embeddings = np.array(embeddings)
    ratings = np.array(ratings)
    
    # Normalize ratings to sum to 1
    weights = ratings / np.sum(ratings)
    
    # Calculate weighted average
    weighted_avg = np.average(embeddings, axis=0, weights=weights)
    return weighted_avg

def update_user_embedding(user_id, ratings_data, tokenizer, model, pinecone_index):
    """
    Update user embedding based on new ratings
    
    Args:
        user_id: User ID
        ratings_data: List of dicts containing 'movieId' and 'rating'
        tokenizer: BERT tokenizer
        model: BERT model
        pinecone_index: Pinecone index object
        
    Returns:
        dict: Result with success/error status and details
    """
    try:
        print(f"Updating user embedding for user_id: {user_id}")
        print(f"Processing {len(ratings_data)} ratings")
        
        # Validate input
        if not ratings_data or not isinstance(ratings_data, list):
            return {"error": "Invalid ratings data format. Expected a list of ratings.", "status_code": 400}
            
        # Get movie details and compute embeddings
        movie_embeddings = []
        ratings = []
        failed_movies = []
        
        for item in ratings_data:
            try:
                movie_id = str(item.get('movieId', '')).strip()
                rating = float(item.get('rating', 0))
                
                # Skip invalid ratings or movie IDs
                if not movie_id or rating <= 0:
                    print(f"Skipping invalid rating: movie_id={movie_id}, rating={rating}")
                    continue
                    
                print(f"Processing movie {movie_id} with rating {rating}")
                
                # Get movie details and create embedding
                movie_text = get_movie_details(movie_id)
                if movie_text:
                    embedding = get_bert_embedding(movie_text, tokenizer, model)
                    if embedding is not None:
                        movie_embeddings.append(embedding)
                        ratings.append(rating)
                        print(f"Successfully processed movie {movie_id}")
                    else:
                        print(f"Failed to generate embedding for movie {movie_id}")
                        failed_movies.append(movie_id)
                else:
                    print(f"Failed to fetch details for movie {movie_id}")
                    failed_movies.append(movie_id)
                    
            except Exception as e:
                print(f"Error processing movie {item.get('movieId')}: {str(e)}")
                failed_movies.append(str(item.get('movieId', 'unknown')))
                continue
        
        if not movie_embeddings:
            return {"error": "No valid movie embeddings could be generated"}, 400
        
        # Calculate weighted average of new embeddings
        new_embedding = calculate_weighted_average(movie_embeddings, ratings)
        
        # Get existing user embedding from Pinecone
        try:
            existing_embedding = pinecone_index.fetch(
                ids=[str(user_id)],
                namespace="users"
            )
            
            old_embedding = None
            if str(user_id) in existing_embedding.vectors:
                old_embedding = np.array(existing_embedding.vectors[str(user_id)].values)
            
            # Merge embeddings with 70:30 ratio (new:old)
            if old_embedding is not None:
                updated_embedding = (0.7 * new_embedding) + (0.3 * old_embedding)
            else:
                updated_embedding = new_embedding
                
        except Exception as e:
            print(f"Error fetching existing embedding: {str(e)}")
            updated_embedding = new_embedding
        
        # Update Pinecone
        pinecone_index.upsert(
            vectors=[(str(user_id), updated_embedding.tolist())],
            namespace="users"
        )
        
        return {
            "success": True,
            "user_id": user_id,
            "updated_embedding": updated_embedding.tolist()
        }
        
    except Exception as e:
        print(f"Error in update_user_embedding: {str(e)}")
        return {"error": f"Failed to update user embedding: {str(e)}"}, 500
