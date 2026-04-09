import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import https from 'node:https';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { Tool, ToolResultBlockParam } from '@anthropic-ai/sdk/resources';
import type { SerializedLogContext } from '../../ai-interfaces';

const execFileAsync = promisify(execFile);

export const CODEBASE_TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'search_codebase',
    description:
      'Search for files or text patterns within the configured codebase directories. Returns matching file paths and line content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Text or regex pattern to search for',
        },
        file_pattern: {
          type: 'string',
          description:
            'Glob pattern to filter files (e.g. "*.ts", "*.tsx"). Default: all files.',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return. Default: 20.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_file',
    description:
      'Read the contents of a specific file from the configured codebase directories.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Relative or absolute path to the file to read',
        },
        start_line: {
          type: 'number',
          description:
            'Start reading from this line number (1-based). Default: 1.',
        },
        end_line: {
          type: 'number',
          description:
            'Stop reading at this line number (inclusive). Default: end of file.',
        },
      },
      required: ['path'],
    },
  },
];

/**
 * Well-known repo context entries whose CLAUDE.md files provide architectural
 * context that the AI can consult when debugging log issues.
 *
 * Each entry has a `contextFile` (the relative path to the context file within
 * the repo) and a `remoteUrl` (a raw GitHub URL used as a fallback when the
 * repo is not present in the user's configured codebase directories).
 */
interface RepoContextEntry {
  name: string;
  description: string;
  contextFile: string;
  /** Raw GitHub URL used as fallback when the repo is not in codebase dirs. */
  remoteUrl?: string;
}

const REPO_CONTEXT_ENTRIES: RepoContextEntry[] = [
  {
    name: 'webapp',
    description: 'Slack web application (frontend & backend)',
    contextFile: 'CLAUDE.md',
    // Internal repo — requires local codebase directory
  },
  {
    name: 'slack-desktop',
    description: 'Slack Electron desktop client',
    contextFile: 'CLAUDE.md',
    // Internal repo — requires local codebase directory
  },
  {
    name: 'electron',
    description: 'Electron framework (Chromium + Node.js)',
    contextFile: 'CLAUDE.md',
    remoteUrl:
      'https://raw.githubusercontent.com/electron/electron/main/CLAUDE.md',
  },
];

export const REPO_CONTEXT_TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'read_repo_context',
    description:
      'Read the CLAUDE.md architectural context file for a well-known Slack repository. ' +
      'Use this to understand how the webapp or desktop client codebase is structured when ' +
      'correlating log entries with source code.',
    input_schema: {
      type: 'object' as const,
      properties: {
        repo: {
          type: 'string',
          description: `Repository name. One of: ${REPO_CONTEXT_ENTRIES.map((r) => `"${r.name}"`).join(', ')}.`,
          enum: REPO_CONTEXT_ENTRIES.map((r) => r.name),
        },
      },
      required: ['repo'],
    },
  },
];

export const LOG_TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'list_log_files',
    description:
      'List all available log files and state files from the loaded log bundle. Returns file names, types, and entry counts. Use this first to understand what log data is available before reading specific entries.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'read_log_entries',
    description:
      'Read log entries from a specific log file. Returns entries with timestamps, levels, messages, and source file info. Use offset and limit to page through large files.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_name: {
          type: 'string',
          description:
            'The file name to read entries from (as returned by list_log_files)',
        },
        offset: {
          type: 'number',
          description: 'Start from this entry index (0-based). Default: 0.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of entries to return. Default: 100.',
        },
        level_filter: {
          type: 'string',
          description:
            'Filter by log level (e.g. "error", "warn", "info", "debug"). Default: all levels.',
        },
      },
      required: ['file_name'],
    },
  },
  {
    name: 'search_log_entries',
    description:
      'Search across all log files for entries matching a text pattern. Returns matching entries from any log file. Useful for finding specific errors, events, or patterns across all logs.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Text or regex pattern to search for in log messages',
        },
        level_filter: {
          type: 'string',
          description:
            'Filter by log level (e.g. "error", "warn"). Default: all levels.',
        },
        max_results: {
          type: 'number',
          description:
            'Maximum number of matching entries to return. Default: 50.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_state_file',
    description:
      'Read the contents of a state/settings file from the log bundle (e.g. environment.json, root-state.json, local-settings.json).',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_name: {
          type: 'string',
          description:
            'The state file name to read (as returned by list_log_files)',
        },
      },
      required: ['file_name'],
    },
  },
];

