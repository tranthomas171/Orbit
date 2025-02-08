import { useState, useCallback } from 'react';

const useSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const performSearch = useCallback(async (query, types = ['text']) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const queryParams = new URLSearchParams({
        query: query.trim(),
        types: types.join(',')
      });

      const response = await fetch(`http://localhost:3030/api/search?${queryParams}`);
      if (!response.ok) {
        throw new Error('Search request failed');
      }

      const data = await response.json();
      
      // Transform the search results into the format expected by TextDisplay
      const transformedResults = data.results.text.documents[0].map((doc, index) => ({
        id: data.results.text.ids[0][index],
        document: doc,
        type: data.results.text.metadatas[0][index].type,
        metadata: {
          ...data.results.text.metadatas[0][index],
          distance: data.results.text.distances[0][index]
        }
      }));

      setSearchResults(transformedResults);
    } catch (error) {
      setSearchError(error.message);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  return {
    searchResults,
    isSearching,
    searchError,
    performSearch
  };
};

export default useSearch;