import { API_KEY, baseUrl } from "./Constance";

export const TopRated = `${baseUrl}/movie/top_rated?api_key=${API_KEY}&language=en-US`;
export const originals = `${baseUrl}/discover/tv?api_key=${API_KEY}&with_networks=213&sort_by=popularity.desc&language=en-US`;
export const action = `${baseUrl}/discover/movie?api_key=${API_KEY}&with_genres=28`;
export const comedy = `${baseUrl}/discover/movie?api_key=${API_KEY}&with_genres=35`;
export const horror = `${baseUrl}/discover/movie?api_key=${API_KEY}&with_genres=27`;
export const Adventure = `${baseUrl}/discover/movie?api_key=${API_KEY}&with_genres=12`;
export const SciFi = `${baseUrl}/discover/movie?api_key=${API_KEY}&with_genres=878`;
export const Animated = `${baseUrl}/discover/movie?api_key=${API_KEY}&with_genres=16`;
export const War = `${baseUrl}/discover/movie?api_key=${API_KEY}&with_genres=10752`;
export const trending = `${baseUrl}/trending/all/week?api_key=${API_KEY}&sort_by=popularity.desc&language=en-US`;
export const trendingSeries = `${baseUrl}/trending/tv/week?api_key=${API_KEY}&sort_by=popularity.desc&language=en-US`;
export const UpcomingMovies = `${baseUrl}/movie/upcoming?api_key=${API_KEY}&language=en-US`;
