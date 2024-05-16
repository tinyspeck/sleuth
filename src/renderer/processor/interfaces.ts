export type ChromiumTraceEvent =
  | UnknownTraceEvent
  | TracingStartedInBrowserEvent
  | ThreadNameEvent;

interface TracingStartedInBrowserEvent {
  name: 'TracingStartedInBrowser';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
interface UnknownTraceEvent {
  ts: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export interface TraceThread {
  isClient: boolean;
  title?: string;
}

export interface RendererThread extends TraceThread {
  data: {
    frame: string;
    url: string;
    processId: number;
  };
}

export interface BrowserThread extends TraceThread {
  pid: number;
  tid: number;
  ts: number;
}

export interface ThreadInfo {
  browser?: BrowserThread;
  renderers: Array<RendererThread>;
}
