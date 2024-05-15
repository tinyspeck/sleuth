import fs from 'fs-extra';
import debug from 'debug';

import type { UnzippedFile } from '../../interfaces';
import type {
  ChromiumTrace,
  ChromiumTraceEvent,
  ThreadNameEvent,
  BrowserThread,
  RendererThread,
  ThreadInfo,
} from './interfaces';

const d = debug('sleuth:trace-processor');
export interface TraceThreadDescription {
  title?: string;
  type: 'browser' | 'renderer';
  isClient: boolean;
  processId: number;
}

function getProcessLabel(
  processLabelEvents: ChromiumTraceEvent[],
  pid: number,
) {
  const processLabel = processLabelEvents.find((label) => label.pid === pid);
  return processLabel ? processLabel.args?.labels : '';
}

export class TraceProcessor {
  file: UnzippedFile;
  tracePromise: Promise<ChromiumTrace | undefined>;

  constructor(file: UnzippedFile) {
    this.file = file;
    this.tracePromise = this.getTrace();
  }

  async getTrace(): Promise<ChromiumTrace | undefined> {
    try {
      const raw = fs.readFileSync(this.file.fullPath, 'utf8');
      const json = JSON.parse(raw);
      if (json.traceEvents) {
        return json;
      }
    } catch (e) {
      d('Unable to parse trace', e);
    }
    return undefined;
  }

  private async getBrowserThread(
    threads: Array<ThreadNameEvent>,
  ): Promise<BrowserThread | undefined> {
    for (const thread of threads) {
      if (thread.args?.name === 'CrBrowserMain') {
        return {
          pid: thread.pid,
          tid: thread.tid,
          ts: await this.getEarliestTimestamp(),
        };
      }
    }
    return;
  }

  private async getRendererThreads(
    events: Array<ChromiumTraceEvent>,
    threads: Array<ThreadNameEvent>,
  ) {
    const discovered: { [processId: number]: RendererThread } = {};
    // Search (sometimes missing) ParseHTML events
    const parseEvents = events.filter((e) => e.name === 'ParseHTML');
    const clientParseEvent = parseEvents.find(
      (event) =>
        event?.args?.beginData?.url?.startsWith?.(
          'https://app.slack.com/client',
        ),
    );
    // Search any renderer event
    const rendererThreadsEvents = threads.filter(
      (thread) => thread?.args?.name === 'CrRendererMain',
    );
    // Get process labels to help determine if a thread is a client
    const labelEvents = events.filter((e) => e.name === 'process_labels');

    if (clientParseEvent) {
      const url = clientParseEvent.args.beginData.url;
      d(`Discovered renderer thread via ParseHTML event: ${url}`);
      const processId = clientParseEvent.pid;
      const title = getProcessLabel(labelEvents, processId);
      if (!discovered[processId]) {
        discovered[processId] = {
          data: {
            frame: clientParseEvent.args.beginData.frame,
            url,
            processId,
          },
          isClient: true,
          title,
        };
      }
    }

    rendererThreadsEvents.forEach((thread) => {
      const title = getProcessLabel(labelEvents, thread.pid);
      d(`Discovered renderer thread via thread event: ${title}`);
      const isClient = title.startsWith('Slack |');
      const processId = thread.pid;
      if (!discovered[processId]) {
        discovered[processId] = {
          data: {
            frame: '',
            url: `https://slack.com/unknown?name=${encodeURI(title)}`,
            processId: thread.pid,
          },
          title,
          isClient,
        };
      }
    });

    return Object.values(discovered);
  }

  private async getThreadInfo(): Promise<ThreadInfo> {
    const trace = await this.tracePromise;
    if (trace) {
      const { traceEvents: events } = trace;
      const threads = events.filter(
        ({ name }) => name === 'thread_name',
      ) as Array<ThreadNameEvent>;
      const browser = await this.getBrowserThread(threads);
      const renderers = await this.getRendererThreads(events, threads);
      console.trace(`***getThreadInfo`, ({ browser, renderers }));
      return { browser, renderers };
    }
    return { renderers: [] };
  }

  private async getEarliestTimestamp() {
    const trace = await this.tracePromise;
    if (trace) {
      const { traceEvents: events } = trace;
      return events.reduce<number>((earliest, entry) => {
        const { ts, cat } = entry;

        // Blink events include the time that the app started. If a trace is
        // performed at a later time, it creates a skewed timeline with blank
        // space at the beginning.
        const isBlinkEvent = cat?.startsWith('blink');
        const isEarlier = ts > 0 && ts < earliest;

        return isEarlier && !isBlinkEvent ? ts : earliest;
      }, Number.MAX_SAFE_INTEGER);
    }
    return 0;
  }

  async getTraceEvents() {
    const trace = await this.tracePromise;
    return trace?.traceEvents;
  }

  async getProcesses(): Promise<
    Array<TraceThreadDescription> | undefined
  > {
    const { browser, renderers } = await this.getThreadInfo();
    const threads: Array<TraceThreadDescription> = [];
    if (browser) {
      threads.push({
        title: 'Main process',
        type: 'browser',
        isClient: false,
        processId: browser.pid
      });
    }
    for (const { data, isClient, title } of renderers) {
      threads.push({
        title,
        type: 'renderer',
        isClient,
        processId: data.processId,
      })
    }
    return threads;
  }

  async makeInitialEntry(
    pid?: number,
  ): Promise<ChromiumTraceEvent | undefined> {
    const { browser, renderers } = await this.getThreadInfo();
    const rendererThread = renderers.find(
      (thread) => thread.data.processId === pid,
    );

    return {
      args: {
        data: {
          persistentIds: true,
          frames: rendererThread ? [rendererThread.data] : [],
        },
      },
      cat: 'disabled-by-default-devtools.timeline',
      name: 'TracingStartedInBrowser',
      ph: 'I',
      ...browser,
    };
  }

  public async getRendererProfile(
    pid: number,
  ): Promise<Array<ChromiumTraceEvent>> {
    const initialEntry = await this.makeInitialEntry(pid);
    const events = await this.getTraceEvents();
    if (events) {
      return initialEntry ? [initialEntry, ...events] : events;
    }
    return [];
  }
}
