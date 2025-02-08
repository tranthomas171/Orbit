import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  // Use an array for the selected filters.
  const [selectedFilters, setSelectedFilters] = useState(['Everything']);

  // The available filters.
  const filters = ['Everything', 'Image', 'Text'];

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);

    try {
      // If "Everything" is selected (or no filters are selected), search for all types.
      let types = [];
      if (selectedFilters.includes('Everything') || selectedFilters.length === 0) {
        types = ['text', 'image'];
      } else {
        types = selectedFilters.map(filter => filter.toLowerCase());
      }

      const queryParams = new URLSearchParams({
        query: query.trim(),
        types: types.join(',')
      });

      const response = await fetch(
        `http://localhost:3030/api/search?${queryParams}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();

      let transformedResults = [];

      // Loop through each type (e.g., text, image) and merge results.
      types.forEach((type) => {
        if (data.results[type]) {
          // For image type, use the 'data' field instead of 'documents'
          const sourceArray = type === 'image'
            ? data.results[type].data[0]
            : data.results[type].documents[0];

          const resultsForType = sourceArray.map((item, index) => ({
            id: data.results[type].ids[0][index],
            // For image results, use the base64 encoded data; for others, use the document.
            ...(type === 'image' ? { data: item } : { document: item }),
            type: data.results[type].metadatas[0][index].type,
            metadata: {
              ...data.results[type].metadatas[0][index],
              distance: data.results[type].distances[0][index]
            }
          }));

          transformedResults = transformedResults.concat(resultsForType);
        }
      });

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

  // This function handles toggling the checkboxes.
  const handleCheckboxChange = (filter, checked) => {
    if (filter === 'Everything') {
      // When "Everything" is toggled on, clear any other filters.
      if (checked) {
        setSelectedFilters(['Everything']);
      } else {
        setSelectedFilters([]);
      }
    } else {
      // If any non-"Everything" option is toggled, remove "Everything" if it exists.
      let updatedFilters = [...selectedFilters];
      if (updatedFilters.includes('Everything')) {
        updatedFilters = updatedFilters.filter((f) => f !== 'Everything');
      }
      if (checked) {
        updatedFilters.push(filter);
      } else {
        updatedFilters = updatedFilters.filter((f) => f !== filter);
      }
      setSelectedFilters(updatedFilters);
    }
  };

  return (
    <div className="w-full px-4 relative">
      <div className="relative flex items-center gap-4">
        <Search className="text-white/50 w-6 h-6" />

        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Search your orbit..."
            className="w-full px-6 py-4 text-lg bg-white/10 border border-white/20 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                       placeholder-white/50 text-white"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 
                         hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Render checkboxes below the search bar */}
      <div className="mt-4 flex gap-4">
        {filters.map((filter) => (
          <label key={filter} className="flex items-center text-white">
            <input
              type="checkbox"
              checked={selectedFilters.includes(filter)}
              onChange={(e) => handleCheckboxChange(filter, e.target.checked)}
              className="mr-2"
            />
            {filter}
          </label>
        ))}
      </div>

      {isSearching && (
        <div className="mt-2 text-center text-sm text-white/70">
          Searching...
        </div>
      )}
    </div>
  );
};

export default SearchBar;
