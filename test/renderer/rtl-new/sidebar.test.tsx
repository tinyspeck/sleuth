import React from 'react';
import { describe, it, vi, expect } from 'vitest';
import { Sidebar } from '../../../src/renderer/components/sidebar';
import { render, screen } from '@testing-library/react';
import { SleuthState } from '../../../src/renderer/state/sleuth';
import {
  ProcessedLogFile,
  ProcessedLogFiles,
  LogType,
} from '../../../src/interfaces';
import { fakeUnzippedFile } from '../../../__mocks__/unzipped-file';

vi.mock('electron');

const fakeFile1: ProcessedLogFile = {
  repeatedCounts: {},
  id: '123',
  logEntries: [],
  logFile: fakeUnzippedFile,
  logType: LogType.BROWSER,
  type: 'ProcessedLogFile',
  levelCounts: {},
};

const fakeFile2: ProcessedLogFile = {
  repeatedCounts: {},
  id: '1234',
  logEntries: [],
  logFile: fakeUnzippedFile,
  logType: LogType.CHROMIUM,
  type: 'ProcessedLogFile',
  levelCounts: {},
};

const fakeFile3: ProcessedLogFile = {
  repeatedCounts: {},
  id: '12345',
  logEntries: [],
  logFile: fakeUnzippedFile,
  logType: LogType.WEBAPP,
  type: 'ProcessedLogFile',
  levelCounts: {},
};

const files: ProcessedLogFiles = {
  browser: [fakeFile1],
  webapp: [fakeFile3],
  state: [],
  netlog: [],
  installer: [],
  trace: [],
  mobile: [],
  chromium: [fakeFile2],
};

describe('sidebar', () => {
  it('hides the sidebar log types that dont have files in them', async () => {
    const state: Partial<SleuthState> = {
      processedLogFiles: files,
    };

    render(
      <Sidebar selectedLogFileName={'test'} state={state as SleuthState} />,
    );

    const chromium = await screen.findByText('Chromium');
    expect(chromium).toBeInTheDocument();

    const webapp = await screen.findByText('WebApp');
    expect(webapp).toBeInTheDocument();

    const browser = await screen.findByText('Browser Process');
    expect(browser).toBeInTheDocument();

    const all = await screen.findByText('All Desktop Logs');
    expect(all).toBeInTheDocument();

    const mobile = screen.queryByText('Mobile');
    expect(mobile).not.toBeInTheDocument();

    const installer = screen.queryByText('Installer');
    expect(installer).not.toBeInTheDocument();
  });
});
