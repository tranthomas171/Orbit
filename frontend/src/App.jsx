import { useState, useEffect } from 'react';
import './App.css';

const OrbitLogo = ({ color = '#FFFFFF', className = '' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" className={className}>
    <circle cx="20" cy="20" r="12" fill="none" stroke={color} strokeWidth="2.5" />
    <circle cx="20" cy="20" r="4" fill={color} />
    <circle cx="28" cy="14" r="3" fill={color} />
  </svg>
);

function App() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [stars, setStars] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  const colors = {
    accent: '#9D8CFF',
    starColor: '#B4A5FF',
    starGlow: '#8A7DFF'
  };

  useEffect(() => {
    const generateStars = () => {
      return Array.from({ length: 200 }, () => ({
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
              depth: Math.random(),
              speedX: -(Math.random() * 2 + 2),
              opacity: Math.random() * 0.5 + 0.5,
              color: Math.random() > 0.5 ? colors.starColor : colors.starGlow
            };
          }
          
          return {
            ...star,
            x: newX
          };
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

  const renderStar = (star, index) => {
    const width = star.trailLength * star.depth;
    const height = star.size * (1 + star.depth);
    const blur = star.depth * 2;
    const opacity = star.opacity * (0.2 + star.depth * 0.8);

    return (
      <div
        key={index}
        className="star"
        style={{
          left: `${star.x}%`,
          top: `${star.y}%`,
          width: `${width}px`,
          height: `${height}px`,
          opacity: isLoaded ? opacity : 0,
          background: `linear-gradient(90deg, ${star.color}, transparent)`,
          boxShadow: `0 0 ${blur}px ${star.color}`,
          transform: `translateZ(${star.depth * 400}px)`,
        }}
      />
    );
  };

  return (
    <div className="space-container" onMouseMove={handleMouseMove}>
      <div 
        className="stars-container"
        style={{ 
          transform: `rotateY(${(mousePosition.x - 50) * 0.02}deg) 
                     rotateX(${(mousePosition.y - 50) * -0.02}deg)`
        }}
      >
        {stars.map((star, index) => renderStar(star, index))}
      </div>

      <div className="content-wrapper">
        <header className="header">
          <div className={`logo-container ${isLoaded ? 'loaded' : 'fade-in'}`}
               style={{ transitionDelay: '400ms' }}>
            <OrbitLogo color={colors.accent} />
            <span className="logo-text">ORBIT</span>
          </div>
          
          <div className={`nav-buttons ${isLoaded ? 'loaded' : 'fade-in'}`}
               style={{ transitionDelay: '600ms' }}>
            <button className="sign-in-button">Sign In</button>
            <button className="primary-button">Join Now</button>
          </div>
        </header>

        <main className="main-content">
          <h1 className={`title ${isLoaded ? 'loaded' : 'fade-in'}`}
              style={{ transitionDelay: '800ms' }}>
            Welcome to Orbit
          </h1>
          
          <p className={`description ${isLoaded ? 'loaded' : 'fade-in'}`}
             style={{ transitionDelay: '1000ms' }}>
            Discover a new dimension of content through image, video, audio, and text.
            Find unexpected connections as you explore new universes.
          </p>
          
          <div className={isLoaded ? 'loaded' : 'fade-in'}
               style={{ transitionDelay: '1200ms' }}>
            <button className="cta-button">Get Started</button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;