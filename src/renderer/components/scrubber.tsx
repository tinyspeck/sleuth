import React, { useCallback, useRef } from 'react';

export interface ScrubberProps {
  onResizeHandler: (newHeight: number) => void;
  elementSelector: string;
}

export const Scrubber: React.FC<ScrubberProps> = ({
  onResizeHandler,
  elementSelector,
}) => {
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const mouseMoveHandler = useCallback(
    (e: MouseEvent) => {
      const newHeight = startHeightRef.current + e.clientY - startYRef.current;
      onResizeHandler(newHeight);
    },
    [onResizeHandler],
  );

  const mouseUpHandler = useCallback(() => {
    document.removeEventListener('mousemove', mouseMoveHandler, false);
    document.removeEventListener('mouseup', mouseUpHandler, false);
  }, [mouseMoveHandler]);

  const mouseDownHandler = useCallback(
    (e: React.MouseEvent) => {
      const resizeTarget = document.getElementById(elementSelector);

      if (!resizeTarget) return;

      startYRef.current = e.clientY;
      startHeightRef.current = parseInt(
        window.getComputedStyle(resizeTarget).height,
        10,
      );

      document.addEventListener('mousemove', mouseMoveHandler, false);
      document.addEventListener('mouseup', mouseUpHandler, false);
    },
    [elementSelector, mouseMoveHandler, mouseUpHandler],
  );

  return <div className="Scrubber" onMouseDown={mouseDownHandler} />;
};
