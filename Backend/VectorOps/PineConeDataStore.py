import pandas as pd
from pinecone import Pinecone, ServerlessSpec

# Initialize Pinecone client
client = Pinecone(api_key="pcsk_2Jm5Rp_4UAaRmLzEAAxZTMHGdrADfVZBFMym3FYYcXW478wG8SKLL5Q1hRTVh1P6JqbhaV")

# Load CSV
df = pd.read_csv("/Users/SGBHAT/Downloads/movie_embeddings.csv")
index_name = "movies-index"

# Create index with ServerlessSpec
if index_name not in client.list_indexes().names():
    client.create_index(
        name=index_name,
        dimension=df.shape[1] - 1,  # Assuming first column is movieId
        metric="cosine",
        spec=ServerlessSpec(
            cloud="aws",
            region="us-east-1"
        )
    )

# Connect to index
index = client.Index(index_name)

# Prepare data
vectors = [
    (str(row['movieId']), row[1:].tolist())  # (id, embedding)
    for _, row in df.iterrows()
]

# Upsert to Pinecone
batch_size = 100
for i in range(0, len(vectors), batch_size):
    index.upsert(vectors[i:i + batch_size])