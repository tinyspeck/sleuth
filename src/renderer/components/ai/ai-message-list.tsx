import { Typography } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { observer } from 'mobx-react';
import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { RendererAiMessage } from '../../state/ai-store';

interface AiMessageListProps {
  messages: RendererAiMessage[];
}

function MessageContent({ content }: { content: string }) {
  return (
    <div className="AiMessageContent">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

const AiMessageList = observer(({ messages }: AiMessageListProps) => {
  const listRef = useRef<HTMLDivElement>(null);

  const lastMessageContent = messages[messages.length - 1]?.content;

  // Auto-scroll to bottom on new messages or content changes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, lastMessageContent]);

  if (messages.length === 0) {
    return (
      <div className="AiMessageList AiMessageList--empty">
        <Typography.Text type="secondary">
          Ask a question about your logs. Attach log files or selected entries
          for context.
        </Typography.Text>
      </div>
    );
  }

  return (
    <div className="AiMessageList" ref={listRef}>
      {messages.map((msg) => (
        <div key={msg.id} className={`AiMessage AiMessage--${msg.role}`}>
          <MessageContent content={msg.content} />
          {msg.isStreaming && !msg.content && (
            <LoadingOutlined style={{ fontSize: 16 }} />
          )}
          {msg.isStreaming && msg.content && (
            <span className="AiStreamingCursor" />
          )}
        </div>
      ))}
    </div>
  );
});

export { AiMessageList };
