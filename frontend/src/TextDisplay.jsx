import React, { useState, useEffect } from 'react';
import useTextDisplayData from './useTextDisplayData'; // Your custom hook
import DraggableCard from './DraggableCard'; // Import the draggable card

const styles = {
  container: {
    position: 'relative',
    width: '100vw',
    minHeight: '100vh',
    padding: '20px',
    overflowY: 'auto',
    backgroundColor: 'rgba(0,0,0,0)',
  },
  text: {
    fontSize: '14px',
    lineHeight: '1.4',
    color: '#333333',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 'auto',
    borderRadius: '4px',
    marginBottom: '8px',
  },
  loading: {
    padding: '16px',
    color: '#666666',
    textAlign: 'center',
  },
  loadMoreButton: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#2563eb',
    color: '#fff',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '16px',
    cursor: 'pointer',
    zIndex: 1100,
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
    marginTop: '-200px', // adjust as needed
    marginLeft: '-150px', // adjust as needed
    backgroundColor: 'rgba(255, 255, 255, 0)',
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
    zIndex: 999,
  },
};

const generatePosition = (index, totalItems) => {
  const columns = Math.ceil(Math.sqrt(totalItems));
  const rows = Math.ceil(totalItems / columns);
  
  const column = index % columns;
  const row = Math.floor(index / columns);
  
  const baseLeft = (column / columns) * 100;
  const baseTop = 10 + ((row / rows) * 70);
  
  return {
    left: Math.max(0, Math.min(100, baseLeft)),
    top: Math.max(10, Math.min(85, baseTop)),
    zIndex: Math.floor(Math.random() * 10),
  };
};

const TextDisplay = ({ initialItems = [], isSearchMode = false }) => {
  const { items, page, totalCount, loading, error, fetchPage } = useTextDisplayData(1, 5);
  const [expandedItem, setExpandedItem] = useState(null);

  // Use search results if in search mode, otherwise use regular items
  const displayItems = isSearchMode ? initialItems : items;

  const positionedItems = displayItems.map((item, idx) => {
    const pos = generatePosition(idx, displayItems.length);
    return { ...item, position: pos };
  });

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length <= maxLength ? text : text.slice(0, maxLength) + '...';
  };

  const renderContent = (item) => {
    if (item.type === 'image') {
      return (
        <img 
          src={item.data} 
          alt={item.metadata.title || 'Image'} 
          style={styles.image}
        />
      );
    }
    if (item.type === 'youtube_video') {
      return (
        <div style={styles.text}>
          <strong>YouTube:</strong> {truncateText(item.document, 150)}
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
      );
    }
    return (
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
    );
  };

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  
  return (
    <div style={styles.container}>
      {positionedItems.map((item) => (
        <DraggableCard
          key={item.id}
          item={item}
          initialPosition={item.position}
          renderContent={renderContent}
          metadata={item.metadata}
          onClick={() => setExpandedItem(item)}
          onMouseEnter={() => {}}
          onMouseLeave={() => {}}
        />
      ))}

      {!isSearchMode && loading && <div style={styles.loading}>Loading more items...</div>}
      {!isSearchMode && !loading && items.length < totalCount && (
        <button 
          style={styles.loadMoreButton}
          onClick={() => fetchPage(page + 1)}
        >
          Load More
        </button>
      )}

      {expandedItem && (
        <>
          <div style={styles.overlay} onClick={() => setExpandedItem(null)} />
          <div style={styles.expandedView}>
            {expandedItem.type === 'image' ? (
              <img 
                src={expandedItem.data} 
                alt={expandedItem.metadata.title || 'Image'} 
                style={styles.image}
              />
            ) : (
              <div style={styles.text}>{expandedItem.document}</div>
            )}
            <div style={styles.metadata}>
              <div>Time: {new Date(expandedItem.metadata.timestamp).toLocaleString()}</div>
              {expandedItem.metadata.source_url && (
                <div>Source: {expandedItem.metadata.source_url}</div>
              )}
            </div>
            <button 
              style={styles.loadMoreButton}
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
