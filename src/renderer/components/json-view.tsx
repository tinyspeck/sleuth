import React from 'react';
import { observer } from 'mobx-react';
import JSONTree from 'react-json-tree';

import { SleuthState } from '../state/sleuth';
import { getTheme } from './theme';
import { parseJSON } from '../../utils/parse-json';

export interface JSONViewProps {
  state: SleuthState;
  raw?: string;
  data?: unknown;
}

export interface JSONViewState {
  data?: unknown;
}

@observer
export class JSONView extends React.Component<JSONViewProps, JSONViewState> {
  public render() {
    const data = this.props.data || parseJSON(this.props.raw || '');
    const isDarkMode = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;

    if (data && Object.keys(data).length > 0) {
      const theme = getTheme(isDarkMode);

      return (
        <div className="Monospace">
          <JSONTree
            invertTheme={isDarkMode}
            data={data}
            theme={theme}
            hideRoot={true}
            shouldExpandNode={() => true}
          />
        </div>
      );
    } else if (this.props.raw) {
      return (
        <div className="Monospace">
          <code>{this.props.raw}</code>
        </div>
      );
    } else {
      return <p>This file is empty and contains no data.</p>;
    }
  }
}
