import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import './OrbitSearch.css';
import TextDisplay from './TextDisplay';
import SearchBar from './SearchBar';

const OrbitLogo = ({ color = '#FFFFFF', className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" className={className}>
    <circle cx="20" cy="20" r="12" fill="none" stroke={color} strokeWidth="2.5" />
    <circle cx="20" cy="20" r="4" fill={color} />
    <circle cx="28" cy="14" r="3" fill={color} />
  </svg>
);

const OrbitSearch = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [stars, setStars] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('Everything');
  const [showDashboard, setShowDashboard] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  const filters = ['Everything', 'Images', 'Text', 'Audio'];

  const colors = {
    background: '#1a0533',
    accent: '#9D8CFF',
    buttonPrimary: '#6347D9',
    white: '#FFFFFF',
    starColor: '#B4A5FF',
    starGlow: '#8A7DFF'
  };

  useEffect(() => {
    const generateStars = () => {
      return Array.from({ length: 100 }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        depth: Math.random(),
        speedX: -(Math.random() * 2 + 2),
        trailLength: Math.random() * 100 + 50,
        opacity: Math.random() * 0.5 + 0.5,
        size: Math.random() * 2 + 1,
        color: Math.random() > 0.5 ? colors.starColor : colors.starGlow
      }));
    };

    setStars(generateStars());
    setTimeout(() => setIsLoaded(true), 800);

    const moveStars = () => {
      setStars(prevStars => 
        prevStars.map(star => {
          let newX = star.x + star.speedX * star.depth;
          if (newX < -star.trailLength) {
            return {
              ...star,
              x: 100 + star.trailLength,
              y: Math.random() * 100,
              depth: Math.random()
            };
          }
          return { ...star, x: newX };
        })
      );
    };

    const interval = setInterval(moveStars, 16);
    return () => clearInterval(interval);
  }, []);

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    setMousePosition({
      x: (clientX / innerWidth) * 100,
      y: (clientY / innerHeight) * 100
    });
  };

  const renderStar = (star, index) => (
    <div
      key={index}
      className="star"
      style={{
        left: `${star.x}%`,
        top: `${star.y}%`,
        width: `${star.trailLength * star.depth}px`,
        height: `${star.size * (1 + star.depth)}px`,
        opacity: isLoaded ? star.opacity * (0.2 + star.depth * 0.8) : 0,
        background: `linear-gradient(90deg, ${star.color}, transparent)`,
        boxShadow: `0 0 ${star.depth * 2}px ${star.color}`,
        transform: `translateZ(${star.depth * 400}px)`,
      }}
    />
  );

  const handleSearchResults = (results) => {
    setSearchResults(results);
  };

  const renderDashboardContent = () => (
    <div className="content-container">
      <header className="header">
        <div 
          className={`logo-container ${isLoaded ? 'loaded' : ''}`}
          onClick={() => setShowDashboard(false)}
          style={{ cursor: 'pointer' }}
        >
          <OrbitLogo className="logo" color={colors.accent} />
          <span className="logo-text">ORBIT</span>
        </div>
        <nav className={`nav-container ${isLoaded ? 'loaded' : ''}`}>
          <div className="filter-container">
            <button 
              className="filter-button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span>{selectedFilter}</span>
              <ChevronDown 
                size={16} 
                className={`chevron ${isDropdownOpen ? 'rotated' : ''}`}
              />
            </button>
            
            {isDropdownOpen && (
              <div className="dropdown-menu">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => {
                      setSelectedFilter(filter);
                      setIsDropdownOpen(false);
                    }}
                    className={`dropdown-item ${filter === selectedFilter ? 'selected' : ''}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="dashboard-button" onClick={() => setShowDashboard(false)}>Home</button>
        </nav>
      </header>
  
      <main className="main-content">
        <div className={`search-container ${isLoaded ? 'loaded' : ''}`}>
          <SearchBar
            selectedFilter={selectedFilter}
            onSearch={handleSearchResults}
          />
        </div>

        <div className={`results-container ${isLoaded ? 'loaded' : ''}`}>
          <TextDisplay 
            initialItems={searchResults}
            isSearchMode={searchResults.length > 0}
          />
        </div>
      </main>
    </div>
  );

  const renderMainContent = () => (
    <div className="content-container">
      <header className="header">
        <div className={`logo-container ${isLoaded ? 'loaded' : ''}`}>
          <OrbitLogo className="logo" color={colors.accent} />
          <span className="logo-text">ORBIT</span>
        </div>
        <nav className={`nav-container ${isLoaded ? 'loaded' : ''}`}>
          <button className="dashboard-button" onClick={() => setShowDashboard(true)}>Dashboard</button>
        </nav>
      </header>

      <main className="main-content">
        <h1 className={`title ${isLoaded ? 'loaded' : ''}`}>
          Welcome to Orbit
        </h1>
        
        <p className={`description ${isLoaded ? 'loaded' : ''}`}>
          Discover a new dimension of content through image, video, audio, and text.
          Find unexpected connections as you explore new universes.
        </p>
        
        <div className={`cta-container ${isLoaded ? 'loaded' : ''}`}>
          <button 
            className="cta-button"
            onClick={() => setShowDashboard(true)}
          >
            Get Started
          </button>
        </div>
      </main>
    </div>
  );

  return (
    <div className="orbit-container" onMouseMove={handleMouseMove}>
      <div 
        className="stars-container"
        style={{ 
          transform: `rotateY(${(mousePosition.x - 50) * 0.02}deg) 
                     rotateX(${(mousePosition.y - 50) * -0.02}deg)`
        }}
      >
        {stars.map((star, index) => renderStar(star, index))}
      </div>

      {showDashboard ? renderDashboardContent() : renderMainContent()}
    </div>
  );
};

export default OrbitSearch;