// preferenceSelection.js

import express from 'express';
import axios from 'axios';

const preferenceSelection = express.Router();
const FLASK_APP_URL = 'http://localhost:4000';



// POST /addPreferenceToDB
preferenceSelection.post('/addPreferenceToDB', async (req, res) => {
  try {
    const { movieIds, userId } = req.body;
    console.log("Incoming movieIds:", movieIds);
    console.log("Incoming userId:", userId);

    if (!Array.isArray(movieIds) || movieIds.length === 0) {
      return res.status(400).json({ error: 'movieIds must be a non-empty array' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const response = await axios.post(
      `${FLASK_APP_URL}/AddUserEmbedding`,
      {
        user_id: userId,
        movie_ids: movieIds.map(id => parseInt(id, 10))
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(response.data)
    // Extract movie IDs and embedding from Python backend
    const { embedding, valid_movie_ids } = response.data;

    res.json({
      success: true,
      message: 'Preferences processed successfully',
      
      validMovieIds: valid_movie_ids // <== sending to frontend
    });

  } catch (error) {
    console.error('Error:', error?.response?.data || error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


export default preferenceSelection;