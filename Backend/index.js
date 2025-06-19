import express from 'express';
import cors from 'cors';
import preferenceSelection from './PreferenceSelection.js';
import axios from 'axios';
import { Server } from 'socket.io';
import http from 'http';
import { startMediasoup } from './media_soup.js';

const app = express();
const server = http.createServer(app); // ✅ required for socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// ----------- MIDDLEWARE ----------------
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ----------- ROUTES ----------------
app.use('/', preferenceSelection);

app.post("/getRecommendation", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log("Received userId from frontend:", userId);

    const flaskResponse = await axios.post("http://localhost:4000/getRecommendation", {
      user_id: userId,
    });

    const recommendedMovieIds = flaskResponse.data.recommended_movie_ids;
    console.log("Recommended Movie IDs from Flask:", recommendedMovieIds);

    return res.status(200).json({ recommendedMovieIds });
  } catch (error) {
    console.error("Error in Node.js /getRecommendation route:", error.message);
    return res.status(500).json({ error: "Failed to get recommendations" });
  }
});

app.post('/analyze-mood', async (req, res) => {
  const { text, emoji, user_id } = req.body;

  try {
    const flaskResponse = await axios.post(`http://localhost:4000/getMoodRecommendation`, {
      text,
      emoji,
      user_id
    });

    const recommendedMovieIds = flaskResponse.data.movie_ids.map(id =>
      parseInt(id.split('.')[0])
    );
    console.log("Mood-based Recommended Movie IDs:", recommendedMovieIds);

    res.json({ movie_ids: recommendedMovieIds });
  } catch (err) {
    console.error('Error in Node.js backend:', err.message);
    res.status(500).json({ error: 'Failed to analyze mood' });
  }
});

app.get('/test-cors', (req, res) => {
  res.json({ message: 'CORS test successful' });
});

// ----------- SOCKET.IO ----------------
io.on('connection', (socket) => {
  console.log('Client connected via socket. ID:', socket.id);
});
startMediasoup(io);
// ----------- START SERVER ----------------
server.listen(5001, () => {
  console.log('Server + Socket.IO running on http://localhost:5001');
});
