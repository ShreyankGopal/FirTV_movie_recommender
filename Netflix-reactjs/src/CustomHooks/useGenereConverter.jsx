import { genresList } from "../Constants/Constance";

const useGenereConverter = () => {
  const convertGenere = (genreIds) => {
    const genresConvertedList = [];

    if (!Array.isArray(genreIds)) return genresConvertedList; // 🛡️ Guard clause

    genreIds.slice(0, 3).forEach((genreId) => {
      const match = genresList.find((el) => el.id === genreId);
      if (match) {
        genresConvertedList.push(match.name);
      }
    });

    return genresConvertedList;
  };

  return { convertGenere };
};

export default useGenereConverter;
