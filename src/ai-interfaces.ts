export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface SerializedLogEntry {
  timestamp: string;
  level: string;
  message: string;
  line: number;
  sourceFile: string;
}

export interface SerializedLogFile {
  fileName: string;
  logType: string;
  entryCount: number;
  entries: SerializedLogEntry[];
}

export interface SerializedLogContext {
  files: SerializedLogFile[];
  stateFiles?: Array<{
    fileName: string;
    content: string;
  }>;
}

export interface AiStreamChunkData {
  requestId: string;
  chunk: string;
}

export interface AiStreamDoneData {
  requestId: string;
}

export interface AiStreamErrorData {
  requestId: string;
  error: string;
}
