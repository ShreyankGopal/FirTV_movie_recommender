# Introduction

This project is an AI-powered movie recommendation platform that personalizes suggestions based on user preferences, mood, watch history, and real-time context like weather and time of day. It also features a real-time Watch Party experience with synchronized playback and live video/audio chat, offering both intelligent discovery and social viewing in one seamless app.


# Table of Contents

- [Important Pages](#important-pages)
  - [Sign-Up Page](#sign-up-page)
  - [Select Preferences Page](#select-preferences-page)
  - [Watch History Page](#watch-history-page)
  - [Liked Movies Page](#liked-movies-page)
  - [My List Page](#my-list-page)

- [Embedding Creation & Recommendation Flow](#embedding-creation--recommendation-flow-using-history-and-weather)
  - [Movie Embedding Generation](#movie-embedding-generation)
  - [Cold Start User Embedding](#cold-start-user-embedding)
  - [Watch History-Based Recommendations](#watch-history-based-recommendations)
  - [Weather-Based Recommendations](#weather-based-recommendations)

- [Mood-Based Movie Recommendation Engine](#mood-based-movie-recommendation-engine)
  - [Overview](#overview)
  - [Key Features](#key-features)
  - [Architecture & Flow](#architecture--flow)
  - [Core Logic Details](#core-logic-details)
    - [Emotion-to-Genre Mapping](#emotion-to-genre-mapping)
    - [Emoji-to-Genre Mapping](#emoji-to-genre-mapping)
    - [Genre Ranking Logic](#genre-ranking-logic)
    - [Movie Filtering & Embedding Matching](#movie-filtering--embedding-matching)
  - [UI Components](#ui-components)

- [Watch Party Feature: A Real-Time Collaborative Viewing Experience](#watch-party-feature-a-real-time-collaborative-viewing-experience)
  - [Architecture Overview](#architecture-overview)
  - [Front-End Details](#front-end-details)
    - [Component Architecture](#component-architecture)
    - [Core Functionalities](#core-functionalities)
    - [State Management Excellence](#state-management-excellence)
    - [WebRTC Integration with Mediasoup](#webrtc-integration-with-mediasoup)
    - [Real-Time Communication via SocketIO](#real-time-communication-via-socketio)
    - [YouTube Playback Synchronization](#youtube-playback-synchronization)
    - [User Interface and Experience](#user-interface-and-experience)
  - [Back-End Details](#back-end-details)
    - [Server Infrastructure](#server-infrastructure)
    - [SocketIO Event Handling](#socketio-event-handling)
    - [Mediasoup: Scalable WebRTC Backbone](#mediasoup-scalable-webrtc-backbone)
    - [Room and Session Management](#room-and-session-management)
  - [Operational Workflow](#operational-workflow)
  - [Challenges Overcome](#challenges-overcome)
  - [UI Components](#ui-components-1)


# Important Pages

## **Sign-Up Page**
Allows new users to create an account securely.
- Input: username and password
- Backend validation and hashing of credentials
- Redirects to preference selection after successful sign-up
  
![signup](https://github.com/user-attachments/assets/70639e55-0554-4e14-ae22-b4f7838bd244)

## **Select Preferences Page**
Collects user preferences to customize the experience.
- Allows to select from various genres (e.g., Action, Comedy, Thriller) to create a base embedding for the cold start user.
- Forms the basis of personalized recommendation logic
  
![selectPreferences](https://github.com/user-attachments/assets/47cbb3fc-1e1e-4071-9e57-258405880506)

## **Watch History Page**
Tracks all the movies a user has watched over time.
- View a timeline of watched movies
- Useful for revisiting or rewatching old favorites
- Data is stored persistently and updated in real-time
  
![history](https://github.com/user-attachments/assets/7849d1c2-b7e5-46f1-961f-893a5de4c12c)

## **Liked Movies Page**
Displays all the movies the user has liked.
- Love any movie? Add it here in just a click!
- Easily browse your favorite titles
- Serves as input for future personalized recommendations
  
![liked](https://github.com/user-attachments/assets/a831f62a-f374-4f4e-be14-85098528e269)


## **My List Page**
Shows the list of movies that the user has manually added to watch later.
- One-click add/remove from anywhere in the app
- Great for planning weekend binges
  
![mylist](https://github.com/user-attachments/assets/89b5c20a-ba31-491a-b01d-80ca6202254d)

---
# Embedding Creation & Recommendation Flow Using History and Weather

This application uses deep learning-based embeddings and semantic similarity to recommend movies to users, including for cold-start scenarios. Below is a breakdown of how embeddings are generated and used:

## Movie Embedding Generation

- Uses *BERT Base Uncased Transformer* to generate contextual embeddings for each movie.
- Input text for the embedding includes:
  - title of the movie  
  - overview  
  - genres  
  - relevant moods (e.g., suspenseful, romantic)
- The resulting vector is a dense semantic representation of the movie, capturing both content and emotional tone.
- These embeddings are stored in a *Pinecone vector database* for fast and scalable similarity search.

---

## Cold Start User Embedding

For new users:
- The user selects *5 favorite movies* during onboarding.
- The embeddings of these 5 movies are *summed and averaged* to form a *cold-start user embedding*.
- A *similarity search* is performed in Pinecone to find the most similar movies based on this embedding.

---

## Watch History-Based Recommendations

For returning users with viewing history:
- The user’s rated movies are used to generate a *weighted average embedding*, where weights are based on the ratings.
- If the user has rated *3 or more new movies*, the user embedding is updated using:
        updated_embedding = 0.3 * old_embedding + 0.7 * new_weighted_average_embedding
- This allows the system to learn user preferences over time and refine recommendations accordingly.


## **Weather-Based Recommendations**
Suggests movies based on current **weather** and **time of day** at the place the user is in.
- Automatically detects weather (sunny, rainy, snowy, etc.)
- Recommends cozy or themed content accordingly
- Time-aware suggestions (day/night movie moods)
  
![weatherDetection](https://github.com/user-attachments/assets/5e43a132-b88f-4ec6-b75c-da8ca0172547)
![weatherRecommendationDisplay](https://github.com/user-attachments/assets/fc154226-45d4-43a4-b078-00514f84f040)
![weatherPicks](https://github.com/user-attachments/assets/bd8224a2-e584-4257-b06e-c1ed0511b442)


---
  
# Mood-Based Movie Recommendation Engine

A deep learning–driven, **emotion-aware movie recommender system** that leverages **NLP, sentiment analysis**, and **semantic similarity** to generate personalized movie suggestions based on a user's current mood—expressed via text and emoji input.

## Overview

This system infers user mood using **transformer-based emotion classification**, intelligently maps those moods to thematic movie genres, and retrieves the most semantically aligned movies using **BERT embeddings** and **cosine similarity** search.

### Key Features

- **Emotion Detection**: Uses `joeddav/distilbert-base-uncased-go-emotions-student` to analyze emotional sentiment from text.
- **Emoji-to-Genre Mapping**: Augments mood classification via emoji-based intent mapping.
- **Hybrid Genre Scoring**: Combines emotion-based weights and emoji boosts to rank genres.
- **Semantic Embedding Matching**: Matches user emotion with pre-computed movie embeddings using BERT and cosine similarity.
- **Content Filtering**: Filters movies with mood overlap (≥2 matching moods).
- **REST API**: Exposes `/getMoodRecommendation` POST endpoint for seamless frontend integration.


## Architecture & Flow
![Editor _ Mermaid Chart-2025-06-22-163437](https://github.com/user-attachments/assets/2e113b0f-c665-4f68-9412-0bea16029a46)

## Core Logic Details

### Emotion-to-Genre Mapping

The model maps **emotions → weighted genres** to reflect the nuanced emotional signatures of movie themes.

Example:

```python
"excitement": [("Adventurous", 0.4), ("Happy", 0.3), ("Suspense", 0.3)]
```

### Emoji-to-Genre Mapping

Simplified mapping from emoji category to broad thematic genres:

```python
"cool": ["Adventurous", "Light-hearted"]
```

### Genre Ranking Logic

* Top 3 detected emotions are each mapped to weighted genre lists.
* Emoji genres receive a 0.1 boost per genre.
* Genres are aggregated and sorted by cumulative score.

### Movie Filtering & Embedding Matching

* `filtered_movies.csv`: Contains movie metadata and associated moods.
* `movie_embeddings.csv`: Contains 768-dim BERT vector per movie.
* Movies are filtered for **≥2 overlapping moods**.
* Top 15 most semantically similar movies are returned via **cosine similarity**.

## UI Components

![image](https://github.com/user-attachments/assets/32694805-6a43-4675-95f1-b372afaefe03)
![image](https://github.com/user-attachments/assets/0e902aa3-0860-46d3-8605-0513b3ba304b)
![image](https://github.com/user-attachments/assets/6e0a3c91-e1e9-450f-9a7a-f7ce75eaf461)


---

# Watch Party Feature: A Real-Time Collaborative Viewing Experience

The Watch Party feature is a cutting-edge, immersive platform that redefines how users experience shared media consumption. By seamlessly integrating synchronized YouTube trailer playback with real-time WebRTC-based video and audio communication, Watch Party delivers a dynamic, interactive, and socially engaging environment. 
## Architecture Overview
Watch Party operates on a client-server model. The front-end orchestrates user interactions, media playback, and WebRTC streams, while the back-end manages room state, media routing, and real-time event propagation. Mediasoup serves as the WebRTC engine, enabling efficient, scalable media streaming.

## Front-End Details

### Component Architecture
The `PlaySharedMovie` component is the heart of the front-end, a meticulously crafted React functional component that orchestrates the Watch Party experience. It integrates:
- **Room Management**: Creation and joining of virtual rooms.
- **Media Playback**: Synchronized YouTube trailer playback.
- **WebRTC Streaming**: Real-time video/audio communication.
- **UI Rendering**: A responsive, visually appealing interface.

A key sub-component, `VideoFrame`, renders individual participant streams with dynamic overlays for username, camera/mic status, and host indicators, enhancing the social context of the experience.

### Core Functionalities
1. **Room Creation and Joining**:
   - Users can generate a unique 8-character room ID to start a Watch Party or join an existing one using a shared ID.
   - The room creator is anointed as the host, wielding control over video playback.
   - A clipboard-copy feature simplifies sharing room IDs, with a visual confirmation for user delight.

2. **Synchronized Video Playback**:
   - Dynamically fetches YouTube trailers from TMDb based on the `movieId` route parameter.
   - Ensures frame-accurate synchronization across all participants via host-driven Socket.IO events.
   - Supports playback control (play/pause) with timestamp propagation for seamless alignment.

3. **Immersive Video/Audio Chat**:
   - Harnesses WebRTC for low-latency, peer-to-peer media streaming.
   - Allows users to toggle camera and microphone, with real-time status updates broadcasted to peers.
   - Displays participant streams with rich metadata, including host status and media availability.

4. **Dynamic Host Succession**:
   - Automatically transfers host privileges to the next participant upon the host’s disconnection, ensuring uninterrupted control.
   - Visually highlights the host in the UI for clarity.

### State Management Excellence
The front-end employs React hooks for robust, predictable state management:
- **useState**: Manages room ID, username, participant list, local stream, YouTube link, host status, video state, camera/mic toggles, and error messages.
- **useRef**: Preserves critical references (Socket.IO client, Mediasoup device, transports, video elements, YouTube player) across renders for performance and reliability.
- **useEffect**: Orchestrates side effects, including Socket.IO initialization, media device access, event listener setup, and resource cleanup on component unmount.

### WebRTC Integration with Mediasoup
- **Mediasoup Client**: Powers WebRTC streaming with producer and consumer transports for sending and receiving media.
- **Device Initialization**: Loads Mediasoup with server-provided RTP capabilities for compatibility.
- **Producer Transport**: Streams local video/audio to the server for distribution.
- **Consumer Transport**: Receives and renders remote participant streams.
- **Error Resilience**: Implements comprehensive error handling for media access denials, transport failures, and network issues, with user-friendly notifications.

### Real-Time Communication via Socket.IO
Socket.IO drives the real-time interactivity, handling events such as:
- Room joining (`join-room`) and participant updates (`new-participant`, `participant-left`).
- Media transport setup (`create-producer-transport`, `create-consumer-transport`, `produce`, `consume`).
- Playback synchronization (`play-video`, `pause-video`).
- Camera/mic status updates (`toggle-camera`, `toggle-mic`).
- Host transitions (`host-changed`).
This ensures a cohesive, responsive experience for all users.

### YouTube Playback Synchronization
- Embeds trailers using the `react-youtube` library for robust playback.
- Extracts video IDs from YouTube URLs using regex for reliable embedding.
- Synchronizes playback by emitting host-initiated timestamps, ensuring all clients align with the host’s video state.

### User Interface and Experience
- **Responsive Design**: Crafted with Tailwind CSS, the UI adapts seamlessly to various screen sizes with a dark, cinematic aesthetic that enhances immersion.
- **Layout**:
  - Main video player spans 2/3 of the width on large screens, prioritizing content.
  - Participant video feeds occupy a sidebar (1/3 width), fostering social presence.
- **Interactive Elements**:
  - Camera/mic buttons feature dynamic styling (e.g., red for off, green for on/off) for intuitive feedback.
  - Room ID display includes a copy button with animated confirmation.
  - Playback status and participant count are visually cue engagement.
- **Error Handling**: Elegant error notifications guide users through issues like media access failures or server connectivity problems, maintaining trust.
- **Visual Polish**: Lucide-React icons and subtle animations (e.g., hover scaling, live stream indicators) elevate the experience.

## Back-End Details

### Server Infrastructure
The back-end, hosted on Node.js with Express, runs on port `5002` and is engineered for performance and reliability:
- **Express**: Handles HTTP requests with a modular API layer.
- **Socket.IO**: Facilitates real-time, bidirectional communication.
- **Mediasoup**: Provides scalable WebRTC media routing.
- **CORS**: Configured to securely allow cross-origin requests from `http://localhost:5173`.

### Socket.IO Event Handling
The server processes a sophisticated event pipeline:
- **Room Joining (`join-room`)**: Adds participants, assigns the first joiner as host, and returns room configuration.
- **Transport Creation (`create-producer-transport`, `create-consumer-transport`)**: Initializes WebRTC transports for streaming.
- **Transport Connection (`connect-transport`)**: Establishes secure DTLS connections.
- **Media Production (`produce`)**: Creates producers for participant media tracks.
- **Media Consumption (`consume`, `resume-consumer`)**: Manages stream consumption and resumption.
- **Playback Control (`play-video`, `pause-video`)**: Broadcasts host actions to synchronize video.
- **Status Updates (`toggle-camera`, `toggle-mic`)**: Propagates camera/mic toggles.
- **Disconnection Handling**: Cleans up resources and manages host succession.

### Mediasoup: Scalable WebRTC Backbone
- **Worker**: A singleton instance manages media processing with RTC ports `10000–10100`.
- **Router**: Each room has a dedicated router, configured with VP8 video and Opus audio codecs for broad compatibility.
- **Transports**: WebRTC transports handle producer and consumer media streams.
- **Producers/Consumers**: Dynamically track and manage media streams, with lifecycle events (e.g., `dtlsstatechange`, `producerclose`).

### Room and Session Management
- **Rooms Map**: Stores room state, including router, participants (as an array for join-time ordering), producers, YouTube link, host ID, and video state (state, time, timestamp).
- **Room-to-Movie Map**: Associates room IDs to TMDb movie IDs for content lookup.
- **Host Succession**: Reassigns host privileges to the earliest remaining participant when the host disconnects, ensuring continuity.
- **Resource Cleanup**: Closes routers and removes empty rooms to optimize resource usage.

## Operational Workflow
1. **Creating a Watch Party**:
   - Navigate to the Watch Party page with a movie ID.
   - Enter a username, click “Create Party” to generate a room ID.
   - Share the ID with friends via the copy-to-clipboard feature.
   - The TMDb-fetched trailer loads, ready for playback control.

2. **Joining a Watch Party**:
   - Enter a username and room ID, then click “Join Party.”
   - The trailer syncs to the host’s playback state, and participant streams appear.
   - Toggle camera/mic as desired.

3. **Interactive Experience**:
   - The host controls playback, with actions instantly synced to all participants.
   - Participants engage via video/audio, with status updates visible to all.
   - If the host leaves, the next participant seamlessly becomes the host.

## Challenges Overcome
- **WebRTC Complexity**: Mastered Mediasoup’s transport and device lifecycle to ensure reliable streaming, with robust error handling for edge cases.
- **Playback Synchronization**: Achieved sub-second accuracy in video alignment using timestamp-based synchronization, overcoming network jitter.
- **Host Succession**: Designed a fault-tolerant mechanism to maintain room functionality despite host disconnections.
- **Media Access**: Mitigated browser and device conflicts with clear error messages and fallback constraints.
- **Scalability**: Optimized Mediasoup configuration for efficient resource use, laying the groundwork for larger rooms.

## UI Components
![image](https://github.com/user-attachments/assets/8378d2c6-2a40-4d09-98ce-78ba09a5131d)
![image](https://github.com/user-attachments/assets/faaec5cf-527a-41c8-85be-724dd4d8eeda)
![Screenshot from 2025-06-22 23-05-37](https://github.com/user-attachments/assets/1fc8afdb-15fa-41be-a7bb-b05262e4a25e)
![image](https://github.com/user-attachments/assets/4de560de-8635-4c69-8c3a-b9ebac5388dd)

