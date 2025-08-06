import debug from 'debug';
import { TRACE_VIEWER } from '../components/preferences/preferences-utils';

const d = debug('sleuth:perfetto-service');

// Latest version of the Perfetto UI
export const PERFETTO_UI_URL = 'https://ui.perfetto.dev';

/**
 * Format types for traces
 */
export type TraceFormat =
  | typeof TRACE_VIEWER.CHROME
  | typeof TRACE_VIEWER.PERFETTO;

// Constants for trace formats
export const TraceFormat = {
  CHROME: TRACE_VIEWER.CHROME,
  PERFETTO: TRACE_VIEWER.PERFETTO,
} as const;

/**
 * Detects the trace format from a string content
 */
export function detectTraceFormat(traceContent: string): TraceFormat {
  try {
    const json = JSON.parse(traceContent);

    // If it has traceEvents, it's likely a Chrome trace
    if (json.traceEvents) {
      return TraceFormat.CHROME;
    }

    // If it has packets or events, likely a Perfetto trace
    if (json.packets || json.events) {
      return TraceFormat.PERFETTO;
    }

    // Default to Chrome format
    return TraceFormat.CHROME;
  } catch (error) {
    // If it's not valid JSON, assume it's a binary Perfetto trace
    return TraceFormat.PERFETTO;
  }
}

/**
 * Converts Chrome trace format to Perfetto format if needed
 *
 * @param traceContent The trace content
 * @returns The trace content in Perfetto format
 */
export function ensurePerfettoFormat(traceContent: string): string {
  const format = detectTraceFormat(traceContent);

  if (format === TraceFormat.CHROME) {
    return convertChromeTraceToPerfetto(traceContent);
  }

  return traceContent;
}

/**
 * Converts a Chrome trace to Perfetto format
 *
 * @param chromeTrace The Chrome trace content
 * @returns A Perfetto-compatible trace
 */
export function convertChromeTraceToPerfetto(chromeTrace: string): string {
  try {
    const trace = JSON.parse(chromeTrace);

    // Perfetto supports Chrome JSON format directly
    // Just ensure required fields are present
    const perfettoTrace = {
      // Keep original trace events or initialize empty array
      traceEvents: trace.traceEvents || [],

      // Add metadata required by Perfetto
      metadata: trace.metadata || {
        // Add version info expected by Perfetto
        'perfetto-ui-metadata': {
          source: 'Sleuth Chrome Trace',
        },
      },

      // Preserve any other fields from the original trace
      ...Object.entries(trace)
        .filter(([key]) => !['traceEvents', 'metadata'].includes(key))
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
    };

    return JSON.stringify(perfettoTrace);
  } catch (error) {
    d('Failed to convert Chrome trace to Perfetto format', error);
    throw new Error(`Failed to convert trace: ${error}`);
  }
}

/**
 * Opens a trace in the Perfetto UI
 *
 * @param iframe The iframe reference to the Perfetto UI
 * @param traceData The trace data to load
 * @returns Promise that resolves when the trace is loaded or rejects on error
 */
export function openTraceInPerfetto(
  iframe: HTMLIFrameElement,
  traceData: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      d('Preparing to send trace to Perfetto UI');

      // Create a file from the trace data with a proper name
      const file = new File([traceData], 'sleuth-trace.json', {
        type: 'application/json',
      });

      // Listen for messages from the iframe
      const messageHandler = (event: MessageEvent) => {
        d('Message from Perfetto UI:', event.data);

        if (event.data && event.data.perfetto) {
          if (event.data.perfetto.method === 'traceLoaded') {
            d('Perfetto UI has loaded the trace successfully');
            window.removeEventListener('message', messageHandler);
            resolve();
          } else if (event.data.perfetto.method === 'error') {
            d('Perfetto UI reported an error:', event.data.perfetto);
            window.removeEventListener('message', messageHandler);
            reject(
              new Error(event.data.perfetto.message || 'Failed to load trace'),
            );
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Wait for the UI to initialize before sending the trace
      setTimeout(() => {
        // Post the trace file to the Perfetto UI iframe
        iframe.contentWindow?.postMessage(
          {
            perfetto: {
              method: 'importTraceFromFile',
              data: file,
            },
          },
          '*',
        );

        d('Sent trace file to Perfetto UI');
      }, 1000); // Give the iframe a second to load properly
    } catch (error) {
      d('Error in openTraceInPerfetto:', error);
      reject(error);
    }
  });
}
