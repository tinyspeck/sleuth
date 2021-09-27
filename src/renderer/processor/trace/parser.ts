const debug = require("debug")("sleuth:trace-parser");

export type ChromiumTraceEvent =
  | UnknownTraceEvent
  | TracingStartedInBrowserEvent
  | ThreadNameEvent;

interface TracingStartedInBrowserEvent {
  name: "TracingStartedInBrowser";
  [key: string]: any;
}
interface UnknownTraceEvent {
  ts: number;
  [key: string]: any;
}

interface ChromiumTrace {
  traceEvents: ChromiumTraceEvent[];
}

interface ThreadNameEvent {
  name: "thread_name";
  args?: {
    name?: string;
  };
  pid: number;
  tid: number;
  ts: number;
}

export interface RendererThread {
  data: {
    frame: string;
    url: string;
    processId: number;
  };
  isClient: boolean;
  title?: string;
}

export interface BrowserThread {
  pid: number,
  tid: number,
  ts: number;
}

interface ThreadInfo {
  browser?: BrowserThread;
  renderers: RendererThread[]
}

function getProcessLabel(processLabelEvents: any, pid: number) {
  const processLabel = processLabelEvents.find(
    (label: any) => label.pid === pid
  );
  return processLabel ? processLabel.args?.labels : "";
}

export class TraceParser {
  trace: ChromiumTrace;
  threadInfo: ThreadInfo;
  constructor(trace: ChromiumTrace) {
    this.trace = trace;
  }
  private getBrowserThread(threads: ThreadNameEvent[]): BrowserThread | undefined{
    for (const thread of threads) {
      if (thread.args?.name === "CrBrowserMain") {
        return {
          pid: thread.pid,
          tid: thread.tid,
          ts: this.getEarliestTimestamp(),
        };
      }
    }
    return;
  }

  private getRendererThreads(
    events: ChromiumTraceEvent[],
    threads: ThreadNameEvent[]
  ) {
    const discovered: { [processId: number]: RendererThread } = {};
    // Search (sometimes missing) ParseHTML events
    const parseEvents = events.filter((e) => e.name === "ParseHTML");
    const clientParseEvent = parseEvents.find((event) =>
      event?.args?.beginData?.url?.startsWith?.("https://app.slack.com/client")
    );
    // Search any renderer event
    const rendererThreadsEvents = threads.filter(
      (thread) => thread?.args?.name === "CrRendererMain"
    );
    // Get process labels to help determine if a thread is a client
    const labelEvents = events.filter((e) => e.name === "process_labels");

    if (clientParseEvent) {
      const url = clientParseEvent.args.beginData.url;
      debug(`Discovered renderer thread via ParseHTML event: ${url}`);
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
      debug(`Discovered renderer thread via thread event: ${title}`);
      const isClient = title.startsWith("Slack |");
      const processId = thread.pid;
      if (!discovered[processId]) {
        discovered[processId] = {
          data: {
            frame: "",
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

  getTraceEvents() {
    return this.trace.traceEvents;
  }

  getThreadInfo(): ThreadInfo {
    if (!this.threadInfo) {
      const { traceEvents: events } = this.trace;
      const threads = events.filter(({name}) => name === "thread_name") as ThreadNameEvent[];
      this.threadInfo = {
        browser: this.getBrowserThread(threads),
        renderers: this.getRendererThreads(events, threads),
      };
    }

    return this.threadInfo;
  }

  getEarliestTimestamp() {
    const { traceEvents: events } = this.trace;
    return events.reduce<number>((earliest, entry) => {
      const { ts } = entry;
      return ts > 0 && ts < earliest ? ts : earliest;
    }, Number.MAX_SAFE_INTEGER);
  }
}
