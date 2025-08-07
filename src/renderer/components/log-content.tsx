import { isLogFile, isUnzippedFile } from '../../utils/is-logfile';
import { ProcessedLogFile, LogType } from '../../interfaces';
import { StateTable } from './state-table';
import { SleuthState } from '../state/sleuth';
import { LogTable } from './log-table';
import { observer } from 'mobx-react';
import React, { useState, useCallback } from 'react';

import { LogLineDetails } from './log-line-details/details';
import { Scrubber } from './scrubber';
import { getFontForCSS } from './preferences/preferences-utils';
import { getTypeForFile } from '../../utils/get-file-types';
import { NetLogView } from './net-log-view';
import { LogTimeView } from './log-time-view';
import { DevtoolsView } from './devtools-view';
import { Filter } from './app-core-header-filter';

export interface LogContentProps {
  state: SleuthState;
}

export interface LogContentState {
  tableHeight?: number;
}

export const LogContent = observer((props: LogContentProps) => {
  const [tableHeight, setTableHeight] = useState<number>(600);

  const resizeHandler = useCallback((height: number) => {
    if (height < 100 || height > window.innerHeight - 100) return;
    setTableHeight(height);
  }, []);

  const {
    selectedLogFile,
    levelFilter,
    search,
    dateTimeFormat_v3: dateTimeFormat,
    font,
    showOnlySearchResults,
    searchIndex,
    searchList,
    dateRange,
    selectedEntry,
  } = props.state;

  if (!selectedLogFile) return null;

  const isLog = isLogFile(selectedLogFile);
  const scrubber = (
    <Scrubber
      elementSelector="LogTableContainer"
      onResizeHandler={resizeHandler}
    />
  );

  // In most cases, we're dealing with a log file
  if (isLog) {
    return (
      <div className="LogContent" style={{ fontFamily: getFontForCSS(font) }}>
        <div className="AppHeader">
          <Filter state={props.state} />
        </div>
        <div id="LogTableContainer" style={{ height: tableHeight }}>
          <LogTable
            state={props.state}
            dateTimeFormat={dateTimeFormat}
            logFile={selectedLogFile as ProcessedLogFile}
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
    );
  }

  // If we're not a log file, we're probably a state file
  if (isUnzippedFile(selectedLogFile)) {
    const logType = getTypeForFile(selectedLogFile);

    if (logType === LogType.NETLOG) {
      return <NetLogView file={selectedLogFile} state={props.state} />;
    } else if (logType === LogType.TRACE) {
      return <DevtoolsView file={selectedLogFile} state={props.state} />;
    }
  }

  return <StateTable state={props.state} />;
});
