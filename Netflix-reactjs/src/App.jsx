// import { useEffect, useContext, lazy, Suspense,useLocation } from "react";
// import "./App.css";

// const Home = lazy(() => import("./Pages/Home"));
// const Series = lazy(() => import("./Pages/Series"));
// const Search = lazy(() => import("./Pages/Search"));
// const Profile = lazy(() => import("./Pages/Profile"));
// const MyList = lazy(() => import("./Pages/MyList"));
// const SignIn = lazy(() => import("./Pages/SignIn"));
// const SignUp = lazy(() => import("./Pages/SignUp"));
// const Welcome = lazy(() => import("./Pages/Welcome"));
// const ErrorPage = lazy(() => import("./Pages/ErrorPage"));
// const Play = lazy(() => import("./Pages/Play"));
// const LikedMovies = lazy(() => import("./Pages/LikedMovies"));
// const History = lazy(() => import("./Pages/History"));

// import { Routes, Route, Navigate } from "react-router-dom";
// import { AuthContext } from "./Context/UserContext";
// import { getAuth, onAuthStateChanged } from "firebase/auth";
// import Loading from "./componets/Loading/Loading";
// import Navbar from "./componets/Header/Navbar";
// import NavbarWithoutUser from "./componets/Header/NavbarWithoutUser";
// // import SelectPreferences from "./Pages/SelectPreferences";

// // const location = useLocation();
// // const hideNavbar = location.pathname === "/select-preferences";

// function App() {
//   const { User, setUser } = useContext(AuthContext);
//   useEffect(() => {
//     const auth = getAuth();
//     onAuthStateChanged(auth, (user) => {
//       setUser(user);
//       console.log(user);
//     });
//   }, []);

//   return (
//     <div>
//       {User ? <Navbar></Navbar> : <NavbarWithoutUser></NavbarWithoutUser>}
//       <Suspense replace fallback={<Loading />}>
//         <Routes>
//           <Route index path="/" element={User ? <Home /> : <Welcome />} />
//           {User ? (
//             <>
//               <Route path="/home" element={<Home />} />
//               <Route path="/series" element={<Series />} />
//               <Route path="/search" element={<Search />} />
//               <Route path="/profile" element={<Profile />} />
//               <Route path="/mylist" element={<MyList />} />
//               <Route path="/liked" element={<LikedMovies />} />
//               <Route path="/history" element={<History />} />
//               <Route path="/play/:id" element={<Play />} />
//             </>
//           ) : null}
//           <Route path="/play/:id" element={<Play />} />

//           <Route path="/signin" element={<SignIn />} />
//           <Route path="/signup" element={<SignUp />} />
//           <Route path="*" element={<ErrorPage />} />
//         </Routes>
//       </Suspense>
//     </div>
//   );
// }

// export default App;




import { useEffect, useContext, lazy, Suspense,useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./App.css";

const Home = lazy(() => import("./Pages/Home"));
const Series = lazy(() => import("./Pages/Series"));
const Search = lazy(() => import("./Pages/Search"));
const Profile = lazy(() => import("./Pages/Profile"));
const MyList = lazy(() => import("./Pages/MyList"));
const SignIn = lazy(() => import("./Pages/SignIn"));
const SignUp = lazy(() => import("./Pages/SignUp"));
const Welcome = lazy(() => import("./Pages/Welcome"));
const ErrorPage = lazy(() => import("./Pages/ErrorPage"));
const Play = lazy(() => import("./Pages/Play"));
const LikedMovies = lazy(() => import("./Pages/LikedMovies"));
const History = lazy(() => import("./Pages/History"));
const SelectPreferences = lazy(() => import("./Pages/SelectPreferences"));
const MoodModal = lazy(() => import("./Pages/MoodModal"));
const PlaySharedMovie = lazy(() => import("./Pages/PlaySharedMovie"));

import { AuthContext } from "./Context/UserContext";
import { auth } from "./Firebase/FirebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import Loading from "./componets/Loading/Loading";
import Navbar from "./componets/Header/Navbar";
import NavbarWithoutUser from "./componets/Header/NavbarWithoutUser";
import MoodRecommendationDisplay from "./Pages/MoodRecommendationDisplay";
function App() {
  const { User, setUser } = useContext(AuthContext);
  const location = useLocation(); // 👈 Add this line
  const hideNavbar = location.pathname === "/select-preferences"; // 👈 And this
  const [showMoodModal, setShowMoodModal] = useState(false);

  useEffect(() => {
    const handleOpenMoodModal = () => setShowMoodModal(true);
    window.addEventListener("open-mood-modal", handleOpenMoodModal);
    return () => window.removeEventListener("open-mood-modal", handleOpenMoodModal);
  }, []);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      console.log(user);
    });
    return () => unsubscribe(); // clean up listener
  }, []);

  return (
    <div>
      {!hideNavbar && (User ? <Navbar /> : <NavbarWithoutUser />)} {/* 👈 Conditional rendering */}
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route index path="/" element={User ? <Home /> : <Welcome />} />
          {User && (
            <>
              <Route path="/mood-recommendation-display" element={<MoodRecommendationDisplay />} />
              <Route path="/home" element={<Home />} />
              <Route path="/series" element={<Series />} />
              <Route path="/search" element={<Search />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/mylist" element={<MyList />} />
              <Route path="/liked" element={<LikedMovies />} />
              <Route path="/history" element={<History />} />
              <Route path="/play/:id" element={<Play />} />
              <Route path="/select-preferences" element={<SelectPreferences />} /> {/* 👈 New route */}
              <Route path="/play-together/:roomId" element={<PlaySharedMovie />} /> {/* 👈 New route */}
            </>
          )}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/play/:id" element={<Play />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </Suspense>
      {showMoodModal && (
        <Suspense fallback={<Loading />}>
          <MoodModal onClose={() => setShowMoodModal(false)} />
        </Suspense>
      )}
    </div>
  );
}
export default App;