function isPathWithinDirs(filePath: string, allowedDirs: string[]): boolean {
  const resolved = path.resolve(filePath);
  return allowedDirs.some((dir) => {
    const resolvedDir = path.resolve(dir);
    return (
      resolved === resolvedDir || resolved.startsWith(resolvedDir + path.sep)
    );
  });
}

interface SearchInput {
  query: string;
  file_pattern?: string;
  max_results?: number;
}

interface ReadFileInput {
  path: string;
  start_line?: number;
  end_line?: number;
}

interface ReadLogEntriesInput {
  file_name: string;
  offset?: number;
  limit?: number;
  level_filter?: string;
}

interface SearchLogEntriesInput {
  query: string;
  level_filter?: string;
  max_results?: number;
}

interface ReadStateFileInput {
  file_name: string;
}

async function executeSearch(
  input: SearchInput,
  codebasePaths: string[],
): Promise<string> {
  const maxResults = input.max_results ?? 20;
  const allResults: string[] = [];

  for (const dir of codebasePaths) {
    const args = ['-rn', '--max-count', '3'];

    if (input.file_pattern) {
      args.push('--include', input.file_pattern);
    }

    // Exclude common non-source directories
    args.push(
      '--exclude-dir=node_modules',
      '--exclude-dir=.git',
      '--exclude-dir=dist',
      '--exclude-dir=build',
    );

    args.push(input.query, dir);

    try {
      const { stdout } = await execFileAsync('grep', args, {
        maxBuffer: 1024 * 1024,
        timeout: 10000,
      });

      const lines = stdout.trim().split('\n').filter(Boolean);
      allResults.push(...lines);
    } catch (error) {
      // grep returns exit code 1 when no matches found
      if ((error as NodeJS.ErrnoException).code !== '1') {
        const err = error as Error;
        if (!err.message?.includes('exited with code 1')) {
          allResults.push(`Error searching ${dir}: ${err.message}`);
        }
      }
    }
  }

  if (allResults.length === 0) {
    return 'No matches found.';
  }

  const truncated = allResults.slice(0, maxResults);
  let result = truncated.join('\n');

  if (allResults.length > maxResults) {
    result += `\n\n[...truncated, showing ${maxResults} of ${allResults.length} matches]`;
  }

  return result;
}

async function executeReadFile(
  input: ReadFileInput,
  codebasePaths: string[],
): Promise<string> {
  let filePath = input.path;

  // If not absolute, try to resolve against each codebase path
  if (!path.isAbsolute(filePath)) {
    let found = false;
    for (const dir of codebasePaths) {
      const candidate = path.resolve(dir, filePath);
      try {
        await fs.access(candidate);
        filePath = candidate;
        found = true;
        break;
      } catch {
        // Try next directory
      }
    }
    if (!found) {
      return `Error: File not found in any configured codebase directory: ${input.path}`;
    }
  }

  // Security: validate path is within allowed directories
  if (!isPathWithinDirs(filePath, codebasePaths)) {
    return `Error: Access denied. File is outside configured codebase directories.`;
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    const startLine = Math.max(1, input.start_line ?? 1);
    const endLine = Math.min(lines.length, input.end_line ?? lines.length);

    const selectedLines = lines.slice(startLine - 1, endLine);
    const numbered = selectedLines.map(
      (line, i) => `${startLine + i}: ${line}`,
    );

    let result = `File: ${filePath}\n`;
    if (input.start_line || input.end_line) {
      result += `Lines ${startLine}-${endLine} of ${lines.length}\n`;
    }
    result += '\n' + numbered.join('\n');

    // Truncate very large files
    const MAX_CHARS = 50000;
    if (result.length > MAX_CHARS) {
      result =
        result.slice(0, MAX_CHARS) + '\n\n[...truncated at 50000 characters]';
    }

    return result;
  } catch (error) {
    return `Error reading file: ${(error as Error).message}`;
  }
}

