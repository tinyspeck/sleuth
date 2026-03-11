import { observer } from 'mobx-react';
import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import debug from 'debug';

import { getFirstLogFile } from '../../utils/get-first-logfile';
import { SleuthState } from '../state/sleuth';
import {
  MergedLogFiles,
  ProcessedLogFiles,
  LogType,
  LOG_TYPES_TO_PROCESS,
  SortedUnzippedFiles,
  UnzippedFiles,
  ProcessedLogFile,
} from '../../interfaces';
import { Sidebar } from './sidebar/sidebar';
import { Loading } from './loading';
import { LogContent } from './log-content';
import { flushLogPerformance } from '../processor/performance';
import { Spotlight } from './spotlight';
import { rehydrateBookmarks } from '../state/bookmarks';
import { getTypesForFiles } from '../../utils/get-file-types';
import { mergeLogFiles, processLogFiles } from '../processor';

const d = debug('sleuth:app-core');

export interface CoreAppProps {
  state: SleuthState;
  unzippedFiles: UnzippedFiles;
}

export const CoreApplication = observer((props: CoreAppProps) => {
  const [processedLogFiles, setProcessedLogFiles] = useState<ProcessedLogFiles>(
    {
      browser: [],
      webapp: [],
      state: [],
      installer: [],
      netlog: [],
      trace: [],
      mobile: [],
      chromium: [],
    },
  );
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadedLogFiles, setLoadedLogFiles] = useState(false);

  // Use a ref to track processedLogFiles inside the async processFiles
  // since setState is async and we need to accumulate updates
  const processedLogFilesRef = useRef(processedLogFiles);

  function getPercentageLoaded(): number {
    const current = processedLogFilesRef.current;
    const alreadyLoaded = Object.keys(current)
      .map((k: keyof ProcessedLogFiles) => current[k])
      .reduce((p, c) => p + (c ? c.length : 0), 0);
    const toLoad = props.unzippedFiles.length;

    return Math.round((alreadyLoaded / toLoad) * 100);
  }

  // Process files on mount. This intentionally runs once (like componentDidMount).
  // The props are captured at mount time and are stable for this component's lifetime.
  useEffect(() => {
    function addFilesToState(filesToAdd: Partial<ProcessedLogFiles>) {
      const current = processedLogFilesRef.current;
      const newProcessedLogFiles: ProcessedLogFiles = { ...current };

      for (const [type, filesOfType] of Object.entries(filesToAdd)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentState = current[
          type as keyof ProcessedLogFiles
        ] as Array<any>;
        newProcessedLogFiles[type as keyof ProcessedLogFiles] =
          currentState.concat(filesOfType);
      }

      processedLogFilesRef.current = newProcessedLogFiles;
      setProcessedLogFiles(newProcessedLogFiles);
    }

    async function processFiles() {
      try {
        const { unzippedFiles } = props;

        const sortedUnzippedFiles = getTypesForFiles(unzippedFiles);
        const noFiles = Object.keys(sortedUnzippedFiles)
          .map((k: keyof SortedUnzippedFiles) => sortedUnzippedFiles[k])
          .every((s) => s.length === 0);

        if (noFiles) {
          window.Sleuth.showMessageBox({
            title: 'Huh, weird logs!',
            message:
              'Sorry, Sleuth does not understand the file(s). It seems like there are no Slack logs here.\n\nCheck the #sleuth FAQ for help!',
            type: 'error',
          });

          // Reload
          window.location.reload();
        }

        // Collect
        const { STATE, NETLOG, TRACE } = LogType;
        const { state, netlog, trace } = sortedUnzippedFiles;
        const rawLogFiles = {
          [STATE]: state,
          [NETLOG]: netlog,
          [TRACE]: trace,
        };

        addFilesToState(rawLogFiles);

        console.time('process-files');
        // process state files first because we depend on `log-context.json` for log processing
        for (const stateFile of rawLogFiles[STATE]) {
          const content = await window.Sleuth.readStateFile(stateFile);
          if (content) {
            props.state.stateFiles[stateFile.fileName] = content;
          }
        }

        const userTZ = props.state.stateFiles['log-context.json']?.data
          ?.systemTZ as string | undefined;
        if (typeof userTZ === 'string') {
          d(`Processing logs with user timezone: ${userTZ}`);
        }

        // process log files second
        for (const type of LOG_TYPES_TO_PROCESS) {
          const preFiles = sortedUnzippedFiles[type];
          const files = await processLogFiles(preFiles, userTZ, (msg) => {
            setLoadingMessage(msg);
          });
          const delta: Partial<ProcessedLogFiles> = {};

          delta[type] = files as ProcessedLogFile[];
          addFilesToState(delta);

          // ShipItState.plist is a JSON file that should be read as state
          if (type === LogType.INSTALLER) {
            for (const file of files) {
              if (
                'fullPath' in file &&
                file.fileName.toLowerCase() === 'shipitstate.plist'
              ) {
                const content = await window.Sleuth.readStateFile(file);
                if (content) {
                  props.state.stateFiles[file.fileName] = content;
                }
              }
            }
          }
        }
        console.timeEnd('process-files');

        const currentProcessed = processedLogFilesRef.current;
        const { selectedLogFile } = props.state;

        props.state.processedLogFiles = currentProcessed;

        if (!selectedLogFile && currentProcessed) {
          props.state.selectedLogFile = getFirstLogFile(currentProcessed);
        }
        setLoadedLogFiles(true);

        // We're done processing the files, so let's get started on the merge files.
        const { setMergedFile } = props.state;

        if (currentProcessed) {
          await mergeLogFiles(currentProcessed.browser, LogType.BROWSER).then(
            setMergedFile,
          );
          await mergeLogFiles(currentProcessed.webapp, LogType.WEBAPP).then(
            setMergedFile,
          );

          const merged = props.state.mergedLogFiles as MergedLogFiles;
          const toMerge = [merged.browser, merged.webapp];

          mergeLogFiles(toMerge, LogType.ALL).then((r) => setMergedFile(r));
        }

        rehydrateBookmarks(props.state);
        flushLogPerformance();
      } catch (error) {
        console.error('Failed to process log files:', error);
        window.Sleuth.showMessageBox({
          title: 'Error Processing Logs',
          message: `Failed to process log files: ${
            error instanceof Error ? error.message : String(error)
          }`,
          type: 'error',
        });
      }
    }

    processFiles();
  }, []);

  if (!loadedLogFiles) {
    const percentageLoaded = getPercentageLoaded();

    return (
      <div className="AppCore">
        <div id="content">
          <Loading percentage={percentageLoaded} message={loadingMessage} />
        </div>
      </div>
    );
  }

  const { isSidebarOpen } = props.state;
  const logContentClassName = classNames({ isSidebarOpen });

  return (
    <div className="AppCore">
      <Sidebar state={props.state} />
      <Spotlight state={props.state} />

      <div id="content" className={logContentClassName}>
        <LogContent state={props.state} />
      </div>
    </div>
  );
});
