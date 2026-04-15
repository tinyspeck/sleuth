import React, { useCallback, useRef, useState } from 'react';
import { observer } from 'mobx-react';

import { isLogFile, isUnzippedFile } from '../../utils/is-logfile';
import { Scrubber } from './scrubber';
import { getFontForCSS } from './preferences/preferences-utils';
import { LogTable } from './log-table';
import { StateTable } from './state-table';
import { SleuthState } from '../state/sleuth';
import { LogFile, LogType, TRACE_VIEWER } from '../../interfaces';
import { getTypeForFile } from '../../utils/get-file-types';
import { LogLineDetails } from './log-line-details/details';
import { LogTimeView } from './log-time-view';
import { NetLogView } from './net-log-view';
import { DevtoolsView } from './devtools-view';
import { PerfettoView } from './perfetto-view';
import { StateDashboard } from './state-dashboard';
import { Filter } from './app-core-header-filter';

class DashboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      'StateDashboard render error:',
      error,
      errorInfo.componentStack,
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div className="DashboardError">
          <h3>Summary dashboard failed to render</h3>
          <p>Select a state file from the sidebar to view it individually.</p>
          <pre>{this.state.error.message}</pre>
          <details>
            <summary>Stack trace</summary>
            <pre className="DashboardError-stack">{this.state.error.stack}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface LogContentProps {
  state: SleuthState;
}

export const LogContent = observer((props: LogContentProps) => {
  const [tableHeight, setTableHeight] = useState(600);
  // Keep a ref to the last valid log file so the hidden LogTable always
  // receives a proper LogFile even when selectedFile is a state/netlog/trace file.
  const lastLogFileRef = useRef<LogFile | null>(null);

  const resizeHandler = useCallback((height: number) => {
    if (height < 100 || height > window.innerHeight - 100) return;
    setTableHeight(height);
  }, []);

  const {
    selectedFile,
    levelFilter,
    search,
    dateTimeFormat_v4: dateTimeFormat,
    font,
    showOnlySearchResults,
    searchIndex,
    searchList,
    dateRange,
    selectedEntry,
  } = props.state;

  if (props.state.showStateSummary) {
    return (
      <DashboardErrorBoundary>
        <StateDashboard state={props.state} />
      </DashboardErrorBoundary>
    );
  }

  if (!selectedFile) {
    lastLogFileRef.current = null;
    return null;
  }

  const isLog = isLogFile(selectedFile);
  if (isLog) {
    lastLogFileRef.current = selectedFile;
  }
  const logFileForTable = isLog ? selectedFile : lastLogFileRef.current;

  const isUnzipped = isUnzippedFile(selectedFile);
  const logType = isUnzipped ? getTypeForFile(selectedFile) : null;
  const isNetlog = logType === LogType.NETLOG;
  const isTrace = logType === LogType.TRACE;
  const isState = isUnzipped && !isNetlog && !isTrace;

  const scrubber = (
    <Scrubber
      elementSelector="LogTableContainer"
      onResizeHandler={resizeHandler}
    />
  );

  // Non-log views are rendered on-demand since they depend on the selected file
  let nonLogView: React.ReactNode = null;
  if (!isLog) {
    if (isNetlog) {
      nonLogView = <NetLogView file={selectedFile} state={props.state} />;
    } else if (isTrace) {
      nonLogView =
        props.state.selectedTraceViewer === TRACE_VIEWER.CHROME_DEVTOOLS ? (
          <DevtoolsView file={selectedFile} state={props.state} />
        ) : (
          <PerfettoView file={selectedFile} state={props.state} />
        );
    } else if (isState) {
      nonLogView = <StateTable state={props.state} />;
    }
  }

  return (
    <>
      {logFileForTable && (
        <div
          className="LogContent"
          style={{
            fontFamily: getFontForCSS(font),
            display: isLog ? undefined : 'none',
          }}
        >
          <div className="AppHeader">
            <Filter state={props.state} />
          </div>
          <div id="LogTableContainer" style={{ height: tableHeight }}>
            <LogTable
              state={props.state}
              dateTimeFormat={dateTimeFormat}
              logFile={logFileForTable}
              levelFilter={levelFilter}
              search={search}
              searchIndex={searchIndex}
              searchList={searchList}
              showOnlySearchResults={showOnlySearchResults}
              dateRange={dateRange}
              selectedEntry={selectedEntry}
            />
          </div>
          {scrubber}
          <LogLineDetails state={props.state} />
          <LogTimeView state={props.state} />
        </div>
      )}
      {nonLogView}
    </>
  );
});
