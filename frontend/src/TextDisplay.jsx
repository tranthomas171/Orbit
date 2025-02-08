import React, { useState, useEffect } from 'react';

const styles = {
  container: {
    padding: '20px',
    maxWidth: '800px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0',
  },
  text: {
    fontSize: '16px',
    lineHeight: '1.5',
    color: '#333333',
  },
  metadata: {
    fontSize: '14px',
    color: '#666666',
    marginTop: '8px',
  },
  error: {
    color: '#ff0000',
    padding: '16px',
  },
  loading: {
    padding: '16px',
    color: '#666666',
  }
  
};

const TextDisplay = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('http://localhost:3030/api/random?n=3', {method:"GET", credentials:"include"});
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setItems(data.items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div style={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div style={styles.error}>Error: {error}</div>;
  }

  return (
    <div style={styles.container}>
      {items.map((item) => (
        <div key={item.id} style={styles.card}>
          <div style={styles.text}>{item.document}</div>
          <div style={styles.metadata}>
            <div>Title: {item.metadata.title}</div>
            <div>Time: {new Date(item.metadata.timestamp).toLocaleString()}</div>
            {item.metadata.source_url && (
              <div>Source: {item.metadata.source_url}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TextDisplay;