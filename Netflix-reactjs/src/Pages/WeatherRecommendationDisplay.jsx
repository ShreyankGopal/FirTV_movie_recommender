// // src/Pages/WeatherRecommendationDisplay.jsx
// import React, { useEffect, useState, useContext } from "react";
// import { useNavigate } from "react-router-dom";
// import Footer from "../componets/Footer/Footer";
// import RowPost from "../componets/RowPost/RowPost";
// import GenreChart from "../componets/Banner/GenreChart";
// import WeatherGenreChart from "../componets/Banner/WeatherGenreChart";
// import { AuthContext } from "../Context/UserContext";
// import api from "../api"; // axios pointed at your Flask backend
// import Lottie from "lottie-react";
// import Cloudy from "../animations/cloud.json";
// import Rainy from "../animations/rain.json";
// import Clear from "../animations/sun.json";
// import Snowy from "../animations/snow.json";
// export default function WeatherRecommendationDisplay() {
//   const { User } = useContext(AuthContext);
//   const [loading, setLoading] = useState(true);
//   const [weatherData, setWeatherData] = useState(null);
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (!navigator.geolocation) {
//       alert("Geolocation not supported");
//       navigate("/");
//       return;
//     }
//     navigator.geolocation.getCurrentPosition(
//       async ({ coords }) => {
//         try {
//           const res = await api.post("/getWeatherRecommendation", {
//             lat: coords.latitude,
//             lon: coords.longitude,
//           });
//           setWeatherData(res.data);
//         } catch (e) {
//           console.error(e);
//           alert("Failed to fetch weather-based recommendations.");
//           navigate("/");
//         } finally {
//           setLoading(false);
//         }
//       },
//       () => {
//         alert("Allow location to see weather-based picks");
//         navigate("/");
//       }
//     );
//   }, [navigate]);

//   if (loading) {
//     return (
//       <div className="w-full h-screen flex items-center justify-center bg-black text-white">
//         Detecting weather & time...
//       </div>
//     );
//   }

//   const { weather_condition, time_slot, genres, movie_ids } = weatherData;
//   const totalScore = genres.reduce((sum, g) => sum + g.score, 0);

//   const chartData = genres.map(({ genre, score }) => ({
//     name: genre,
//     value: Math.round((score / totalScore) * 1000) / 10, // 1 decimal
//     description: `${genre} vibe for ${time_slot}`,  // optional
//   }));

//   return (
//     <div className="bg-black min-h-screen text-white">
//       <div className="px-8 py-10">
//         <h1 className="text-4xl font-bold mb-2">
//           {weather_condition} &nbsp;|&nbsp; {time_slot.charAt(0).toUpperCase() + time_slot.slice(1)}
//         </h1>
//         <p className="text-gray-300 mb-6">
//           Based on your local weather and time of day, here’s what you might enjoy:
//         </p>
//         <WeatherGenreChart data={chartData} />
//       </div>

//       <div className="ml-1 w-[99%] mt-40">
//         {movie_ids && movie_ids.length > 0 && (
//           <RowPost
//             first
//             title="Weather Picks"
//             movieData={movie_ids}
//             key="weather-picks"
//           />
//         )}
//       </div>

//       <Footer />
//     </div>
//   );
// }


// src/Pages/WeatherRecommendationDisplay.jsx
import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../componets/Footer/Footer";
import RowPost from "../componets/RowPost/RowPost";
import WeatherGenreChart from "../componets/Banner/WeatherGenreChart";
import { AuthContext } from "../Context/UserContext";
import api from "../api";
import Lottie from "lottie-react";
import CloudyAnim from "../animations/cloud.json";
import RainyAnim from "../animations/rain.json";
import SunnyAnim from "../animations/sun.json";
import SnowyAnim from "../animations/snow.json";

export default function WeatherRecommendationDisplay() {
  const { User } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const navigate = useNavigate();

  // Mapping of API condition → { label, emoji, animation }
  const weatherMap = {
    Clouds: { label: "Cloudy",    emoji: "☁️", animation: CloudyAnim },
    Clear:  { label: "Sunny",     emoji: "☀️", animation: SunnyAnim },
    Rain:   { label: "Rainy",     emoji: "🌧️", animation: RainyAnim },
    Snow:   { label: "Snowy",     emoji: "❄️", animation: SnowyAnim },
  };

  // Mapping of time slot → emoji
  const slotEmoji = {
    morning:   "🌅",
    afternoon: "☀️",
    evening:   "🌆",
    night:     "🌙",
  };

  useEffect(() => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      navigate("/");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await api.post("/getWeatherRecommendation", {
            lat: coords.latitude,
            lon: coords.longitude,
          });
          setWeatherData(res.data);
        } catch (e) {
          console.error(e);
          alert("Failed to fetch weather-based recommendations.");
          navigate("/");
        } finally {
          setLoading(false);
        }
      },
      () => {
        alert("Allow location to see weather-based picks");
        navigate("/");
      }
    );
  }, [navigate]);

  if (loading || !weatherData) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black text-white ">
        Detecting Weather And Time...
      </div>
    );
  }

  const { weather_condition, time_slot, genres, movie_ids } = weatherData;
  const info = weatherMap[weather_condition] || {
    label: weather_condition,
    emoji: "",
    animation: null,
  };

  // Prepare chart data
  const totalScore = genres.reduce((sum, g) => sum + g.score, 0);
  const chartData = genres.map(({ genre, score }) => ({
    name: genre,
    value: Math.round((score / totalScore) * 1000) / 10,
    description: `${genre} vibe for ${time_slot}`,
  }));

  // Capitalize slot and fetch emoji
  const slotLabel =
    time_slot.charAt(0).toUpperCase() + time_slot.slice(1);
  const slotEmj = slotEmoji[time_slot] || "";

  return (
    <div className="bg-black min-h-screen text-white">
      <div className="px-8 py-10 flex flex-col items-center">
        {/* Lottie Animation
        {info.animation && (
          <div className="w-32 h-32 mb-4">
            <Lottie animationData={info.animation} loop />
          </div>
        )} */}

        {/* Title with emojis */}
        {/* <h1 className="text-4xl font-bold mb-2 flex items-center space-x-2">
          <span>{info.emoji}</span>
          <span>{info.label}</span>
          <span>{slotLabel}</span>
          <span>{slotEmj}</span>
        </h1>

        <p className="text-gray-300 mb-6 text-center max-w-lg">
          Based on your local weather and time of day, here’s what you might enjoy:
        </p> */}

        {/* Genre Chart */}
        <WeatherGenreChart data={chartData} weatherLabel={info.label} weatherEmoji={info.emoji} slotLabel={slotLabel}
        slotEmoji={slotEmj}
        animationData={info.animation} />
      </div>

      {/* Movie Recommendations */}
      <div className="ml-1 w-[99%] mt-40">
        {movie_ids?.length > 0 && (
          <RowPost
            first
            title="Weather Picks"
            movieData={movie_ids}
            key="weather-picks"
          />
        )}
      </div>

      <Footer />
    </div>
  );
}
