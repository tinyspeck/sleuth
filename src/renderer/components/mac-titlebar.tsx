import { RobotOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { observer } from 'mobx-react';
import React from 'react';

import { SleuthState } from '../state/sleuth';
import { getWindowTitle } from '../../utils/get-window-title';

interface TitlebarProps {
  state: SleuthState;
}

export const MacTitlebar: React.FC<TitlebarProps> = observer(({ state }) => {
  function handleDoubleClick() {
    window.Sleuth.sendDoubleClick();
  }

  return (
    <div className="MacTitlebar" onDoubleClick={handleDoubleClick}>
      <span>{getWindowTitle(state.source)}</span>
      {state.isAiAvailable && (
        <Tooltip title="AI Assistant (⌘L)" placement="bottomLeft">
          <Button
            className="MacTitlebar__AiButton"
            icon={<RobotOutlined />}
            onClick={() => state.toggleAiSidebar()}
            type={state.isAiSidebarOpen ? 'primary' : 'text'}
            size="small"
          />
        </Tooltip>
      )}
    </div>
  );
});
