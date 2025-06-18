import express from 'express';
import cors from 'cors';
import preferenceSelection from './PreferenceSelection.js';
import axios from 'axios';
const app = express();

// ✅ CORS middleware
app.use(cors({
  origin: 'http://localhost:5173', // allow frontend origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials:true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', preferenceSelection);
app.post("/getRecommendation", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log("Received userId from frontend:", userId);

    // Send request to Flask backend
    const flaskResponse = await axios.post("http://localhost:4000/getRecommendation", {
      user_id: userId,
    });

    const recommendedMovieIds = flaskResponse.data.recommended_movie_ids;
    console.log("Recommended Movie IDs from Flask:", recommendedMovieIds);

    // Return to frontend
    return res.status(200).json({ recommendedMovieIds });
  } catch (error) {
    console.error("Error in Node.js /getRecommendation route:", error.message);
    return res.status(500).json({ error: "Failed to get recommendations" });
  }
});
app.get('/test-cors', (req, res) => {
  res.json({ message: 'CORS test successful' });
});
/// ----- this will get mood recommendation
app.post('/analyze-mood', async (req, res) => {
  const { text, emoji, user_id } = req.body;

  try {
    // Call Flask backend
    const flaskResponse = await axios.post(`http://localhost:4000/getMoodRecommendation`, {
      text,
      emoji,
      user_id
    });

    // Extract and forward the recommended movie IDs
    const recommendedMovieIds = flaskResponse.data.movie_ids.map(id =>
      parseInt(id.split('.')[0]) // Convert '27710.0' to 27710
    );
    console.log("printing the Mood Movies ", recommendedMovieIds)
    res.json({ movie_ids: recommendedMovieIds });
  } catch (err) {
    console.error('Error in Node.js backend:', err.message);
    res.status(500).json({ error: 'Failed to analyze mood' });
  }
});
app.listen(5001, () => {
  console.log('Server is running on http://localhost:5001');
});
