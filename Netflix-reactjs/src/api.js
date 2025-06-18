import axios from "axios";

const API_BASE_URL = "http://localhost:5001"; // Set this in .env

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials:true
});

export default api;