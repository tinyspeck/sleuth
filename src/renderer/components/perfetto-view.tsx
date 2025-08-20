import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import { SleuthState } from '../state/sleuth';
import { UnzippedFile } from '../../interfaces';

import debug from 'debug';

const d = debug('sleuth:perfetto-view');

export interface PerfettoViewProps {
  state: SleuthState;
  file: UnzippedFile;
}

/**
 * Sleuth's Perfetto View embeds ui.perfetto.dev into an iframe.
 * Trace values are sent via cross-origin postMessage.
 *
 * @see https://perfetto.dev/docs/visualization/deep-linking-to-perfetto-ui
 */
export const PerfettoView = observer(({ state, file }: PerfettoViewProps) => {
  const perfettoRef = useRef<HTMLIFrameElement>(null);
  const controllerRef = useRef<AbortController>(new AbortController());

  const PERFETTO_UI_URL = 'https://ui.perfetto.dev';
  // mode=embedded tells Perfetto this is an embedded instance
  const perfettoUrl = `${PERFETTO_UI_URL}?mode=embedded`;

  useEffect(() => {
    d('adding postMessage listener');
    async function messageListener(event: MessageEvent) {
      if (event.data === 'PONG' && event.origin === PERFETTO_UI_URL) {
        d(
          `Received PONG from Perfetto. UI is loaded, so loading trace data from ${file.fullPath} to ArrayBuffer.`,
        );
        controllerRef.current.abort();
        const data = await window.Sleuth.readAnyFile(file);
        const arr = new TextEncoder().encode(data);
        const buffer = arr.buffer;
        d(
          `Loaded trace data with ${buffer.byteLength} bytes to ArrayBuffer, sending back to Perfetto`,
        );
        perfettoRef.current?.contentWindow?.postMessage(buffer, '*');
      }
    }
    window.addEventListener('message', messageListener, {
      signal: controllerRef.current.signal,
    });
    return () => controllerRef.current.abort();
  }, []);

  useEffect(() => {
    if (perfettoRef.current?.contentWindow) {
      d(
        'iframe content window detected. Polling Perfetto every 100ms to check if UI is loaded.',
      );
      const interval = setInterval(() => {
        d('Sending PING to Perfetto to check if UI is loaded.');
        perfettoRef.current?.contentWindow?.postMessage('PING', '*');
      }, 100);
      controllerRef.current.signal.addEventListener('abort', () => {
        clearInterval(interval);
      });
    }
  }, [controllerRef, perfettoRef]);

  return (
    <div className="PerfettoView">
      <iframe
        ref={perfettoRef}
        title="Perfetto UI"
        src={perfettoUrl}
        loading="lazy"
      />
    </div>
  );
});
