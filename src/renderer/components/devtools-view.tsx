import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react';

import { Empty } from 'antd';
import { SleuthState } from '../state/sleuth';
import { UnzippedFile } from '../../interfaces';
import { TraceProcessor } from '../processor/trace';
import debug from 'debug';

export interface DevtoolsViewProps {
  state: SleuthState;
  file: UnzippedFile;
}

const d = debug('sleuth:devtoolsview');

/**
 * Loads performance traces into an embedded DevTools iframe.
 * The iframe loads the frontend directly from https://chrome-devtools-frontend.appspot.com/
 *
 *
 * To update the Chromium version hash:
 * 1. Navigate to https://chromium.googlesource.com/chromium/src/+refs
 * 2. Click on a recent tag you want to check out
 * 3. Copy the `commit` hash
 */
export const DevtoolsView = observer((props: DevtoolsViewProps) => {
  const processorRef = useRef<TraceProcessor>(new TraceProcessor(props.file));
  const { selectedTracePid } = props.state;

  useEffect(() => {
    const messageHandler = async (event: MessageEvent) => {
      try {
        const iframe = document.querySelector('iframe');
        const events =
          await processorRef.current.getRendererProfile(selectedTracePid);
        d(
          `Loaded ${events.length} events for renderer profile with pid: ${selectedTracePid}`,
        );

        if (!iframe?.contentWindow || event.source !== iframe.contentWindow) {
          return;
        }
        if (event.data && event.data.type === 'REHYDRATING_IFRAME_READY') {
          d('Received REHYDRATING_IFRAME_READY event from DevTools');
          iframe.contentWindow.postMessage(
            {
              type: 'REHYDRATING_TRACE_FILE',
              traceJson: JSON.stringify({
                traceEvents: events,
              }),
            },
            '*',
          );
        }
      } catch (error) {
        console.error(
          `Failed to load renderer profile for PID ${selectedTracePid}:`,
          error,
        );
      }
    };

    if (selectedTracePid) {
      window.addEventListener('message', messageHandler, { once: true });
    }

    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [selectedTracePid]);

  if (!selectedTracePid) {
    return (
      <Empty
        description="Select a process from the sidebar to view its trace"
        style={{ marginTop: 64 }}
      />
    );
  }

  return (
    <div className="Devtools">
      <iframe
        key={selectedTracePid}
        title="DevTools embed"
        src={
          'https://chrome-devtools-frontend.appspot.com/serve_file/@c545657f5084b79e2aa3ea4074ae232ce328ff2d/trace_app.html?panel=timeline'
        }
        frameBorder={0}
      />
    </div>
  );
});
