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
  const onResizeRef = useRef(onResizeHandler);
  onResizeRef.current = onResizeHandler;

  const mouseDownHandler = useCallback(
    (e: React.MouseEvent) => {
      const resizeTarget = document.getElementById(elementSelector);

      if (!resizeTarget) return;

      startYRef.current = e.clientY;
      startHeightRef.current = parseInt(
        window.getComputedStyle(resizeTarget).height,
        10,
      );

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const newHeight =
          startHeightRef.current + moveEvent.clientY - startYRef.current;
        onResizeRef.current(newHeight);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove, false);
        document.removeEventListener('mouseup', handleMouseUp, false);
      };

      document.addEventListener('mousemove', handleMouseMove, false);
      document.addEventListener('mouseup', handleMouseUp, false);
    },
    [elementSelector],
  );

  return <div className="Scrubber" onMouseDown={mouseDownHandler} />;
};
