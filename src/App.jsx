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
    background: '#0B0733',
    accent: '#9D8CFF',
    buttonPrimary: '#4936B6',
    buttonSecondary: '#2A1B8F',
    white: '#FFFFFF',
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
    setTimeout(() => setIsLoaded(true), 500);

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
        style={{
          position: 'absolute',
          left: `${star.x}%`,
          top: `${star.y}%`,
          width: `${width}px`,
          height: `${height}px`,
          opacity: isLoaded ? opacity : 0,
          background: `linear-gradient(90deg, ${star.color}, transparent)`,
          boxShadow: `0 0 ${blur}px ${star.color}`,
          transform: `translateZ(${star.depth * 400}px)`,
          transition: 'opacity 1s ease-in-out',
          borderRadius: '50%'
        }}
      />
    );
  };

  return (
    <div 
      style={{ 
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        overflow: 'hidden',
        perspective: '1000px',
        background: `linear-gradient(135deg, ${colors.background}, #150D40)`
      }}
      onMouseMove={handleMouseMove}
    >
      <div 
        style={{ 
          position: 'absolute',
          inset: 0,
          transformStyle: 'preserve-3d',
          transform: `rotateY(${(mousePosition.x - 50) * 0.02}deg) 
                     rotateX(${(mousePosition.y - 50) * -0.02}deg)`
        }}
      >
        {stars.map((star, index) => renderStar(star, index))}
      </div>

      <div style={{ position: 'relative', zIndex: 10, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <OrbitLogo style={{ height: '2rem', width: '2rem' }} color={colors.accent} />
            <span style={{ fontSize: '1.25rem', fontWeight: 300, letterSpacing: '0.05em', color: colors.white }}>ORBIT</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button style={{ padding: '0.5rem 1rem', color: 'rgba(255,255,255,0.8)', transition: 'all 0.3s' }}>
              Sign In
            </button>
            <button 
              style={{ 
                borderRadius: '9999px', 
                padding: '0.5rem 1.25rem', 
                color: colors.white,
                backgroundColor: colors.buttonPrimary,
                transition: 'all 0.3s'
              }}
            >
              Join Now
            </button>
          </div>
        </header>

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 1rem' }}>
          <h1 style={{ fontSize: '4.5rem', fontWeight: 300, letterSpacing: '0.05em', color: colors.white, marginBottom: '2rem' }}>
            Welcome to Orbit
          </h1>
          <p style={{ marginBottom: '4rem', maxWidth: '36rem', fontSize: '1.25rem', lineHeight: 1.7, fontWeight: 300, letterSpacing: '0.025em', color: 'rgba(255,255,255,0.8)' }}>
            Discover a new dimension of content through image, video, audio, and text.
            Find unexpected connections as you explore new universes.
          </p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <button 
              style={{ 
                borderRadius: '9999px',
                padding: '1rem 2rem',
                color: colors.white,
                backgroundColor: colors.buttonPrimary,
                transition: 'all 0.3s'
              }}
            >
              Get Started
            </button>
            <button 
              style={{ 
                borderRadius: '9999px',
                padding: '1rem 2rem',
                color: colors.white,
                backgroundColor: colors.buttonSecondary,
                transition: 'all 0.3s'
              }}
            >
              Learn More
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;