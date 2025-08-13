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
@observer
export class PerfettoView extends React.Component<PerfettoViewProps> {
  render() {
    // Use proper parameters to ensure the UI loads correctly
    // ?embedding=true tells Perfetto this is an embedded instance
    const perfettoUrl = `${PERFETTO_UI_URL}?embedding=true`;

    return (
      <div className="PerfettoView">
        <iframe
          title="Perfetto UI"
          src={perfettoUrl}
          style={{ width: '100%', height: '100%' }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          allow="clipboard-write"
        />
      </div>
    );
  }
}
