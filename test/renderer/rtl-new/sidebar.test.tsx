import React from "react";
import { Sidebar } from "../../../src/renderer/components/sidebar"
import { render, screen } from '@testing-library/react'
import { SleuthState } from "../../../src/renderer/state/sleuth";
import { ProcessedLogFile, ProcessedLogFiles, LogType, MergedFilesLoadStatus } from "../../../src/interfaces";
import { fakeUnzippedFile } from '../../__mocks__/unzipped-file';

jest.mock('electron')

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
	levelCounts: {}
}

const fakeFile3: ProcessedLogFile = {
	repeatedCounts: {},
	id: '12345',
	logEntries: [],
	logFile: fakeUnzippedFile,
	logType: LogType.WEBAPP,
	type: 'ProcessedLogFile',
	levelCounts: {}
}
  
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
	it('hides the sidebar log types that dont have files in them', () => {
		const state: Partial<SleuthState> = {
			processedLogFiles: files,
		}

		const mergedFilesStatus: MergedFilesLoadStatus = {
			all: true,
			browser: false,
			webapp: false,
			mobile: false
		}

		const selectedLogFileName: string = 'trace'

		render(<Sidebar mergedFilesStatus={mergedFilesStatus} selectedLogFileName={selectedLogFileName} state={state as SleuthState} />)

		const chromium = screen.getAllByText('Chromium')
		expect(chromium).toHaveLength(1)

		const webapp = screen.getAllByText('WebApp')
		expect(webapp).toHaveLength(1)

		const browser = screen.getAllByText('Browser Process')
		expect(browser).toHaveLength(1)

		const all = screen.getAllByText('All Desktop Logs')
		expect(all).toHaveLength(1)

		const mobile = screen.queryByText('Mobile')
		expect(mobile).not.toBeInTheDocument

		const installer = screen.queryByText('Installer')
		expect(installer).not.toBeInTheDocument
	});
})