function executeListLogFiles(logContext: SerializedLogContext): string {
  const parts: string[] = [];

  if (logContext.files.length > 0) {
    parts.push('=== Log Files ===');
    for (const file of logContext.files) {
      parts.push(
        `  [${file.logType}] ${file.fileName} — ${file.entryCount} entries`,
      );
    }
  } else {
    parts.push('No log files loaded.');
  }

  if (logContext.stateFiles && logContext.stateFiles.length > 0) {
    parts.push('');
    parts.push('=== State & Settings Files ===');
    for (const sf of logContext.stateFiles) {
      parts.push(`  ${sf.fileName}`);
    }
  }

  return parts.join('\n');
}

function executeReadLogEntries(
  input: ReadLogEntriesInput,
  logContext: SerializedLogContext,
): string {
  const file = logContext.files.find((f) => f.fileName === input.file_name);
  if (!file) {
    return `Error: Log file "${input.file_name}" not found. Use list_log_files to see available files.`;
  }

  let entries = file.entries;

  if (input.level_filter) {
    const level = input.level_filter.toLowerCase();
    entries = entries.filter((e) => e.level.toLowerCase() === level);
  }

  const offset = input.offset ?? 0;
  const limit = input.limit ?? 100;
  const sliced = entries.slice(offset, offset + limit);

  if (sliced.length === 0) {
    return `No entries found (offset=${offset}, total matching=${entries.length}).`;
  }

  const header = `[${file.logType}] ${file.fileName} — showing entries ${offset}-${offset + sliced.length - 1} of ${entries.length}${input.level_filter ? ` (filtered: ${input.level_filter})` : ''}`;
  const lines = sliced.map((e) => {
    let line = `[${e.timestamp}] [${e.level}] [${e.sourceFile}:${e.line}] ${e.message}`;
    if (e.meta) line += `\n  meta: ${e.meta}`;
    if (e.repeated?.length) line += `\n  repeated ${e.repeated.length}x`;
    return line;
  });

  let result = header + '\n\n' + lines.join('\n');

  const MAX_CHARS = 80000;
  if (result.length > MAX_CHARS) {
    result =
      result.slice(0, MAX_CHARS) + '\n\n[...truncated at 80000 characters]';
  }

  return result;
}

