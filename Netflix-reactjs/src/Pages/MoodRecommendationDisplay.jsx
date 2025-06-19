import React, { useEffect, useState, useContext } from "react";

import Footer from "../componets/Footer/Footer";
import RowPost from "../componets/RowPost/RowPost";

import Banner from "../componets/Banner/Banner";
import GenreChart from "../componets/Banner/GenreChart";
import { AuthContext } from "../Context/UserContext";
import api from '../api' // Axios instance pointing to your Node.js backend
import { useLocation } from "react-router-dom";
import { trending } from "../Constants/URLs";

function getGenreDescription(genre) {
  const genreQuotes = {
    Happy: [
      '“Life is like a box of chocolates, you never know what you\'re gonna get.” – Forrest Gump',
      '“Happiness can be found even in the darkest of times.” – Harry Potter and the Prisoner of Azkaban',
      '“To infinity and beyond!” – Toy Story',
      '“I\'m walking on sunshine!” – The Secret Life of Walter Mitty'
    ],
    Sad: [
      '“You complete me.” – Jerry Maguire',
      '“I wish I knew how to quit you.” – Brokeback Mountain',
      '“I’m sorry, Wilson!” – Cast Away',
      '“I’ll never let go, Jack.” – Titanic'
    ],
    Tense: [
      '“I’m having an old friend for dinner.” – The Silence of the Lambs',
      '“Why so serious?” – The Dark Knight',
      '“This is not a drill.” – Zero Dark Thirty',
      '“Hold on to your butts.” – Jurassic Park',
      '“You talkin’ to me?” – Taxi Driver'
    ],
    Scary: [
      '“Here’s Johnny!” – The Shining',
      '“Do you want to play a game?” – Saw',
      '“They’re here…” – Poltergeist',
      '“I see dead people.” – The Sixth Sense',
      '“Whatever you do, don\'t fall asleep.” – A Nightmare on Elm Street'
    ],
    Romantic: [
      '“You had me at hello.” – Jerry Maguire',
      '“I’m just a girl, standing in front of a boy, asking him to love her.” – Notting Hill',
      '“As you wish.” – The Princess Bride',
      '“Love means never having to say you’re sorry.” – Love Story',
      '“I think I’d miss you even if we’d never met.” – The Wedding Date'
    ],
    Uplifting: [
      '“Carpe diem. Seize the day, boys.” – Dead Poets Society',
      '“It’s not about how hard you hit. It’s about how hard you can get hit and keep moving forward.” – Rocky Balboa',
      '“Hope is a good thing, maybe the best of things.” – The Shawshank Redemption',
      '“You is kind. You is smart. You is important.” – The Help'
    ],
    Emotional: [
      '“To me, you are perfect.” – Love Actually',
      '“Don’t let anyone ever make you feel like you don’t deserve what you want.” – 10 Things I Hate About You',
      '“So, it’s not gonna be easy. It’s gonna be really hard.” – The Notebook',
      '“Promise me you’ll survive.” – Titanic'
    ],
    Suspense: [
      '“The greatest trick the Devil ever pulled was convincing the world he didn’t exist.” – The Usual Suspects',
      '“A census taker once tried to test me.” – The Silence of the Lambs',
      '“There’s a storm coming.” – Terminator'
    ],
    "Light-hearted": [
      '“Just keep swimming.” – Finding Nemo',
      '“There’s no place like home.” – The Wizard of Oz',
      '"60% of the time, it works every time." – Anchorman',
      '"I\'m just one stomach flu away from my goal weight." – The Devil Wears Prada'
    
    ],
    Dark: [
      '“All those moments will be lost in time, like tears in rain.” – Blade Runner',
      '“Madness, as you know, is like gravity… all it takes is a little push.” – The Dark Knight',
      '“The night is darkest just before the dawn.” – The Dark Knight',
      '"We stopped checking for monsters under our bed when we realized they were inside us." – The Joker ',
      '“We all go a little mad sometimes.” – Psycho'
    ],
    Reflective: [
      '“It’s only after we’ve lost everything that we’re free to do anything.” – Fight Club',
      '"We are who we choose to be." – Spider-Man (2002)',
      '“Get busy living, or get busy dying.” – The Shawshank Redemption',
      '"You mustn’t be afraid to dream a little bigger, darling." – Inception',
      '"After a while, you learn to ignore the names people call you and just trust who you are." – Shrek'
    ],
    Adventurous: [
      '“I’m going on an adventure!” – The Hobbit',
      '“Fortune and glory, kid. Fortune and glory.” – Indiana Jones and the Temple of Doom',
      '“Adventure is out there!” – Up',
      '“Welcome to the jungle.” – Jumanji',
      '"Roads? Where we’re going, we don’t need roads." – Back to the Future'
    ]
  };

  const quotes = genreQuotes[genre];
  if (!quotes) return "No quote available";

  return quotes[Math.floor(Math.random() * quotes.length)];
}


function MoodRecommendationDisplay() {
  const { User } = useContext(AuthContext);
  
  const location = useLocation();
  const recommendedMovies = location.state?.recommendedMovies || [];
  console.log("Recommended Movies passed to RowPost:", recommendedMovies);
  
  const totalScore = recommendedMovies.genres.reduce((sum, item) => sum + item.score, 0);

  const genreData = recommendedMovies.genres.map(({ genre, score }) => {
    const percentage = (score / totalScore) * 100;

    return {
      name: genre,
      value: Math.round(percentage * 10) / 10,  // rounded to 1 decimal
      description: getGenreDescription(genre)
    };
  });
  

  return (
    <div>
     
     <div className="w-full text-white px-8 py-10 mt-8">
        {/* <h1 className="text-4xl font-bold mb-4">Hi Peter!</h1> */}
        {/* <p className="text-lg text-gray-300 mb-6">
            We've analyzed your mood and curated a personalized set of movies and shows just for you.
        </p> */}
        <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="w-full lg:w-1/2">
            {/* Import Recharts PieChart to display emotions */}
            <GenreChart data = {genreData}/>
            </div>
            {/* <div className="w-full lg:w-1/2">
            <p className="text-md text-gray-400 leading-6">
                Based on your recent emoji and text inputs, we detected a blend of emotions. 
                This collection spans genres that match your current vibe — whether you're in the 
                mood for a laugh, a thrill, or something heartfelt.
            </p>
            </div> */}
        </div>
      </div>
      <div className="w-[99%] ml-1 mt-40">
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
