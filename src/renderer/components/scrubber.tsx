import React, { useState, useCallback } from 'react';

export interface ScrubberProps {
  onResizeHandler: (newHeight: number) => void;
  elementSelector: string;
}

export interface ScrubberState {
  startY: number;
  startHeight: number;
}

export const Scrubber: React.FC<ScrubberProps> = ({
  onResizeHandler,
  elementSelector,
}) => {
  const [resizeState, setResizeState] = useState<Partial<ScrubberState>>({});

  const mouseMoveHandler = useCallback(
    (e: MouseEvent) => {
      const { startHeight, startY } = resizeState;
      if (startHeight !== undefined && startY !== undefined) {
        const newHeight = startHeight + e.clientY - startY;
        onResizeHandler(newHeight);
      }
    },
    [resizeState, onResizeHandler],
  );

  const mouseUpHandler = useCallback(() => {
    document.removeEventListener('mousemove', mouseMoveHandler, false);
    document.removeEventListener('mouseup', mouseUpHandler, false);
  }, [mouseMoveHandler]);

  const mouseDownHandler = useCallback(
    (e: React.MouseEvent) => {
      const resizeTarget = document.getElementById(elementSelector);

      if (!resizeTarget) return;

      const startY = e.clientY;
      const startHeight = parseInt(
        window.getComputedStyle(resizeTarget).height,
        10,
      );

      setResizeState({ startY, startHeight });

      document.addEventListener('mousemove', mouseMoveHandler, false);
      document.addEventListener('mouseup', mouseUpHandler, false);
    },
    [elementSelector, mouseMoveHandler, mouseUpHandler],
  );

  return <div className="Scrubber" onMouseDown={mouseDownHandler} />;
};
