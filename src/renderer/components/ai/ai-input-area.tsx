import { Button, Input, Space } from 'antd';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { observer } from 'mobx-react';
import React, { useState } from 'react';

import type { SleuthState } from '../../state/sleuth';

interface AiInputAreaProps {
  state: SleuthState;
}

const AiInputArea = observer(({ state }: AiInputAreaProps) => {
  const [input, setInput] = useState('');
  const { aiStore } = state;

  async function handleSend() {
    const text = input.trim();
    if (!text || aiStore.isLoading) return;

    setInput('');
    await aiStore.sendMessage(text, state);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="AiInputArea">
      <Space.Compact style={{ width: '100%' }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your logs..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          style={{ flex: 1 }}
          disabled={aiStore.isLoading}
        />
        {aiStore.isLoading ? (
          <Button
            icon={<StopOutlined />}
            onClick={() => aiStore.abortCurrent()}
            danger
          />
        ) : (
          <Button
            icon={<SendOutlined />}
            onClick={handleSend}
            type="primary"
            disabled={!input.trim()}
          />
        )}
      </Space.Compact>
    </div>
  );
});

export { AiInputArea };
