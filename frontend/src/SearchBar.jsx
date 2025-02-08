import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

const SearchBar = ({ onSearch, selectedFilter = 'Everything' }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const types = selectedFilter === 'Everything' 
        ? ['text', 'image', 'audio'] 
        : [selectedFilter.toLowerCase()];

      const queryParams = new URLSearchParams({
        query: query.trim(),
        types: types.join(',')
      });

      const response = await fetch(`http://localhost:3030/api/search?${queryParams}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      
      const transformedResults = data.results.text.documents[0].map((doc, index) => ({
        id: data.results.text.ids[0][index],
        document: doc,
        type: data.results.text.metadatas[0][index].type,
        metadata: {
          ...data.results.text.metadatas[0][index],
          distance: data.results.text.distances[0][index]
        }
      }));

      onSearch(transformedResults);
    } catch (error) {
      console.error('Search error:', error);
      onSearch([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setQuery('');
    onSearch([]);
  };

  return (
    <div className="relative w-full max-w-2xl">
      <div className="relative flex items-center">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="Search your orbit..."
          className="w-full px-4 py-2 pl-10 pr-10 text-sm bg-white/10 border border-white/20 rounded-lg 
                     focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                     placeholder-white/50 text-white"
        />
        <Search 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50" 
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 
                       hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {isSearching && (
        <div className="absolute top-full mt-2 left-0 right-0 text-center text-sm text-white/70">
          Searching...
        </div>
      )}
    </div>
  );
};

export default SearchBar;