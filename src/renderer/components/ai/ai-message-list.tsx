import { Button, Typography } from 'antd';
import { ArrowDownOutlined, LoadingOutlined } from '@ant-design/icons';
import { observer } from 'mobx-react';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { RendererAiMessage } from '../../state/ai-store';

interface AiMessageListProps {
  messages: RendererAiMessage[];
}

/** Pixel threshold for considering the list "at the bottom". */
const SCROLL_THRESHOLD = 30;

/** Stable reference — avoids re-creating the array on every render. */
const REMARK_PLUGINS = [remarkGfm];

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_THRESHOLD;
}

/**
 * Memoized so completed messages skip ReactMarkdown re-parsing when
 * a sibling (the streaming message) updates on every chunk.
 */
const MessageContent = memo(function MessageContent({
  content,
}: {
  content: string;
}) {
  return (
    <div className="AiMessageContent">
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>{content}</ReactMarkdown>
    </div>
  );
});

const AiMessageList = observer(({ messages }: AiMessageListProps) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [isSticky, setIsSticky] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const lastMessageContent = messages[messages.length - 1]?.content;

  // Track user scroll position — if they scroll away from bottom, stop following
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const atBottom = isNearBottom(listRef.current);
    setIsSticky(atBottom);
    setShowScrollButton(!atBottom);
  }, []);

  // Auto-scroll only when sticky (user hasn't scrolled away)
  useEffect(() => {
    if (isSticky && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length, lastMessageContent, isSticky]);

  // Re-stick when a new user message is sent (new conversation turn)
  const prevMessageCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      const newest = messages[messages.length - 1];
      if (newest?.role === 'user') {
        setIsSticky(true);
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages, messages.length]);

  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
      setIsSticky(true);
      setShowScrollButton(false);
    }
  }, []);

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
    <div className="AiMessageListWrapper">
      <div className="AiMessageList" ref={listRef} onScroll={handleScroll}>
        {messages.map((msg) => (
          <div key={msg.id} className={`AiMessage AiMessage--${msg.role}`}>
            <MessageContent content={msg.content} />
            {msg.role === 'assistant' && msg.isStreaming && !msg.content && (
              <LoadingOutlined style={{ fontSize: 16 }} />
            )}
            {msg.role === 'assistant' && msg.isStreaming && msg.content && (
              <span className="AiStreamingCursor" />
            )}
          </div>
        ))}
      </div>
      {showScrollButton && (
        <Button
          className="AiScrollToBottom"
          shape="circle"
          size="small"
          icon={<ArrowDownOutlined />}
          onClick={scrollToBottom}
        />
      )}
    </div>
  );
});

export { AiMessageList };
