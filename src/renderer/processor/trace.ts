import { SleuthState } from '../state/sleuth';
import fs from 'fs-extra';
import { ProcessedLogFiles, UnzippedFile } from '../../interfaces';
import { PantryAuth } from '../pantry/auth';
import { TraceMapper } from './trace/mapper';
import { SourcemapResolver } from './trace/resolver';
import { ChromiumTraceEvent, TraceParser } from './trace/parser';
import { normalize } from 'path';
import { EventEmitter } from 'events';
import { getPath } from '../ipc';

const debug = require('debug')('sleuth:trace-processor');
export interface RendererDescription {
  title?: string;
  isClient: boolean;
  processId: number;
}

function maybeParseJSON(raw: string) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export class TraceProcessor extends EventEmitter {
  state: SleuthState;
  uberProxyCookie: string;
  isSignedIn: boolean;
  pantryAuth: PantryAuth;
  cachedParser: TraceParser | undefined;

  constructor() {
    super();
    this.pantryAuth = new PantryAuth();
    this.pantryAuth.onAuthChange((cookie, isSignedIn) => {
      this.emit('auth-changed', cookie, isSignedIn);
    });
  }

  reset() {
    this.cachedParser = undefined;
  }

  setCookie(uberProxyCookie: string) {
    this.pantryAuth.setCookie(uberProxyCookie);
  }

  private async getTraceParser(file: UnzippedFile) {
    if (!this.cachedParser) {
      const raw = await fs.readFile(file.fullPath, 'utf8');
      const json = maybeParseJSON(raw);
      if (json.traceEvents) {
        this.cachedParser = new TraceParser(json);
      }
    }
    return this.cachedParser;
  }

  async getRendererProcesses(file: UnzippedFile): Promise<Array<RendererDescription> | undefined> {
    const parser = await this.getTraceParser(file);
    if (parser) {
      const { renderers } = parser.getThreadInfo();
      return renderers.map(({ data, isClient, title }) => {
        const { processId } = data;
        return {
          title,
          isClient,
          processId,
        };
      });
    }
    return undefined;
  }

  async makeInitialEntry(
    file: UnzippedFile,
    pid?: number
  ): Promise<ChromiumTraceEvent | undefined> {
    const parser = await this.getTraceParser(file);
    if (parser) {
      const { browser, renderers } = parser.getThreadInfo();
      const rendererThread = renderers.find((thread) => thread.data.processId === pid);

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
    return;
  }

  public async rawRenderer(
    file: UnzippedFile,
    pid: number
  ): Promise<Array<ChromiumTraceEvent>> {
    const initialEntry = await this.makeInitialEntry(file, pid);
    const parser = await this.getTraceParser(file);
    if (!parser) {
      this.emit('error', 'Unable to parser trace');
      return [];
    }

    const events = parser.getTraceEvents();
    return initialEntry ? [initialEntry, ...events] : events;
  }

  public async processRenderer(
    state: SleuthState,
    file: UnzippedFile,
    pid: number
  ): Promise<Array<ChromiumTraceEvent>> {
    const entries = await this.sourcemap(state, file);
    const initialEntry = await this.makeInitialEntry(file, pid);
    return initialEntry ? [initialEntry, ...entries] : entries;
  }

  public async sourcemap(state: SleuthState, file: UnzippedFile): Promise<Array<ChromiumTraceEvent>> {
    const userData = await getPath('userData');
    const cachedEntries = normalize(
      `${userData}/trace-cache/sourcemap/entries/${file.fileName}.json`
    );
    const cached = await fs.pathExists(cachedEntries);
    if (cached) {
      const entries = await fs.readJSON(cachedEntries);
      this.emit('completed', []);
      return entries;
    }

    const parser = await this.getTraceParser(file);
    if (!parser) {
      this.emit('error', 'Unable to parser trace');
      return [];
    }

    const traceEvents = parser.getTraceEvents();
    const rootState = this.getRootState(state.processedLogFiles);
    if (!rootState) {
      this.emit('error', 'Missing root state');
      return traceEvents;
    }
    const shas = await this.getWebappSHAs(rootState);
    if (!shas.length) {
      this.emit('error', 'Unable to locate webapp SHA');
      return traceEvents;
    }

    if (shas.length > 1) {
      debug('Multiple webapp SHAs found, using first');
    }

    const isSignedIn = state.isUberProxySignedIn;
    if (!isSignedIn) {
      const success = await this.pantryAuth.signIn();
      if (!success) {
        this.emit('error', 'Unable to authenticate with pantry');
        return traceEvents;
      }
    }

    const [sha] = shas;
    const resolver = new SourcemapResolver(
      sha,
      state.uberProxyCookie,
      normalize(`${userData}/trace-cache/sourcemap`)
    );
    const mapper = new TraceMapper(parser, resolver);
    mapper.on('progress', (progress) => {
      this.emit('progress', progress);
    });
    const { used, events } = await mapper.map();

    await fs.outputJSON(cachedEntries, events);

    this.emit('completed', used);
    return events;
  }

  private getRootState(processedLogFiles?: ProcessedLogFiles) {
    return processedLogFiles?.state.find((file) =>
      file.fileName.endsWith('root-state.json')
    );
  }
  private async getWebappSHAs(rootState: UnzippedFile): Promise<Array<string>> {
    const data = await fs.readFile(rootState.fullPath, 'utf8');
    const { webapp } = maybeParseJSON(data);
    const { teams } = webapp;
    return Object.keys(teams).reduce<Array<string>>((acc, teamKey) => {
      const version = teams[teamKey].version;
      const sha: string = version?.slice(0, version.indexOf('@'));
      if (sha && !acc.includes(sha)) {
        acc.push(sha);
      }
      return acc;
    }, []);
  }
}
