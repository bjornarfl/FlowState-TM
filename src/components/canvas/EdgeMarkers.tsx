import React from 'react';

export default function EdgeMarkers(): React.JSX.Element {
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
      <defs>
        {/* Arrow marker for unidirectional edges */}
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="#666" />
        </marker>
        {/* Arrow marker for bidirectional edges (start) */}
        <marker
          id="arrowhead-start"
          markerWidth="6"
          markerHeight="6"
          refX="1"
          refY="3"
          orient="auto"
        >
          <polygon points="6 0, 0 3, 6 6" fill="#666" />
        </marker>
        {/* Arrow marker for bidirectional edges (end) */}
        <marker
          id="arrowhead-end"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 6 3, 0 6" fill="#666" />
        </marker>
      </defs>
    </svg>
  );
}
