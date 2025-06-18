// import React, { useState, useEffect } from "react";

// const MoodModal = ({ onClose }) => {
//   const [mood, setMood] = useState("");
//   const [transcript, setTranscript] = useState("");
//   const [isListening, setIsListening] = useState(false);

//   // Emoji list (you can customize)
//   const emojis = ["😊", "😢", "😠", "😍", "😨", "😎", "😴"];

//   // Voice recognition setup
//   const startListening = () => {
//     const SpeechRecognition =
//       window.SpeechRecognition || window.webkitSpeechRecognition;
//     if (!SpeechRecognition) {
//       alert("Your browser does not support voice recognition.");
//       return;
//     }

//     const recognition = new SpeechRecognition();
//     recognition.lang = "en-US";
//     recognition.start();
//     setIsListening(true);

//     recognition.onresult = (event) => {
//       const result = event.results[0][0].transcript;
//       setTranscript(result);
//       setMood(result);
//     };

//     recognition.onerror = (event) => {
//       console.error("Voice recognition error:", event.error);
//       setIsListening(false);
//     };

//     recognition.onend = () => {
//       setIsListening(false);
//     };
//   };

//   const handleEmojiClick = (emoji) => {
//     setMood(emoji);
//   };

//   const handleSubmit = () => {
//     console.log("Selected mood:", mood); // ✅ Replace with your save logic
//     onClose(); // close after saving
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
//       <div className="bg-white p-6 rounded-lg w-full max-w-md text-center shadow-lg">
//         <h2 className="text-2xl font-semibold mb-4 text-gray-800">How are you feeling today?</h2>

//         {/* Emoji selection */}
//         <div className="flex justify-center gap-3 mb-4 text-3xl">
//           {emojis.map((emoji) => (
//             <button
//               key={emoji}
//               onClick={() => handleEmojiClick(emoji)}
//               className={`hover:scale-110 transition-transform ${
//                 mood === emoji ? "ring-2 ring-red-400 rounded" : ""
//               }`}
//             >
//               {emoji}
//             </button>
//           ))}
//         </div>

//         {/* Text input */}
//         <input
//           type="text"
//           value={mood}
//           onChange={(e) => setMood(e.target.value)}
//           placeholder="Type your mood..."
//           className="w-full px-3 py-2 mb-4 border border-gray-300 rounded"
//         />

//         {/* Voice input */}
//         <button
//           onClick={startListening}
//           className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
//         >
//           {isListening ? "Listening..." : "Speak Mood 🎤"}
//         </button>

//         {/* Submit + Close */}
//         <div className="flex justify-center gap-4">
//           <button
//             onClick={handleSubmit}
//             className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
//           >
//             Save
//           </button>
//           <button
//             onClick={onClose}
//             className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
//           >
//             Close
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default MoodModal;

import React, { useState, useRef,useContext } from "react";
import { FaMicrophone, FaTimes } from "react-icons/fa";

import Lottie from "lottie-react";
import happy from "../animations/happy.json";
import sad from "../animations/sad.json";
import angry from "../animations/angry.json";
import cool from "../animations/cool.json";
import tired from "../animations/tired.json";
import shocked from "../animations/shocked.json";
import love from "../animations/love.json";
import thinking from "../animations/thinking.json";
import api from "../api";
import { AuthContext } from "../Context/UserContext";
import { useNavigate } from "react-router-dom";
const MoodModal = ({ onClose, onMoodSelected }) => {
  const [moodText, setMoodText] = useState(""); // 💡 Used in input field
  const [listening, setListening] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState(""); // 💡 Used in emoji buttons
  const recognitionRef = useRef(null);
  const { User } = useContext(AuthContext);
  const navigate = useNavigate();
//   const emojis = [
//     { emoji: "😊", value: "happy" },
//     { emoji: "😢", value: "sad" },
//     { emoji: "😠", value: "angry" },
//     { emoji: "😴", value: "tired" },
//     { emoji: "😍", value: "love" },
//     { emoji: "😎", value: "cool" },
//     { emoji: "🤯", value: "shocked" },
//     { emoji: "🤔", value: "thinking" }
//   ];
    const emojis = [
        { value: "love", animation: love },
        { value: "cool", animation: cool },
        { value: "shocked", animation: shocked },
        { value: "happy", animation: happy },
        { value: "thinking", animation: thinking },
        { value: "sad", animation: sad },
        { value: "angry", animation: angry },
        { value: "tired", animation: tired }
        // add more
    ];

  const AnimatedEmoji = ({ selected, onClick, animation }) => (
    <button
      onClick={onClick}
      className={`w-20 h-20 transition-transform duration-300 ${
        selected ? "scale-110 border-red-500 border-2 rounded-full" : ""
      }`}
    >
      <Lottie animationData={animation} loop={true} />
    </button>
  );

  const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = SpeechRecognition ? new SpeechRecognition() : null;

  const handleVoiceInput = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false; // key: let it stop on its own when silence is detected

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMoodText(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
    };

    recognition.onend = () => {
      console.log("Recognition ended");
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const handleSubmit = async () => {
    console.log("Mood text:", moodText);
    console.log("Selected mood emoji value:", selectedEmoji);
    const response = await api.post("/analyze-mood", {
      text: moodText,
      emoji: selectedEmoji,
      user_id: User.uid
    });
    
  
    const result = response.data;
  //  console.log("Detected genres:", result);
    console.log("Recommended movie IDs:", result);
    onClose();
    navigate("/mood-recommendation-display", {
      state: { recommendedMovies: result },
    });
  };
  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="relative w-full max-w-lg p-6 bg-black rounded-lg shadow-lg text-white border-2 border-red-600">
        {/* Close (X) button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-red-600 hover:text-red-400"
        >
          <FaTimes size={20} />
        </button>

        {/* Centered heading */}
        <h2 className="text-white text-2xl font-semibold text-center mt-4 mb-6">
          How are you feeling today?
        </h2>

        {/* Mood emoji buttons */}
        {/* <div className="flex justify-center gap-4 mb-4 mt-4">
        {emojis.map(({ emoji, value }) => (
            <button
                key={value}
                onClick={() => setSelectedEmoji(value)}
                className={`text-2xl transition-transform duration-150 ${
                selectedEmoji === value ? "scale-125" : ""
                }`}
            >
                {emoji}
            </button>
            ))}
        </div> */}
        <div className="flex justify-center gap-4 mb-4 mt-4">
        {emojis.map(({ value, animation }) => (
            <button
            key={value}
            onClick={() => setSelectedEmoji(selectedEmoji === value ? null : value)}
            className={`w-20 h-20 rounded-full transition-transform duration-300 p-1 ${
                selectedEmoji === value ? "scale-125" : ""
            }`}
            >
            <Lottie animationData={animation} loop={true} />
            </button>
        ))}
        </div>

        {/* Text Input with Mic */}
        <div className="flex items-center border border-white rounded px-3 py-2 mb-8 mt-8">
          <input
            type="text"
            value={moodText}
            onChange={(e) => setMoodText(e.target.value)}
            placeholder="Tell us more..."
            className="flex-1 bg-transparent outline-none text-white placeholder-gray-400"
          />
          <button onClick={handleVoiceInput} className="ml-3 text-white hover:text-red-500">
            <FaMicrophone />
          </button>
        </div>

        {/* Submit button */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoodModal;
