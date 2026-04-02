import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from '../../../src/renderer/components/sidebar/sidebar';
import { render, screen } from '@testing-library/react';
import { SleuthState } from '../../../src/renderer/state/sleuth';
import { ProcessedLogFile, LogType } from '../../../src/interfaces';
import { fakeUnzippedFile } from '../../../__mocks__/unzipped-file';

vi.mock(
  '../../../src/renderer/components/preferences/preferences-utils',
  () => {
    return {
      FONTS: ['Arial'],
      WINDOWS_FONTS: ['Arial'],
      MACOS_FONTS: ['Arial'],
      THEMES: {
        DARK: 'dark',
        LIGHT: 'light',
        AUTO: 'auto',
      },
      DATE_TIME_FORMATS: ['HH:mm:ss (dd/MM)'],
      EDITORS: {
        VSCODE: {
          name: 'VSCode',
          cmd: 'code',
          args: ['--goto', '{filepath}:{line}'],
        },
      },
      getFontForCSS: () => 'Arial',
    };
  },
);

const defaultLogTypeFilter = {
  browser: true,
  epic_traces: true,
  webapp: true,
  service_worker: true,
  chromium: true,
  installer: true,
  mobile: true,
};

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

describe('Sidebar', () => {
  describe('File Tree', () => {
    it('shows checkboxes only for log types that have files', async () => {
      const state: Partial<SleuthState> = {
        processedLogFiles: {
          browser: [fakeFile1],
          epic_traces: [],
          webapp: [fakeFile3],
          service_worker: [],
          state: [],
          netlog: [],
          installer: [],
          trace: [],
          mobile: [],
          chromium: [fakeFile2],
        },
        logTypeFilter: defaultLogTypeFilter,
        bookmarks: [],
      };

      render(<Sidebar state={state as SleuthState} />);

      const chromium = await screen.findByText('Chromium');
      expect(chromium).toBeInTheDocument();

      const webapp = await screen.findByText('WebApp');
      expect(webapp).toBeInTheDocument();

      const browser = await screen.findByText('Browser Process');
      expect(browser).toBeInTheDocument();

      const installer = screen.queryByText('Installer');
      expect(installer).not.toBeInTheDocument();
    });

    it('shows no log type checkboxes when no processable files exist', async () => {
      const state: Partial<SleuthState> = {
        processedLogFiles: {
          browser: [],
          epic_traces: [],
          webapp: [],
          service_worker: [],
          state: [],
          netlog: [],
          installer: [],
          trace: [],
          mobile: [],
          chromium: [],
        },
        logTypeFilter: defaultLogTypeFilter,
        bookmarks: [],
      };

      render(<Sidebar state={state as SleuthState} />);

      const browser = screen.queryByText('Browser Process');
      expect(browser).not.toBeInTheDocument();

      const webapp = screen.queryByText('WebApp');
      expect(webapp).not.toBeInTheDocument();
    });

    it('is hidden if `isSidebarOpen` is false', async () => {
      const state: Partial<SleuthState> = {
        processedLogFiles: {
          browser: [fakeFile1],
          epic_traces: [],
          webapp: [],
          service_worker: [],
          state: [],
          netlog: [],
          installer: [],
          trace: [],
          mobile: [],
          chromium: [],
        },
        logTypeFilter: defaultLogTypeFilter,
        bookmarks: [],
        isSidebarOpen: false,
      };

      render(<Sidebar state={state as SleuthState} />);
      const fileTree = document.querySelector('.SidebarFileTree');
      expect(fileTree).toBeInTheDocument();
      expect(fileTree).not.toHaveClass('Open');
    });

    it('shows all four desktop log types when files exist for each', async () => {
      const installerFile: ProcessedLogFile = {
        repeatedCounts: {},
        id: 'inst1',
        logEntries: [],
        logFile: fakeUnzippedFile,
        logType: LogType.INSTALLER,
        type: 'ProcessedLogFile',
        levelCounts: {},
      };

      const state: Partial<SleuthState> = {
        processedLogFiles: {
          browser: [fakeFile1],
          epic_traces: [],
          webapp: [fakeFile3],
          service_worker: [],
          state: [],
          netlog: [],
          installer: [installerFile],
          trace: [],
          mobile: [],
          chromium: [fakeFile2],
        },
        logTypeFilter: defaultLogTypeFilter,
        bookmarks: [],
      };

      render(<Sidebar state={state as SleuthState} />);

      expect(await screen.findByText('Browser Process')).toBeInTheDocument();
      expect(await screen.findByText('WebApp')).toBeInTheDocument();
      expect(await screen.findByText('Chromium')).toBeInTheDocument();
      expect(await screen.findByText('Installer')).toBeInTheDocument();
    });
  });
});
