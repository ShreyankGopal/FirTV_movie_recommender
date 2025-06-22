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
import React, { useState, useRef, useContext, useEffect } from "react";
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

  const emojis = [
    { value: "love", animation: love },
    { value: "cool", animation: cool },
    { value: "shocked", animation: shocked },
    { value: "happy", animation: happy },
    { value: "thinking", animation: thinking },
    { value: "sad", animation: sad },
    { value: "angry", animation: angry },
    { value: "tired", animation: tired }
  ];

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Array of dynamic messages
  const loadingMessages = [
    "Beep Boop... Analyzing Emotions"
  ];

  // Effect to cycle through loading messages
  useEffect(() => {
    let interval;
    if (isAnalyzing) {
      let messageIndex = 0;
      setLoadingMessage(loadingMessages[0]);
      
      interval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingMessage(loadingMessages[messageIndex]);
      }, 5000); // Change message every 1.5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnalyzing]);

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
    try {
      setIsAnalyzing(true);
      
      console.log("Mood text:", moodText);
      console.log("Selected mood emoji value:", selectedEmoji);
      
      const response = await api.post("/analyze-mood", {
        text: moodText,
        emoji: selectedEmoji,
        user_id: User.uid
      });
      
      const result = response.data;
      console.log("Recommended movie IDs:", result);
      
      onClose();
      navigate("/mood-recommendation-display", {
        state: { recommendedMovies: result },
      });
      
    } catch (error) {
      console.error("Error analyzing mood:", error);
      // Handle error - maybe show error message to user
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80">
      <div className="relative w-full max-w-lg p-6 bg-black rounded-lg shadow-lg text-white border-2 border-red-600">
        {/* Loading overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-black bg-opacity-90 rounded-lg flex flex-col items-center justify-center z-10">
            {/* Animated dots */}
            <div className="flex justify-center space-x-1 mb-4">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            
            {/* Dynamic loading message */}
            <p className="text-lg font-medium text-white transition-opacity duration-300 text-center">
              {loadingMessage}
            </p>
          </div>
        )}

        {/* Close (X) button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-red-600 hover:text-red-400"
          disabled={isAnalyzing}
        >
          <FaTimes size={20} />
        </button>

        {/* Centered heading */}
        <h2 className="text-white text-2xl font-semibold text-center mt-4 mb-8">
          How are you feeling today?
        </h2>

        {/* Mood emoji buttons */}
        <div className="grid grid-cols-4 gap-y-4 gap-x-0 mb-4 mt-4 justify-items-center">
        {emojis.map(({ value, animation }) => (
          <button
            key={value}
            onClick={() => setSelectedEmoji(selectedEmoji === value ? null : value)}
            disabled={isAnalyzing}
            className={`w-14 h-14 rounded-full transition-transform duration-300 p-1 ${
              selectedEmoji === value ? "scale-110" : ""
            } ${isAnalyzing ? "opacity-50" : ""}`}
          >
            <Lottie
              animationData={animation}
              loop={true}
              style={{ width: '100%', height: '100%' }}
            />
          </button>
        ))}
      </div>


        {/* Text Input with Mic */}
        <div className="flex items-center border border-white rounded px-3 py-2 mb-8 mt-10">
          <input
            type="text"
            value={moodText}
            onChange={(e) => setMoodText(e.target.value)}
            placeholder="Tell us more..."
            disabled={isAnalyzing}
            className={`flex-1 bg-transparent outline-none text-white placeholder-gray-400 ${
              isAnalyzing ? "opacity-50" : ""
            }`}
          />
          <button 
            onClick={handleVoiceInput} 
            disabled={isAnalyzing}
            className={`ml-3 text-white hover:text-red-500 ${
              isAnalyzing ? "opacity-50" : ""
            }`}
          >
            <FaMicrophone />
          </button>
        </div>

        {/* Submit button */}
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isAnalyzing || (!moodText.trim() && !selectedEmoji)}
            className={`bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded transition-colors duration-200 ${
              isAnalyzing || (!moodText.trim() && !selectedEmoji) 
                ? "opacity-50 cursor-not-allowed" 
                : ""
            }`}
          >
            {isAnalyzing ? "Analyzing..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoodModal;