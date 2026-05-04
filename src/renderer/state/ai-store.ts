import { observable, action, makeObservable, autorun, toJS } from 'mobx';
import type {
  AiMessage,
  SerializedLogContext,
  SerializedLogEntry,
  AiStreamChunkData,
  AiStreamDoneData,
  AiStreamErrorData,
} from '../../ai-interfaces';
import type { SleuthState } from './sleuth';
import type { ProcessedLogFile } from '../../interfaces';
import { setSetting } from '../settings';

interface BaseAiMessage {
  id: string;
  content: string;
}

export interface UserAiMessage extends BaseAiMessage {
  role: 'user';
}

export interface AssistantAiMessage extends BaseAiMessage {
  role: 'assistant';
  isStreaming: boolean;
}

export type RendererAiMessage = UserAiMessage | AssistantAiMessage;

export class AiStore {
  @observable messages: RendererAiMessage[] = [];
  @observable isLoading = false;
  @observable currentRequestId: string | null = null;
  @observable error: string | null = null;
  @observable codebasePaths: string[] = [];

  private cleanupChunk?: () => void;
  private cleanupDone?: () => void;
  private cleanupError?: () => void;
  private cachedLogContext: SerializedLogContext | null = null;

  constructor() {
    makeObservable(this);
    this.loadCodebasePaths();
    this.setupStreamListeners();

    autorun(() => {
      const paths = toJS(this.codebasePaths);
      localStorage.setItem('aiCodebasePaths', JSON.stringify(paths));
      setSetting('aiCodebasePaths', paths);
    });
  }

  @action
  addUserMessage(content: string) {
    this.messages.push({
      id: crypto.randomUUID(),
      role: 'user',
      content,
    });
    // Add placeholder for assistant response
    this.messages.push({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    });
  }

