import React, { useState, useEffect, useCallback, useRef } from 'react';

const defaultStyles = {
  card: {
    position: 'absolute', // Changed back to absolute
    width: '300px',
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0',
    cursor: 'pointer',
  },
  metadata: {
    fontSize: '12px',
    color: '#666666',
    marginTop: '6px',
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    paddingBottom: '56.25%',
    marginBottom: '8px',
  },
  videoIframe: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: '4px',
    border: 'none',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'transparent',
    cursor: 'grabbing',
    zIndex: 1,
  }
};

const extractYoutubeId = (url) => {
  try {
    let regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    let match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  } catch {
    return null;
  }
};

const DraggableCard = ({
  item,
  initialPosition,
  renderContent,
  onClick,
  onMouseEnter,
  onMouseLeave,
  metadata,
  cardStyle = {},
}) => {
  const cardRef = useRef(null);
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [youtubeId, setYoutubeId] = useState(null);

  useEffect(() => {
    if (metadata?.type === 'youtube_video' || 
        (typeof item.document === 'string' && item.document.includes('youtube.com'))) {
      const urlToCheck = metadata?.youtube_url || item.document;
      const videoId = extractYoutubeId(urlToCheck);
      if (videoId) {
        setYoutubeId(videoId);
      }
    }
  }, [item, metadata]);

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const rect = cardRef.current.getBoundingClientRect();
    setDragStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setDragging(true);
  }, []);
  
  const handleMouseMove = useCallback((e) => {
    if (!dragging) return;
  
    // Get the container dimensions (assuming cardRef.current.parentElement exists)
    const containerRect = cardRef.current.parentElement.getBoundingClientRect();
    
    const newLeft = ((e.clientX - dragStart.x) - containerRect.left) / containerRect.width * 100;
    const newTop = ((e.clientY - dragStart.y) - containerRect.top) / containerRect.height * 100;
    
    setPosition({
      left: Math.max(0, Math.min(95, newLeft)),
      top: Math.max(0, Math.min(90, newTop))
    });
  }, [dragging, dragStart]);
  

  const handleMouseUp = useCallback((e) => {
    if (dragging) {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
    }
  }, [dragging]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mouseleave', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  const renderYoutubeEmbed = () => {
    if (!youtubeId) return null;
    
    return (
      <div style={defaultStyles.videoContainer}>
        <iframe
          style={defaultStyles.videoIframe}
          src={`https://www.youtube.com/embed/${youtubeId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        {dragging && <div style={defaultStyles.overlay} />}
      </div>
    );
  };

  const handleClick = (e) => {
    if (dragging) {
      e.stopPropagation();
      return;
    }
    onClick?.(e);
  };

  return (
    <div
      ref={cardRef}
      style={{
        ...defaultStyles.card,
        ...cardStyle,
        left: `${position.left}%`,
        top: `${position.top}%`,
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: dragging ? 1000 : initialPosition.zIndex,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {youtubeId ? renderYoutubeEmbed() : renderContent(item)}
      <div style={defaultStyles.metadata}>
        {metadata?.timestamp && (
          <div>Time: {new Date(metadata.timestamp).toLocaleString()}</div>
        )}
        {metadata?.source_url && (
          <div>Source: {metadata.source_url}</div>
        )}
      </div>
    </div>
  );
};

export default DraggableCard;