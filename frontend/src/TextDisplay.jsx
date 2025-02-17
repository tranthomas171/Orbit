import React, { useState, useEffect, useRef } from 'react';
import useTextDisplayData from './useTextDisplayData';
import DraggableCard from './DraggableCard';
import { X } from 'lucide-react';

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    padding: '20px',
    overflowY: 'auto',
    backgroundColor: 'rgba(0,0,0,0)',
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '8px',
    padding: '8px',
    width: '100%',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  card: {
    position: 'relative',
    aspectRatio: '1',
    borderRadius: '0',
    padding: '0',
    overflow: 'hidden',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: 'transparent',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  textContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
    color: 'white',
    fontSize: '14px',
    lineHeight: '1.4',
  },
  loading: {
    padding: '16px',
    color: '#ffffff',
    textAlign: 'center',
  },
  modal: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
    zIndex: 2000,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1999,
  },
};

const TextDisplay = ({ initialItems = [], isSearchMode = false }) => {
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const observerRef = useRef();
  const loadingRef = useRef(null);

  const { 
    items, 
    page, 
    totalCount, 
    loading, 
    error, 
    fetchPage 
  } = useTextDisplayData(1, 20);

  const displayItems = isSearchMode ? initialItems : items;

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedItem(null);
  };

  const renderContent = (item) => {
    const isImage = item.type === 'image' || (item.metadata && item.metadata.type === 'image');
    
    return (
      <div style={styles.imageContainer}>
        {isImage ? (
          <img 
            src={item.data || '/api/placeholder/400/400'} 
            alt={item.metadata?.title || 'Image'} 
            style={styles.image}
          />
        ) : (
          <div style={{
            ...styles.image,
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}>
            <span style={{ fontSize: '14px', color: '#333' }}>
              {(item.document || '').substring(0, 100)}...
            </span>
          </div>
        )}
        <div style={styles.textContent}>
          {item.metadata?.title && (
            <div style={{ fontWeight: '500', marginBottom: '4px' }}>
              {item.metadata.title}
            </div>
          )}
          {item.metadata?.timestamp && (
            <div style={{ fontSize: '12px', opacity: '0.8' }}>
              {new Date(item.metadata.timestamp).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading && items.length < totalCount) {
          fetchPage(page + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (loadingRef.current) {
      observer.observe(loadingRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, items.length, totalCount, page, fetchPage]);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  return (
    <div style={styles.container}>
      <div style={styles.gridContainer}>
        {displayItems.map((item, index) => (
          <div 
            key={item.id || index}
            style={styles.card}
            onClick={() => handleItemClick(item)}
          >
            {renderContent(item)}
          </div>
        ))}
      </div>

      {!isSearchMode && (
        <div ref={loadingRef} style={styles.loading}>
          {loading ? 'Loading more items...' : ''}
        </div>
      )}

      {showModal && selectedItem && (
        <>
          <div style={styles.modalOverlay} onClick={closeModal} />
          <div style={styles.modal}>
            <div style={{ padding: '20px' }}>
              {selectedItem.type === 'image' ? (
                <img 
                  src={selectedItem.data} 
                  alt={selectedItem.metadata?.title || 'Image'}
                  style={{ width: '100%', borderRadius: '8px' }}
                />
              ) : (
                <div style={{ color: '#333' }}>{selectedItem.document}</div>
              )}
              {selectedItem.metadata?.timestamp && (
                <div style={{ marginTop: '16px', fontSize: '14px', color: '#666' }}>
                  {new Date(selectedItem.metadata.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TextDisplay;
