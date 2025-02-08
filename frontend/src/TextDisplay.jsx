import React, { useState, useEffect } from 'react';
import useTextDisplayData from './useTextDisplayData';
import DraggableCard from './DraggableCard';
import { X } from 'lucide-react';

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
    marginLeft: '8px',
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
  modalHeader: {
    padding: '16px 24px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 500,
    color: '#111',
  },
  modalContent: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#333',
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
  closeButton: {
    background: 'none',
    border: 'none',
    padding: '4px',
    cursor: 'pointer',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'background-color 0.2s',
    ':hover': {
      backgroundColor: '#f3f4f6',
    },
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
  const [selectedItem, setSelectedItem] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const displayItems = isSearchMode ? initialItems : items;

  const positionedItems = displayItems.map((item, idx) => {
    const pos = generatePosition(idx, displayItems.length);
    return { ...item, position: pos };
  });

  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length <= maxLength ? text : text.slice(0, maxLength) + '...';
  };

  const handleShowMore = (e, item) => {
    e.stopPropagation();
    setSelectedItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedItem(null);
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
    return (
      <div style={styles.text}>
        {truncateText(item.document)}
        <button 
          style={styles.showMoreButton}
          onClick={(e) => handleShowMore(e, item)}
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

      {showModal && selectedItem && (
        <>
          <div style={styles.modalOverlay} onClick={closeModal} />
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div style={styles.modalTitle}>
                {selectedItem.metadata?.title || 'Content Details'}
              </div>
              <button style={styles.closeButton} onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            <div style={styles.modalContent}>
              {selectedItem.document}
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