import React from 'react';
import { SleuthState } from '../state/sleuth';
import { getWindowTitle } from '../../utils/get-window-title';

interface TitlebarProps {
  state: SleuthState;
}

export const MacTitlebar: React.FC<TitlebarProps> = ({ state }) => {
  function handleDoubleClick() {
    window.Sleuth.sendDoubleClick();
  }

  return (
    <div className="MacTitlebar" onDoubleClick={handleDoubleClick}>
      <span>{getWindowTitle(state.source)}</span>
    </div>
  );
};
