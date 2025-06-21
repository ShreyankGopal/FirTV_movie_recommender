import express from "express";
import axios from "axios";
const addMovieEmbeddingRouter = express.Router();
const FLASK_BACKEND_URL = 'http://localhost:4000'; // Update this with your Flask backend URL

addMovieEmbeddingRouter.post('/addMovieEmbedding', async (req, res) => {
    try {
        const { movieId } = req.body;
        if (!movieId) {
            return res.status(400).json({ success: false, error: 'Missing movie ID' });
        }
        const response = await axios.post(
            `${FLASK_BACKEND_URL}/addMovieEmbedding`,
            { movieId }
        );
        return res.json({ success: true, data: response.data });
    } catch (error) {
        console.error('Error adding movie embedding:', error);
        return res.status(500).json({ success: false, error: 'Failed to add movie embedding' });
    }
});
export default addMovieEmbeddingRouter;
        