import React, { useEffect, useState, useContext } from "react";
import Banner from "../componets/Banner/Banner";
import Footer from "../componets/Footer/Footer";
import RowPost from "../componets/RowPost/RowPost";
import {
  originals,
  trending,
  comedy,
  horror,
  Adventure,
  SciFi,
  Animated,
  War,
  trendingSeries,
  UpcomingMovies,
} from "../Constants/URLs";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../Firebase/FirebaseConfig";
import { AuthContext } from "../Context/UserContext";
import api from '../api' // Axios instance pointing to your Node.js backend

function Home() {
  const { User } = useContext(AuthContext);
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [recommendedMovies, setRecommendedMovies] = useState([]);

  useEffect(() => {
    if (!User?.uid) return;

    getDoc(doc(db, "WatchedMovies", User.uid)).then((result) => {
      if (result.exists()) {
        const mv = result.data();
        setWatchedMovies(mv.movies);
      }
    });

    // 🔥 POST to Node.js backend to get recommended movie IDs
    api
      .post("/getRecommendation", { userId: User.uid })
      .then((res) => {
        console.log("Recommended Movie IDs:", res.data.recommendedMovieIds);
        setRecommendedMovies(res.data.recommendedMovieIds);
      })
      .catch((err) => {
        console.error("Error getting recommendations:", err);
      });
  }, [User]);

  return (
    <div>
      <Banner url={trending} />
      <div className="w-[99%] ml-1">
       {recommendedMovies.length !== 0 && (
          <RowPost
            first
            title="Recommended Movies"
            movieData={recommendedMovies}
            key="Recommended Movies"
          />
        )}
        <RowPost title="Trending" url={trending} />
        <RowPost title="Animated" url={Animated} />
        {watchedMovies.length !== 0 && (
          <RowPost
            title="Watched Movies"
            movieData={watchedMovies}
            key="Watched Movies"
          />
        )}
        
        <RowPost title="Netflix Originals" islarge url={originals} />
        <RowPost title="Trending Series" url={trendingSeries} />
        <RowPost title="Science Fiction" url={SciFi} />
        <RowPost title="Upcoming Movies" url={UpcomingMovies} />
        <RowPost title="Comedy" url={comedy} />
        <RowPost title="Adventure" url={Adventure} />
        <RowPost title="Horror" url={horror} />
        <RowPost title="War" url={War} />
      </div>
      <Footer />
    </div>
  );
}

export default Home;
