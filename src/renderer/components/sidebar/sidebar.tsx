import React from 'react';
import { observer } from 'mobx-react';

import { SleuthState } from '../../state/sleuth';
import { Button, Flex } from 'antd';

import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { SidebarFileTree } from './sidebar-file-tree';
import { SidebarRail } from './sidebar-rail';

interface SidebarProps {
  state: SleuthState;
}

const Sidebar = observer((props: SidebarProps) => {
  const { isSidebarOpen } = props.state;

  return (
    <Flex vertical>
      <Flex className="SidebarWrapper" flex={1}>
        <SidebarRail state={props.state} />
        <SidebarFileTree state={props.state} />
      </Flex>
      <Button
        className="SidebarTreeToggle"
        onClick={props.state.toggleSidebar}
        variant="filled"
      >
        {isSidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
      </Button>
    </Flex>
  );
});

export { Sidebar };
