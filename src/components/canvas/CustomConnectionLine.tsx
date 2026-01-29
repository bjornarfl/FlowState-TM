import React from 'react';
import { Position, ConnectionLineComponentProps } from '@xyflow/react';

export default function CustomConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
}: ConnectionLineComponentProps): React.JSX.Element {
  // Calculate control points to ensure smooth bezier curves
  const CONTROL_OFFSET = 50;
  
  const getControlPoint = (
    x: number,
    y: number,
    position?: Position,
    distance: number = CONTROL_OFFSET
  ): { x: number; y: number } => {
    switch (position) {
      case Position.Top:
        return { x, y: y - distance };
      case Position.Bottom:
        return { x, y: y + distance };
      case Position.Left:
        return { x: x - distance, y };
      case Position.Right:
        return { x: x + distance, y };
      default:
        return { x, y };
    }
  };

  // Control points extend from the handles in their respective directions
  const fromControl = getControlPoint(fromX, fromY, fromPosition);
  const toControl = getControlPoint(toX, toY, toPosition);

  // Create cubic bezier path with proper control points
  const path = `M ${fromX},${fromY} C ${fromControl.x},${fromControl.y} ${toControl.x},${toControl.y} ${toX},${toY}`;

  return (
    <g>
      <path
        fill="none"
        stroke="#666"
        strokeWidth={2}
        strokeDasharray="5,5"
        d={path}
      />
      <circle cx={toX} cy={toY} fill="#fff" r={3} stroke="#666" strokeWidth={1.5} />
    </g>
  );
}
