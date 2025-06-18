import React from "react";
import { useNavigate } from "react-router-dom";
import useUpdateWatchedMovies from "./useUpdateWatchedMovies";

function usePlayMovie() {
  const { addToWatchedMovies } = useUpdateWatchedMovies();
  const navigate = useNavigate();

  const playMovie = (movie, from) => {
    addToWatchedMovies(movie);
    console.log(movie)
    navigate(`/play/${movie.id}`, { replace: true, state: { From: from } });
  };

  return { playMovie };
}

export default usePlayMovie;
