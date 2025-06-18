import numpy as np

def getColdStartUserEmbedding(user_id, movie_ids, pinecone_index):
    """
    Compute the average embedding for a cold-start user from Pinecone,
    and return both individual (movie_id, embedding) pairs and the mean embedding.
    """
    embeddings = []
    movie_embedding_pairs = []

    # Fetch embeddings from Pinecone using float-style string IDs
    fetch_response = pinecone_index.fetch(ids=[str(float(mid)) for mid in movie_ids])
    
    for movie_id in movie_ids:
        float_id = str(float(movie_id))
        vector = fetch_response.vectors.get(float_id)
        if vector:
            emb = np.array(vector.values)
            embeddings.append(emb)
            movie_embedding_pairs.append((movie_id, emb))

    if not embeddings:
        raise ValueError("No valid movie embeddings found for the provided movie IDs.")

    mean_embedding = np.mean(embeddings, axis=0)
    
    return movie_embedding_pairs, mean_embedding
