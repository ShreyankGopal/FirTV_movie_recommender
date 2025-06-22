def build_embedding_prompt(ranked_genres, top_emotions, emoji):
    # Top 3 emotions
    emotions = [e["label"] for e in top_emotions[:3]]
    
    # Top 5 genres
    genres = [g["genre"] for g in ranked_genres[:5]]

    # Build sentence
    prompt = (
        f"The user's mood is '{emoji}' and they are feeling "
        f"{', '.join(emotions[:-1])}, and {emotions[-1]}. "
        f"Recommend movies that are {', '.join(genres[:-1])}, and {genres[-1]}. "
        
    )
    return prompt