import React, { useEffect, useState, useContext } from "react";

import Footer from "../componets/Footer/Footer";
import RowPost from "../componets/RowPost/RowPost";

import Banner from "../componets/Banner/Banner";
import { AuthContext } from "../Context/UserContext";
import api from '../api' // Axios instance pointing to your Node.js backend
import { useLocation } from "react-router-dom";
import { trending } from "../Constants/URLs";
function MoodRecommendationDisplay() {
  const { User } = useContext(AuthContext);
  
  const location = useLocation();
  const recommendedMovies = location.state?.recommendedMovies || [];
  console.log("Recommended Movies passed to RowPost:", recommendedMovies);
  

  return (
    <div>
     
     <Banner url={trending} />
      <div className="w-[99%] ml-1">
       {recommendedMovies.length !== 0 && (
          <RowPost
            first
            title="Mood Recommended Movies"
            movieData={recommendedMovies.movie_ids}
            key="Mood Recommended Movies"
          />
        )}
        
        
        
        
      </div>
      <Footer />
    </div>
  );
}

export default MoodRecommendationDisplay;
