import React, { useState, useEffect } from 'react';

// Define some default styles for the card and metadata.
// You can override these by passing a "cardStyle" prop if needed.
const defaultStyles = {
  card: {
    position: 'absolute',
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
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // When the user presses down, start dragging and record the offset.
  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // While dragging, update the position.
  const handleMouseMove = (e) => {
    if (!dragging) return;
    const newLeft = ((e.clientX - dragOffset.x) / window.innerWidth) * 100;
    const newTop = ((e.clientY - dragOffset.y) / window.innerHeight) * 100;
    setPosition({ ...position, left: newLeft, top: newTop });
  };

  // When the mouse is released, stop dragging.
  const handleMouseUp = () => {
    setDragging(false);
  };

  // Attach event listeners when dragging starts.
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragOffset, position]);

  return (
    <div
      style={{
        ...defaultStyles.card,
        ...cardStyle,
        left: `${position.left}%`,
        top: `${position.top}%`,
      }}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {renderContent(item)}
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
