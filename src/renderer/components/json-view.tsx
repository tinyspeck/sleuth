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
  const { state, raw, data: propsData } = props;
  const data = propsData || parseJSON(raw || '');
  const isDarkMode = state.prefersDarkColors;

  if (data && Object.keys(data as object).length > 0) {
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
  } else if (raw) {
    return (
      <div className="Monospace">
        <code>{raw}</code>
      </div>
    );
  } else {
    return <p>This file is empty and contains no data.</p>;
  }
});
