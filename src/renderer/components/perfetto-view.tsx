import React from 'react';
import { observer } from 'mobx-react';
import { SleuthState } from '../state/sleuth';
import { UnzippedFile } from '../../interfaces';

// Latest version of the Perfetto UI
const PERFETTO_UI_URL = 'https://ui.perfetto.dev';

export interface PerfettoViewProps {
  state: SleuthState;
  file: UnzippedFile;
}

/**
 * A component that embeds the Perfetto UI in an iframe
 */
export const PerfettoView = observer(({ state, file }: PerfettoViewProps) => {
  // URL parameters for Perfetto UI
  // embedding=true tells Perfetto this is an embedded instance
  // theme=light forces light mode regardless of system preferences
  // note that dark mode looks very not good
  const perfettoUrl = `${PERFETTO_UI_URL}?embedding=true&theme=light`;

  return (
    <div className="PerfettoView">
      <iframe
        title="Perfetto UI"
        src={perfettoUrl}
        style={{ width: '100%', height: '100%' }}
        sandbox="allow-scripts allow-same-origin allow-forms"
        allow="clipboard-write"
        loading="lazy"
      />
    </div>
  );
});
