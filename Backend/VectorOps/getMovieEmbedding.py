from addUserEmbedding import get_movie_details
from getBertEmbedding import get_bert_embedding

def get_movie_embedding(movie_id, index,tokenizer,model):
    try:
        # Get movie details and compute embedding
        movie_text = get_movie_details(movie_id)
        if movie_text:
            embedding = get_bert_embedding(movie_text, tokenizer, model)
            if embedding is not None:
                return embedding
            else:
                print(f"Failed to generate embedding for movie {movie_id}")
                return None
        else:
            print(f"Failed to fetch details for movie {movie_id}")
            return None
    except Exception as e:
        print(f"Error fetching movie {movie_id}: {str(e)}")
        return None