import { observer } from 'mobx-react';
import { SleuthState } from '../state/sleuth';
import React from 'react';
import {
  Alignment,
  Button,
  ButtonGroup,
  Divider,
  Navbar,
  NavbarGroup,
} from '@blueprintjs/core';

import { Filter } from './app-core-header-filter';
import { Bookmarks } from './app-core-header-bookmarks';

export interface AppCoreHeaderProps {
  state: SleuthState;
}

@observer
export class AppCoreHeader extends React.Component<AppCoreHeaderProps, object> {
  public render() {
    const {
      isSidebarOpen,
      isSpotlightOpen,
      toggleSidebar,
      toggleSpotlight,
      reset,
    } = this.props.state;
    const sidebarIcon = isSidebarOpen ? 'menu-closed' : 'menu-open';

    return (
      <Navbar className="AppHeader">
        <NavbarGroup align={Alignment.LEFT}>
          <ButtonGroup>
            <Button onClick={() => reset(true)} icon="home" />
            <Button
              active={!isSidebarOpen}
              onClick={toggleSidebar}
              icon={sidebarIcon}
            />
            <Bookmarks state={this.props.state} />
            <Button
              active={isSpotlightOpen}
              onClick={toggleSpotlight}
              icon="geosearch"
            />
          </ButtonGroup>
        </NavbarGroup>
        <Divider />
        <Filter state={this.props.state} />
      </Navbar>
    );
  }
}