  @action
  appendStreamChunk(requestId: string, chunk: string) {
    if (this.currentRequestId !== requestId) return;
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      lastMessage.content += chunk;
    }
  }

  @action
  finalizeStream(requestId: string) {
    if (this.currentRequestId !== requestId) return;
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      lastMessage.isStreaming = false;
    }
    this.isLoading = false;
    this.currentRequestId = null;
  }

  @action
  handleStreamError(requestId: string, error: string) {
    if (this.currentRequestId !== requestId) return;
    this.error = error;
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      lastMessage.isStreaming = false;
      if (!lastMessage.content) {
        lastMessage.content =
          error === 'AWS_SSO_AUTH_REQUIRED'
            ? 'AWS authentication is required. Click "Authenticate" above to sign in.'
            : `Error: ${error}`;
      }
    }
    this.isLoading = false;
    this.currentRequestId = null;
  }

  @action
  reset() {
    this.messages = [];
    this.isLoading = false;
    this.error = null;
    this.currentRequestId = null;
    this.cachedLogContext = null;
  }

  @action
  addCodebasePath(dirPath: string) {
    if (!this.codebasePaths.includes(dirPath)) {
      this.codebasePaths.push(dirPath);
    }
  }

  @action
  removeCodebasePath(dirPath: string) {
    this.codebasePaths = this.codebasePaths.filter((p) => p !== dirPath);
  }

  @action
  async sendMessage(userText: string, sleuthState: SleuthState) {
    this.addUserMessage(userText);

    const requestId = crypto.randomUUID();
    this.currentRequestId = requestId;
    this.isLoading = true;
    this.error = null;

    try {
      const logContext = this.getLogContext(sleuthState);
      const apiMessages: AiMessage[] = this.messages
        .filter((m) => m.content)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      await window.Sleuth.aiSendMessage(
        requestId,
        apiMessages,
        logContext,
        toJS(this.codebasePaths),
      );
    } catch (error) {
      this.handleStreamError(
        requestId,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async abortCurrent() {
    if (this.currentRequestId) {
      await window.Sleuth.aiAbort(this.currentRequestId);
      this.finalizeStream(this.currentRequestId);
    }
  }

  dispose() {
    this.cleanupChunk?.();
    this.cleanupDone?.();
    this.cleanupError?.();
  }

  /**
   * Return the serialized log context, caching the result since loaded
   * logs are immutable after processing completes.
   */
  private getLogContext(sleuthState: SleuthState): SerializedLogContext {
    if (this.cachedLogContext) return this.cachedLogContext;
    this.cachedLogContext = this.serializeAllLogs(sleuthState);
    return this.cachedLogContext;
  }

  /**
   * Invalidate the cached log context (e.g. when new logs are loaded).
   */
  invalidateLogCache() {
    this.cachedLogContext = null;
  }

  /**
   * Serialize all loaded log files and state files so the AI service
   * can make them available via tools (list_log_files, read_log_entries, etc.).
   *
   * We map the fields needed for log analysis and drop internal bookkeeping
   * fields (index, logType, momentValue) to keep the serialized payload
   * focused. We keep meta (stack traces, extended JSON) and repeated
   * (collapsed duplicate lines) since they carry diagnostic value.
   */
  private serializeAllLogs(sleuthState: SleuthState): SerializedLogContext {
    const context: SerializedLogContext = { files: [] };
    const { processedLogFiles, stateFiles } = sleuthState;

    if (processedLogFiles) {
      // The arrays may contain raw UnzippedFile entries (e.g. ShipIt plists
      // in installer) alongside ProcessedLogFile entries, so filter by the
      // discriminant to avoid accessing .logFile on an UnzippedFile.
      const allLogFiles = [
        ...processedLogFiles.browser,
        ...processedLogFiles.webapp,
        ...processedLogFiles.chromium,
        ...processedLogFiles.installer,
        ...processedLogFiles.mobile,
      ].filter((f): f is ProcessedLogFile => f.type === 'ProcessedLogFile');

      for (const file of allLogFiles) {
        context.files.push({
          fileName: file.logFile.fileName,
          logType: file.logType,
          entryCount: file.logEntries.length,
          entries: file.logEntries.map((e) => {
            const entry: SerializedLogEntry = {
              timestamp: e.timestamp,
              level: e.level,
              message: e.message,
              line: e.line,
              sourceFile: e.sourceFile,
            };
            if (e.meta != null) {
              entry.meta =
                typeof e.meta === 'string'
                  ? e.meta
                  : `[${e.meta.timestamp}] [${e.meta.level}] ${e.meta.message}`;
            }
            if (e.repeated?.length) {
              entry.repeated = e.repeated;
            }
            return entry;
          }),
        });
      }
    }

    // Include state files
    const stateFileNames = Object.keys(stateFiles);
    if (stateFileNames.length > 0) {
      context.stateFiles = stateFileNames.map((name) => ({
        fileName: name,
        content: JSON.stringify(stateFiles[name].data, null, 2),
      }));
    }

    return context;
  }

  private loadCodebasePaths() {
    try {
      const stored = localStorage.getItem('aiCodebasePaths');
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (
          Array.isArray(parsed) &&
          parsed.every((p) => typeof p === 'string')
        ) {
          this.codebasePaths = parsed;
        } else {
          console.warn('Invalid aiCodebasePaths in localStorage, clearing');
          localStorage.removeItem('aiCodebasePaths');
        }
      }
    } catch {
      console.warn(
        'Failed to parse aiCodebasePaths from localStorage, clearing',
      );
      localStorage.removeItem('aiCodebasePaths');
    }
  }

  private setupStreamListeners() {
    this.cleanupChunk = window.Sleuth.setupAiStreamChunk(
      (_event: Electron.IpcRendererEvent, data: AiStreamChunkData) => {
        this.appendStreamChunk(data.requestId, data.chunk);
      },
    );
    this.cleanupDone = window.Sleuth.setupAiStreamDone(
      (_event: Electron.IpcRendererEvent, data: AiStreamDoneData) => {
        this.finalizeStream(data.requestId);
      },
    );
    this.cleanupError = window.Sleuth.setupAiStreamError(
      (_event: Electron.IpcRendererEvent, data: AiStreamErrorData) => {
        this.handleStreamError(data.requestId, data.error);
      },
    );
  }
}
