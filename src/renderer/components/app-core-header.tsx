import { observer } from 'mobx-react';
import { SleuthState } from '../state/sleuth';
import React from 'react';
import { Navbar } from '@blueprintjs/core';

import { Filter } from './app-core-header-filter';

export interface AppCoreHeaderProps {
  state: SleuthState;
}

@observer
export class AppCoreHeader extends React.Component<AppCoreHeaderProps, object> {
  public render() {
    return (
      <Navbar className="AppHeader">
        <Filter state={this.props.state} />
      </Navbar>
    );
  }
}
