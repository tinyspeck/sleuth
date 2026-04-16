import { AnthropicBedrock } from '@anthropic-ai/bedrock-sdk';
import type { BrowserWindow } from 'electron';
import type {
  ContentBlockParam,
  MessageParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources';

import { IpcEvents } from '../../ipc-events';
import type { AiMessage, SerializedLogContext } from '../../ai-interfaces';
import { buildSystemPrompt } from './log-context-formatter';
import {
  CODEBASE_TOOL_DEFINITIONS,
  LOG_TOOL_DEFINITIONS,
  REPO_CONTEXT_TOOL_DEFINITIONS,
  executeTools,
} from './tools';
import { getAwsCredentials, clearCredentialCache } from './aws-credentials';
import { getModel, getAwsRegion } from './ai-config';

export class AiService {
  private client: AnthropicBedrock | null = null;
  private activeRequests = new Map<string, AbortController>();

  private async getClient(): Promise<AnthropicBedrock> {
    // Always get fresh credentials (cached internally for 10 min)
    const creds = await getAwsCredentials();

    // Recreate client if credentials changed
    this.client = new AnthropicBedrock({
      awsRegion: getAwsRegion(),
      awsAccessKey: creds.accessKeyId,
      awsSecretKey: creds.secretAccessKey,
      awsSessionToken: creds.sessionToken,
    });

    return this.client;
  }

  async sendMessage(
    window: BrowserWindow,
    requestId: string,
    messages: AiMessage[],
    logContext: SerializedLogContext,
    codebasePaths: string[],
  ): Promise<void> {
    let client: AnthropicBedrock;
    try {
      client = await this.getClient();
    } catch (error) {
      if (!window.isDestroyed()) {
        window.webContents.send(IpcEvents.AI_STREAM_ERROR, {
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    const controller = new AbortController();
    this.activeRequests.set(requestId, controller);

    try {
      const systemPrompt = buildSystemPrompt(logContext);

      // Always include log tools and repo context tools;
      // include codebase tools only if paths are configured
      const tools = [
        ...LOG_TOOL_DEFINITIONS,
        ...REPO_CONTEXT_TOOL_DEFINITIONS,
        ...(codebasePaths.length > 0 ? CODEBASE_TOOL_DEFINITIONS : []),
      ];

      let currentMessages: MessageParam[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Tool-use loop
      while (true) {
        const stream = client.messages.stream(
          {
            model: getModel(),
            max_tokens: 8192,
            system: systemPrompt,
            messages: currentMessages,
            tools,
          },
          { signal: controller.signal },
        );

        stream.on('text', (text) => {
          if (!window.isDestroyed()) {
            window.webContents.send(IpcEvents.AI_STREAM_CHUNK, {
              requestId,
              chunk: text,
            });
          }
        });

        const finalMessage = await stream.finalMessage();

        const toolUseBlocks = finalMessage.content.filter(
          (b) => b.type === 'tool_use',
        );

        if (
          finalMessage.stop_reason === 'tool_use' &&
          toolUseBlocks.length > 0
        ) {
          // Notify renderer about tool calls
          for (const block of toolUseBlocks) {
            if (block.type === 'tool_use' && !window.isDestroyed()) {
              window.webContents.send(IpcEvents.AI_STREAM_CHUNK, {
                requestId,
                chunk: `\n\n> *Using tool: ${block.name}*\n\n`,
              });
            }
          }

          // Execute tools and continue conversation
          currentMessages.push({
            role: 'assistant',
            content: finalMessage.content as ContentBlockParam[],
          });
          const toolResults = await executeTools(
            toolUseBlocks as ToolUseBlock[],
            codebasePaths,
            logContext,
          );
          currentMessages.push({
            role: 'user',
            content: toolResults,
          });
        } else {
          // Done - no more tool calls
          break;
        }
      }

      if (!window.isDestroyed()) {
        window.webContents.send(IpcEvents.AI_STREAM_DONE, { requestId });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // If we get an auth error mid-stream, clear the credential cache
      if (
        msg.includes('ExpiredToken') ||
        msg.includes('InvalidSignature') ||
        msg.includes('UnrecognizedClient') ||
        msg.includes('403')
      ) {
        clearCredentialCache();
      }

      if (!window.isDestroyed()) {
        window.webContents.send(IpcEvents.AI_STREAM_ERROR, {
          requestId,
          error: msg,
        });
      }
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  abort(requestId: string): void {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
  }
}