function executeSearchLogEntries(
  input: SearchLogEntriesInput,
  logContext: SerializedLogContext,
): string {
  const maxResults = input.max_results ?? 50;
  const matches: string[] = [];
  let regex: RegExp;

  try {
    regex = new RegExp(input.query, 'i');
  } catch {
    // Fall back to literal string match
    regex = new RegExp(input.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  for (const file of logContext.files) {
    for (const entry of file.entries) {
      if (matches.length >= maxResults) break;

      if (
        input.level_filter &&
        entry.level.toLowerCase() !== input.level_filter.toLowerCase()
      ) {
        continue;
      }

      if (regex.test(entry.message) || (entry.meta && regex.test(entry.meta))) {
        let line = `[${file.fileName}] [${entry.timestamp}] [${entry.level}] [${entry.sourceFile}:${entry.line}] ${entry.message}`;
        if (entry.meta) line += `\n  meta: ${entry.meta}`;
        if (entry.repeated?.length)
          line += `\n  repeated ${entry.repeated.length}x`;
        matches.push(line);
      }
    }
    if (matches.length >= maxResults) break;
  }

  if (matches.length === 0) {
    return `No log entries matching "${input.query}" found.`;
  }

  let result =
    `Found ${matches.length} matching entries:\n\n` + matches.join('\n');

  const MAX_CHARS = 80000;
  if (result.length > MAX_CHARS) {
    result =
      result.slice(0, MAX_CHARS) + '\n\n[...truncated at 80000 characters]';
  }

  return result;
}

function executeReadStateFile(
  input: ReadStateFileInput,
  logContext: SerializedLogContext,
): string {
  if (!logContext.stateFiles) {
    return 'No state files available.';
  }

  const stateFile = logContext.stateFiles.find(
    (f) => f.fileName === input.file_name,
  );
  if (!stateFile) {
    return `Error: State file "${input.file_name}" not found. Use list_log_files to see available files.`;
  }

  let result = `=== ${stateFile.fileName} ===\n\n${stateFile.content}`;

  const MAX_CHARS = 80000;
  if (result.length > MAX_CHARS) {
    result =
      result.slice(0, MAX_CHARS) + '\n\n[...truncated at 80000 characters]';
  }

  return result;
}

interface ReadRepoContextInput {
  repo: string;
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          fetchUrl(res.headers.location).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function executeReadRepoContext(
  input: ReadRepoContextInput,
  codebasePaths: string[],
): Promise<string> {
  const entry = REPO_CONTEXT_ENTRIES.find((r) => r.name === input.repo);
  if (!entry) {
    return `Error: Unknown repo "${input.repo}". Available repos: ${REPO_CONTEXT_ENTRIES.map((r) => r.name).join(', ')}`;
  }

  const MAX_CHARS = 80000;

  // 1. Try reading from configured codebase directories first
  for (const dir of codebasePaths) {
    const candidate = path.join(dir, entry.contextFile);
    try {
      const content = await fs.readFile(candidate, 'utf-8');
      let result = `=== ${entry.name} (${entry.description}) — ${entry.contextFile} ===\n\n${content}`;
      if (result.length > MAX_CHARS) {
        result =
          result.slice(0, MAX_CHARS) + '\n\n[...truncated at 80000 characters]';
      }
      return result;
    } catch {
      // Not in this directory, try next
    }
  }

  // 2. Fall back to remote URL if available
  if (entry.remoteUrl) {
    try {
      const content = await fetchUrl(entry.remoteUrl);
      let result = `=== ${entry.name} (${entry.description}) — ${entry.contextFile} ===\n\n${content}`;
      if (result.length > MAX_CHARS) {
        result =
          result.slice(0, MAX_CHARS) + '\n\n[...truncated at 80000 characters]';
      }
      return result;
    } catch {
      return `Error: Could not fetch CLAUDE.md for "${entry.name}" from ${entry.remoteUrl}.`;
    }
  }

  return `Error: Could not find ${entry.contextFile} for "${entry.name}". Add the repository to your codebase directories in Preferences.`;
}

interface ToolUseInput {
  id: string;
  name: string;
  input: unknown;
}

export async function executeTools(
  toolUseBlocks: ToolUseInput[],
  codebasePaths: string[],
  logContext: SerializedLogContext,
): Promise<ToolResultBlockParam[]> {
  const results: ToolResultBlockParam[] = [];

  for (const block of toolUseBlocks) {
    let content: string;

    if (block.name === 'search_codebase') {
      content = await executeSearch(
        block.input as unknown as SearchInput,
        codebasePaths,
      );
    } else if (block.name === 'read_file') {
      content = await executeReadFile(
        block.input as unknown as ReadFileInput,
        codebasePaths,
      );
    } else if (block.name === 'list_log_files') {
      content = executeListLogFiles(logContext);
    } else if (block.name === 'read_log_entries') {
      content = executeReadLogEntries(
        block.input as unknown as ReadLogEntriesInput,
        logContext,
      );
    } else if (block.name === 'search_log_entries') {
      content = executeSearchLogEntries(
        block.input as unknown as SearchLogEntriesInput,
        logContext,
      );
    } else if (block.name === 'read_state_file') {
      content = executeReadStateFile(
        block.input as unknown as ReadStateFileInput,
        logContext,
      );
    } else if (block.name === 'read_repo_context') {
      content = await executeReadRepoContext(
        block.input as unknown as ReadRepoContextInput,
        codebasePaths,
      );
    } else {
      content = `Unknown tool: ${block.name}`;
    }

    results.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content,
    });
  }

  return results;
}
