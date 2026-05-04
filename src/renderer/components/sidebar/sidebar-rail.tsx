import React from 'react';
import { observer } from 'mobx-react';
import { Button, Divider, Flex, Tooltip } from 'antd';
import { HomeOutlined, SettingOutlined } from '@ant-design/icons';
import { SleuthState } from '../../state/sleuth';
import { SidebarBookmarks } from './sidebar-bookmarks';

interface SidebarRailProps {
  state: SleuthState;
}

const SidebarRail = observer((props: SidebarRailProps) => {
  return (
    <Flex className="SidebarRail" vertical align="center">
      <Tooltip title="Return Home" placement="right">
        <Button
          icon={<HomeOutlined />}
          onClick={() => props.state.reset(true)}
        />
      </Tooltip>
      <SidebarBookmarks state={props.state} />
      <Divider size="small" />
      <div style={{ flex: 1 }} />
      <Tooltip title="Preferences (⌘,)" placement="right">
        <Button
          style={{ marginBottom: 4 }}
          icon={<SettingOutlined />}
          onClick={() => props.state.showPreferences()}
        />
      </Tooltip>
    </Flex>
  );
});

export { SidebarRail };
