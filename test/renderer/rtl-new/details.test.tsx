import React from 'react';
import { observable } from 'mobx';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LogLineDetails } from '../../../src/renderer/components/log-line-details/details';
import { SleuthState } from '../../../src/renderer/state/sleuth';
import { LogLevel, LogType } from '../../../src/interfaces';

const mockLogEntry = {
  isDetailsVisible: true,
  selectedEntry: {
    index: 10,
    timestamp: '2022-01-01T00:00:00Z',
    message: 'Test log message',
    level: LogLevel.info,
    logType: LogType.BROWSER,
    line: 1,
    sourceFile: 'browser.log',
    meta: 'Test meta',
    momentValue: 1672531200000,
  },
} as SleuthState;

describe('Details', () => {
  it('should be visible when isDetailsVisible is true', () => {
    const state = observable(mockLogEntry);
    render(<LogLineDetails state={state} />);

    expect(screen.getByLabelText('Log Line Details')).toBeVisible();
  });

  it('should not be visible when isDetailsVisible is false', () => {
    const state = observable({
      ...mockLogEntry,
      isDetailsVisible: false,
    } as SleuthState);
    render(<LogLineDetails state={state} />);

    expect(screen.queryByLabelText('Log Line Details')).not.toBeInTheDocument();
  });

  it('should show key log entry details', () => {
    const state = observable(mockLogEntry);
    render(<LogLineDetails state={state} />);

    expect(screen.getByText('Test log message')).toBeVisible();
    expect(screen.getByText('Test meta')).toBeVisible();
    expect(screen.getByText('level:info')).toBeVisible();
    expect(screen.getByText('process:browser')).toBeVisible();
  });

  it('closes the details pane when button is clicked', () => {
    const state = observable(mockLogEntry);
    render(<LogLineDetails state={state} />);

    const closeButton = screen.getByRole('button', { name: 'Close' });
    expect(closeButton).toBeVisible();
    closeButton.click();

    expect(screen.queryByLabelText('Log Line Details')).not.toBeInTheDocument();
  });
});
