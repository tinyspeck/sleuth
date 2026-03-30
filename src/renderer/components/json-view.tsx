import React from 'react';
import { observer } from 'mobx-react';
import { JSONTree } from 'react-json-tree';

import { SleuthState } from '../state/sleuth';
import { getTheme } from './theme';
import { parseJSON } from '../../utils/parse-json';

export interface JSONViewProps {
  state: SleuthState;
  raw?: string;
  data?: unknown;
}

export const JSONView = observer((props: JSONViewProps) => {
  const data = props.data || parseJSON(props.raw || '');
  const isDarkMode = props.state.prefersDarkColors;

  if (data && Object.keys(data).length > 0) {
    const theme = getTheme(isDarkMode);

    return (
      <div className="Monospace">
        <JSONTree
          invertTheme={!isDarkMode}
          data={data}
          theme={theme}
          hideRoot={true}
          shouldExpandNodeInitially={() => true}
        />
      </div>
    );
  } else if (props.raw) {
    return (
      <div className="Monospace">
        <code>{props.raw}</code>
      </div>
    );
  } else {
    return <p>This file is empty and contains no data.</p>;
  }
});
