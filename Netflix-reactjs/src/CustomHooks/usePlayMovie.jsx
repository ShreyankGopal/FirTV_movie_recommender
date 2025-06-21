import React from "react";
import { useNavigate } from "react-router-dom";
import useUpdateWatchedMovies from "./useUpdateWatchedMovies";
import api from "../api.js";
function usePlayMovie() {
  const { addToWatchedMovies } = useUpdateWatchedMovies();
  const navigate = useNavigate();

  const playMovie = async (movie, from) => {
    // const response = await api.post('/addMovieEmbedding', {
    //   movieId: movie.id,
    // })
    // console.log(response.data)
    addToWatchedMovies(movie);
    console.log(movie)
    navigate(`/play/${movie.id}`, { replace: true, state: { From: from } });
  };

  return { playMovie };
}

export default usePlayMovie;
