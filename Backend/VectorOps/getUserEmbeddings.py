import numpy as np

def getRecommendation(user_id, pinecone_index, top_k=10):
    # Step 1: Fetch the user embedding from the 'users' namespace
    fetch_response = pinecone_index.fetch(
        ids=[str(user_id)],
        namespace="users"
    )

    if str(user_id) not in fetch_response.vectors:
        raise ValueError("User ID not found in user embeddings.")

    user_vec = fetch_response.vectors[str(user_id)].values

    # Step 2: Query the movies in the default namespace
    response = pinecone_index.query(
        vector=user_vec,
        top_k=top_k,
        namespace="",  # default namespace
        include_metadata=False
    )

    # Step 3: Convert string float IDs to integer movie IDs
    recommended_movie_ids = [int(float(match['id'])) for match in response['matches']]
    return recommended_movie_ids
