import React, { useEffect, useState, useContext } from "react";
import OnSignUp from "../componets/RowPost/OnSignUp";
import {
  trending,
  comedy,
  horror,
  Adventure,
  SciFi,
  Animated,
  War,
} from "../Constants/URLs";
import { AuthContext } from "../Context/UserContext";
import { useNavigate } from "react-router-dom";
import api from "../api";
import axios from "axios";
import allowedMovieIdsList from "../allowedMovieIds_cleaned.json"; // Make sure this is an array of numbers

function SelectPreferences() {
  const { User } = useContext(AuthContext);
  const [selectedMovies, setSelectedMovies] = useState([]);
  const allowedMovieIds = new Set(allowedMovieIdsList); // ✅ Create set once
  const navigate = useNavigate();
  console.log(allowedMovieIds)
  const isMovieAllowed = (id) => allowedMovieIds.has(id); // ✅ use .has, not .includes

  const filteredFetcher = (url) => async () => {
    const totalPagesToFetch = 5; // You can increase if needed
    let allMovies = [];
    console.log(url)
    for (let page = totalPagesToFetch; page >=1 ; page--) {
      const response = await axios.get(`${url}&page=${page}`);
      allMovies = allMovies.concat(response.data.results);
    }
  
    console.log("Total fetched movies:", allMovies.length);
  
    const filteredMovies = allMovies.filter((movie) => allowedMovieIds.has(movie.id));
  
    console.log("Filtered movies count:", filteredMovies.length);
  
    return filteredMovies;
  };

  const handleMovieSelect = (movie) => {
    console.log("Here");
    console.log(movie);
    if (selectedMovies.find((m) => m.id === movie.id)) {
      setSelectedMovies(selectedMovies.filter((m) => m.id !== movie.id));
    } else {
      setSelectedMovies([...selectedMovies, movie]);
    }
    console.log(selectedMovies);
  };

  const handleGoHome = async () => {
    try {
      console.log("Selected Movies:", selectedMovies);
  
      const response = await api.post('/addPreferenceToDB', {
        movieIds: selectedMovies.map((m) => m.id),
        userId: User.uid
      });
  
      console.log("Valid movie IDs returned from backend:", response.data.validMovieIds);
      console.log("User embedding:", response.data.embedding);
  
      navigate("/");
    } catch (error) {
      console.error("Error submitting preferences:", error);
    }
  };

  return (
    <div className="mt-8">
      <h1 className="text-white text-2xl text-center mb-6 font-semibold">
        Choose what describes your taste
      </h1>
      <div className="w-[99%] ml-1">
        <OnSignUp title="Trending" url={trending} fetcher={filteredFetcher(trending)} onMovieClick={handleMovieSelect} selectedMovies={selectedMovies} />
        <OnSignUp title="Animated" url={Animated} fetcher={filteredFetcher(Animated)} onMovieClick={handleMovieSelect} selectedMovies={selectedMovies} />
        <OnSignUp title="Comedy" url={comedy} fetcher={filteredFetcher(comedy)} onMovieClick={handleMovieSelect} selectedMovies={selectedMovies} />
        <OnSignUp title="Adventure" url={Adventure} fetcher={filteredFetcher(Adventure)} onMovieClick={handleMovieSelect} selectedMovies={selectedMovies} />
        <OnSignUp title="Horror" url={horror} fetcher={filteredFetcher(horror)} onMovieClick={handleMovieSelect} selectedMovies={selectedMovies} />
        <OnSignUp title="Sci-Fi" url={SciFi} fetcher={filteredFetcher(SciFi)} onMovieClick={handleMovieSelect} selectedMovies={selectedMovies} />
        <OnSignUp title="War" url={War} fetcher={filteredFetcher(War)} onMovieClick={handleMovieSelect} selectedMovies={selectedMovies} />
      </div>

      <div className="flex justify-center mt-6 space-x-4">
        <button
          onClick={handleGoHome}
          disabled={selectedMovies.length < 3}
          className={`px-6 py-2 rounded text-white font-bold ${
            selectedMovies.length < 3 ? "bg-gray-500 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          Go Home
        </button>

        <button
          onClick={() => navigate("/")}
          className="px-6 py-2 rounded text-white font-bold bg-gray-700 hover:bg-gray-800"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

export default SelectPreferences;
