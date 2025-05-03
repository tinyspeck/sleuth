import React from 'react';
import { SleuthState } from '../state/sleuth';
import { getWindowTitle } from '../../utils/get-window-title';

interface TitlebarProps {
  state: SleuthState;
}

export class MacTitlebar extends React.Component<TitlebarProps> {
  constructor(props: TitlebarProps) {
    super(props);
  }

  private handleDoubleClick = () => {
    window.Sleuth.sendDoubleClick();
  };

  render() {
    const { source } = this.props.state;
    return (
      <div className="MacTitlebar" onDoubleClick={this.handleDoubleClick}>
        <span>{getWindowTitle(source)}</span>
      </div>
    );
  }
}
