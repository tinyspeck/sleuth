import React, { useCallback } from 'react';
import { observer } from 'mobx-react';
import { SleuthState } from '../state/sleuth';
import { getWindowTitle } from '../../utils/get-window-title';

export interface TitlebarProps {
  state: SleuthState;
}

export const MacTitlebar = observer((props: TitlebarProps) => {
  const handleDoubleClick = useCallback(() => {
    window.Sleuth.sendDoubleClick();
  }, []);

  const { source } = props.state;
  return (
    <div className="MacTitlebar" onDoubleClick={handleDoubleClick}>
      <span>{getWindowTitle(source)}</span>
    </div>
  );
});
