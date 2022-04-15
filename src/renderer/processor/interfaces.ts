export type ChromiumTraceEvent =
  | UnknownTraceEvent
  | TracingStartedInBrowserEvent
  | ThreadNameEvent;

interface TracingStartedInBrowserEvent {
  name: 'TracingStartedInBrowser';
  [key: string]: any;
}
interface UnknownTraceEvent {
  ts: number;
  [key: string]: any;
}

export interface ChromiumTrace {
  traceEvents: Array<ChromiumTraceEvent>;
  sourcemapped?: boolean;
}

export interface ThreadNameEvent {
  name: 'thread_name';
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
  pid: number;
  tid: number;
  ts: number;
}

export interface ThreadInfo {
  browser?: BrowserThread;
  renderers: Array<RendererThread>;
}