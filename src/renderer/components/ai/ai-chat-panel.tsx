import { Alert, Button, Tooltip, Typography } from 'antd';
import {
  ClearOutlined,
  CloseOutlined,
  FolderOpenOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import { observer } from 'mobx-react';
import React, { useCallback, useState } from 'react';

import type { SleuthState } from '../../state/sleuth';
import { AiMessageList } from './ai-message-list';
import { AiInputArea } from './ai-input-area';

interface AiChatPanelProps {
  state: SleuthState;
}

function SsoLoginBanner({ onSuccess }: { onSuccess: () => void }) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await window.Sleuth.aiSsoLogin();
      onSuccess();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  }, [onSuccess]);

  return (
    <Alert
      type="warning"
      showIcon
      className="AiErrorBanner"
      message="AWS authentication required"
      description={
        <>
          <Typography.Paragraph style={{ marginBottom: 8 }}>
            Sign in with AWS SSO to use the AI assistant.
            {loginError && (
              <Typography.Text type="danger"> {loginError}</Typography.Text>
            )}
          </Typography.Paragraph>
          <Button
            size="small"
            type="primary"
            icon={<LoginOutlined />}
            loading={isLoggingIn}
            onClick={handleLogin}
          >
            {isLoggingIn ? 'Waiting for browser...' : 'Authenticate'}
          </Button>
        </>
      }
    />
  );
}

function getErrorAlert(error: string | null, onAuthSuccess: () => void) {
  if (!error) return null;

  if (
    error === 'AWS_SSO_AUTH_REQUIRED' ||
    error.includes('ExpiredToken') ||
    error.includes('UnrecognizedClient')
  ) {
    return <SsoLoginBanner onSuccess={onAuthSuccess} />;
  }

  if (error === 'AWS_SSO_NOT_INSTALLED') {
    return (
      <Alert
        type="warning"
        showIcon
        className="AiErrorBanner"
        message="AWS SSO tool not found"
        description={
          <>
            Install <Typography.Text code>fma-sso-assume-role</Typography.Text>{' '}
            to use the AI assistant.
          </>
        }
      />
    );
  }

  return (
    <Alert
      type="error"
      showIcon
      className="AiErrorBanner"
      message="Error"
      description={error}
      closable
    />
  );
}

const AiChatPanel = observer(({ state }: AiChatPanelProps) => {
  const { aiStore } = state;

  const handleAuthSuccess = useCallback(() => {
    aiStore.error = null;
  }, [aiStore]);

  return (
    <div className="AiChatPanel">
      <div className="AiChatHeader">
        <Typography.Text strong>AI Assistant</Typography.Text>
        <div className="AiChatHeaderActions">
          {aiStore.messages.length > 0 && (
            <Tooltip title="Clear conversation">
              <Button
                size="small"
                icon={<ClearOutlined />}
                onClick={() => aiStore.reset()}
              />
            </Tooltip>
          )}
          <Tooltip title="Close (⌘L)">
            <Button
              size="small"
              icon={<CloseOutlined />}
              onClick={() => state.toggleAiSidebar()}
            />
          </Tooltip>
        </div>
      </div>
      {getErrorAlert(aiStore.error, handleAuthSuccess)}
      {aiStore.codebasePaths.length === 0 && aiStore.messages.length === 0 && (
        <Alert
          type="info"
          showIcon
          className="AiErrorBanner"
          icon={<FolderOpenOutlined />}
          message="No codebase directories configured"
          description={
            <Typography.Text type="secondary">
              Add a codebase directory in Preferences to let the AI read source
              files alongside your logs.
            </Typography.Text>
          }
        />
      )}
      <AiMessageList messages={aiStore.messages} />
      <AiInputArea state={state} />
    </div>
  );
});

export { AiChatPanel };
