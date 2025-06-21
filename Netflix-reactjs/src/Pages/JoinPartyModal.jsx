import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaTimes } from "react-icons/fa";

const JoinPartyModal = ({ onClose }) => {
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleCloseCard = () => {
    onClose();
    setRoomId('');
    setError('');
  };

  const handleJoinRoom = async () => {
    if (roomId) {
      try {
        const movieId = await axios.get(`http://localhost:5002/getMovieId/${roomId}`);
        console.log(movieId);
        setError('');
        onClose();
        navigate(`/play-together/${movieId.data.movieId}`, {
          state: { roomId: roomId },
        });
      } catch (error) {
        console.error("Error fetching movieId:", error);
        setError("Invalid Room ID. Please try again.");
      }
    } else {
      setError("Please enter a Room ID");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative bg-black p-6 rounded-lg shadow-lg w-96">
        <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-red-600 hover:text-red-400"
                >
                  <FaTimes size={20} />
                </button>
        <h2 className="text-xl font-bold text-white mb-4 text-center">
          Join Party
        </h2>
        <input
          type="text"
          value={roomId}
          onChange={(e) => {
            setRoomId(e.target.value);
            setError('');
          }}
          placeholder="Enter Room ID"
          className="w-full p-2 mb-2 border rounded text-white bg-gray-800"
        />
        {error && (
          <p className="text-red-500 text-sm mb-2 text-left ml-1">{error}</p>
        )}
        <button
          onClick={handleJoinRoom}
          className="w-full bg-red-600 text-white py-2 rounded hover:bg-red-700 mt-2"
        >
          Join
        </button>
      </div>
    </div>
  );
};

export default JoinPartyModal;
