import { observable, action, makeObservable, autorun, toJS } from 'mobx';
import type {
  AiMessage,
  SerializedLogContext,
  AiStreamChunkData,
  AiStreamDoneData,
  AiStreamErrorData,
} from '../../ai-interfaces';
import type { SleuthState } from './sleuth';
import type { ProcessedLogFile } from '../../interfaces';
import { setSetting } from '../settings';

export interface RendererAiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

export class AiStore {
  @observable messages: RendererAiMessage[] = [];
  @observable isLoading = false;
  @observable currentRequestId: string | null = null;
  @observable error: string | null = null;
  @observable codebasePaths: string[] = [];

  private cleanupChunk?: () => void;
  private cleanupDone?: () => void;
  private cleanupError?: () => void;

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

  async sendMessage(userText: string, sleuthState: SleuthState) {
    this.addUserMessage(userText);

    const requestId = crypto.randomUUID();
    this.currentRequestId = requestId;
    this.isLoading = true;
    this.error = null;

    const logContext = this.serializeAllLogs(sleuthState);
    const apiMessages: AiMessage[] = this.messages
      .filter((m) => m.content)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    await window.Sleuth.aiSendMessage(
      requestId,
      apiMessages,
      JSON.parse(JSON.stringify(logContext)),
      toJS(this.codebasePaths),
    );
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
   * Serialize all loaded log files and state files so the AI service
   * can make them available via tools (list_log_files, read_log_entries, etc.).
   */
  private serializeAllLogs(sleuthState: SleuthState): SerializedLogContext {
    const context: SerializedLogContext = { files: [] };
    const { processedLogFiles, stateFiles } = sleuthState;

    if (processedLogFiles) {
      const allLogFiles: ProcessedLogFile[] = [
        ...processedLogFiles.browser,
        ...processedLogFiles.webapp,
        ...processedLogFiles.chromium,
        ...processedLogFiles.installer,
        ...processedLogFiles.mobile,
      ];

      for (const file of allLogFiles) {
        context.files.push({
          fileName: file.logFile.fileName,
          logType: file.logType,
          entryCount: file.logEntries.length,
          entries: file.logEntries.map((e) => ({
            timestamp: e.timestamp,
            level: e.level,
            message: e.message,
            line: e.line,
            sourceFile: e.sourceFile,
          })),
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
        this.codebasePaths = JSON.parse(stored);
      }
    } catch {
      // ignore parse errors
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
