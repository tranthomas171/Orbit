import React, { useState, useEffect } from 'react';

const styles = {
  container: {
    position: 'relative',
    width: '100vw',
    height: '100vh',
    padding: '20px',
    overflow: 'hidden',
    
  },
  card: {
    position: 'absolute',
    width: '300px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0',
    transition: 'transform 0.2s ease-in-out, z-index 0s',
    cursor: 'pointer',
  },
  cardHover: {
    transform: 'scale(1.02)',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    zIndex: 2,
  },
  text: {
    fontSize: '14px',
    lineHeight: '1.4',
    color: '#333333',
    overflow: 'hidden',
  },
  metadata: {
    fontSize: '12px',
    color: '#666666',
    marginTop: '6px',
  },
  error: {
    color: '#ff0000',
    padding: '16px',
  },
  loading: {
    padding: '16px',
    color: '#666666',
  },
  showMoreButton: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    cursor: 'pointer',
    fontSize: '12px',
    padding: '4px 0',
  },
  expandedView: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxWidth: '90%',
    maxHeight: '90vh',
    overflow: 'auto',
    zIndex: 1000,
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 999,
  }
};

const TextDisplay = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  const generatePosition = (index, totalItems) => {
    // Divide the screen into a grid and assign positions with some randomness
    const columns = Math.ceil(Math.sqrt(totalItems));
    const rows = Math.ceil(totalItems / columns);
    
    const column = index % columns;
    const row = Math.floor(index / columns);
    
    // Calculate base position
    const baseLeft = (column / columns) * 100; // Use 85% of screen width
    const baseTop = 10 + ((row / rows) * 70); // Use 70% of remaining screen height starting at 10%
    
    // Add randomness
    const randomLeft = baseLeft + (Math.random() * 15 - 7.5); // ±7.5%
    const randomTop = baseTop + (Math.random() * 15 - 7.5); // ±7.5%
    
    return {
      left: Math.max(0, Math.min(100, randomLeft)), // Ensure cards stay within bounds
      top: Math.max(10, Math.min(85, randomTop)), // Keep between 25% and 85% of screen height
      rotation: Math.random() * 16 - 20, // Random rotation between -20 and 20 degrees
      zIndex: Math.floor(Math.random() * 10),
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:3030/api/random?n=10', {
          method: "GET",
          credentials: "include"
        });
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        const totalItems = data.items.length;
        setItems(data.items.map((item, index) => ({
          ...item,
          position: generatePosition(index, totalItems)
        })));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div style={styles.error}>Error: {error}</div>;
  }

  return (
    <div style={styles.container}>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            ...styles.card,
            left: `${item.position.left}%`,
            top: `${item.position.top}%`,
            transform: `rotate(${item.position.rotation}deg)`,
            zIndex: hoveredId === item.id ? 100 : item.position.zIndex,
            ...(hoveredId === item.id && styles.cardHover),
          }}
          onMouseEnter={() => setHoveredId(item.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <div style={styles.text}>
            {truncateText(item.document)}
            <button 
              style={styles.showMoreButton}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedItem(item);
              }}
            >
              Show More
            </button>
          </div>
          <div style={styles.metadata}>
            <div>Title: {item.metadata.title}</div>
            <div>Time: {new Date(item.metadata.timestamp).toLocaleString()}</div>
            {item.metadata.source_url && (
              <div>Source: {item.metadata.source_url}</div>
            )}
          </div>
        </div>
      ))}

      {expandedItem && (
        <>
          <div style={styles.overlay} onClick={() => setExpandedItem(null)} />
          <div style={styles.expandedView}>
            <div style={styles.text}>{expandedItem.document}</div>
            <div style={styles.metadata}>
              <div>Title: {expandedItem.metadata.title}</div>
              <div>Time: {new Date(expandedItem.metadata.timestamp).toLocaleString()}</div>
              {expandedItem.metadata.source_url && (
                <div>Source: {expandedItem.metadata.source_url}</div>
              )}
            </div>
            <button 
              style={styles.showMoreButton}
              onClick={() => setExpandedItem(null)}
            >
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default TextDisplay;