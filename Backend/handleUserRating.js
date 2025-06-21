import express from 'express';
import axios from 'axios';
import { userRating } from './ratingStore.js';

const ratingUpdateRouter = express.Router();
const FLASK_BACKEND_URL = 'http://localhost:4000'; // Update this with your Flask backend URL

ratingUpdateRouter.post('/addUserMovieRating', async (req, res) => {
    try {
        const { userId, movieId, rating } = req.body;
        
        if (!userId || !movieId || rating === undefined) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        // Initialize user's rating array if it doesn't exist
        if (!userRating.has(userId)) {
            userRating.set(userId, []);
        }
        
        // Add new rating to user's array
        const userRatings = userRating.get(userId);
        userRatings.push({ movieId, rating });
        
        console.log(`Added rating for user ${userId}:`, { movieId, rating });
        
        // If we've collected 5 ratings, send to Flask backend
        if (userRatings.length >= 3) {
            try {
                console.log(`Sending ratings to Flask backend for user ${userId}`);
                const response = await axios.post(
                    `${FLASK_BACKEND_URL}/updateUserEmbedding`,
                    { 
                        userId,
                        ratings: userRatings 
                    }
                );
                
                // Clear user's ratings after successful update
                userRating.delete(userId);
                console.log(`Successfully updated embeddings for user ${userId}`);
                
                return res.json({ 
                    success: true, 
                    message: 'Ratings processed and embeddings updated',
                    updated: true
                });
                
            } catch (error) {
                console.error('Error updating user embeddings:', error.message);
                return res.status(500).json({ 
                    success: false, 
                    error: 'Failed to update user embeddings',
                    details: error.message
                });
            }
        }
        
        // Return success if we haven't reached 5 ratings yet
        res.json({ 
            success: true, 
            message: 'Rating added successfully',
            ratingsCount: userRatings.length,
            updated: false
        });
        
    } catch (error) {
        console.error('Error in addUserMovieRating:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error',
            details: error.message
        });
    }
});

export default ratingUpdateRouter;
