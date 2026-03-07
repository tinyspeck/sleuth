import React, { useCallback } from 'react';
import { SleuthState } from '../state/sleuth';
import { getWindowTitle } from '../../utils/get-window-title';

interface TitlebarProps {
  state: SleuthState;
}

export const MacTitlebar: React.FC<TitlebarProps> = ({ state }) => {
  const handleDoubleClick = useCallback(() => {
    window.Sleuth.sendDoubleClick();
  }, []);

  return (
    <div className="MacTitlebar" onDoubleClick={handleDoubleClick}>
      <span>{getWindowTitle(state.source)}</span>
    </div>
  );
};
