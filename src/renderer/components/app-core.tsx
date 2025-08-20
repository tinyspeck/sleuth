import { observer } from 'mobx-react';
import React, { useState, useCallback, useEffect } from 'react';
import classNames from 'classnames';

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
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [loadedLogFiles, setLoadedLogFiles] = useState<boolean>(false);

  /**
   * Take an array of processed files (for logs) or unzipped files (for state files)
   * and add them to the state of this component.
   */
  const addFilesToState = useCallback(
    (filesToAdd: Partial<ProcessedLogFiles>) => {
      setProcessedLogFiles((currentProcessedLogFiles) => {
        const newProcessedLogFiles: ProcessedLogFiles = {
          ...currentProcessedLogFiles,
        };

        for (const [type, filesOfType] of Object.entries(filesToAdd)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const currentState = currentProcessedLogFiles[
            type as keyof ProcessedLogFiles
          ] as Array<any>;
          newProcessedLogFiles[type as keyof ProcessedLogFiles] =
            currentState.concat(filesOfType);
        }

        return newProcessedLogFiles;
      });
    },
    [],
  );

  /**
   * Process files - most of the work happens over in ../processor.ts.
   */
  const processFiles = async () => {
    const { unzippedFiles, state } = props;

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
    const { state: stateFiles, netlog, trace } = sortedUnzippedFiles;
    const rawLogFiles = {
      [STATE]: stateFiles,
      [NETLOG]: netlog,
      [TRACE]: trace,
    };

    addFilesToState(rawLogFiles);

    console.time('process-files');
    // process log files
    for (const type of LOG_TYPES_TO_PROCESS) {
      const preFiles = sortedUnzippedFiles[type];
      const files = await processLogFiles(preFiles, (message) => {
        setLoadingMessage(message);
      });
      const delta: Partial<ProcessedLogFiles> = {};

      delta[type] = files as ProcessedLogFile[];
      addFilesToState(delta);
    }
    // also process state files
    for (const stateFile of rawLogFiles[STATE]) {
      const content = await window.Sleuth.readStateFile(stateFile);
      if (content) {
        state.stateFiles[stateFile.fileName] = content;
      }
    }
    console.timeEnd('process-files');

    // Get the latest processedLogFiles after all updates
    setProcessedLogFiles((currentFiles) => {
      // Update the global state with our processed files
      state.processedLogFiles = currentFiles;

      // Set a selected log file if none exists
      if (!state.selectedLogFile) {
        state.selectedLogFile = getFirstLogFile(currentFiles);
      }

      // Start merging files
      const { setMergedFile } = state;

      // Use the currentFiles that we just captured in the functional update
      mergeLogFiles(currentFiles.browser, LogType.BROWSER).then(setMergedFile);
      mergeLogFiles(currentFiles.webapp, LogType.WEBAPP).then(setMergedFile);

      // When both browser and webapp are merged, merge them together
      Promise.all([
        mergeLogFiles(currentFiles.browser, LogType.BROWSER),
        mergeLogFiles(currentFiles.webapp, LogType.WEBAPP),
      ]).then(() => {
        const merged = state.mergedLogFiles as MergedLogFiles;
        if (merged?.browser && merged?.webapp) {
          const toMerge = [merged.browser, merged.webapp];
          mergeLogFiles(toMerge, LogType.ALL).then(setMergedFile);
        }
      });

      return currentFiles;
    });

    // Mark as loaded
    setLoadedLogFiles(true);

    // Finish up with bookmarks and performance logging
    rehydrateBookmarks(state);
    flushLogPerformance();
  };

  useEffect(() => {
    processFiles();
  }, []);

  /**
   * Returns a rounded percentage number for our init process.
   *
   * @returns {number} Percentage loaded
   */
  const getPercentageLoaded = useCallback((): number => {
    const { unzippedFiles } = props;
    const alreadyLoaded = Object.keys(processedLogFiles)
      .map((k: keyof ProcessedLogFiles) => processedLogFiles[k])
      .reduce((p, c) => p + (c ? c.length : 0), 0);
    const toLoad = unzippedFiles.length;

    return Math.round((alreadyLoaded / toLoad) * 100);
  }, [props.unzippedFiles, processedLogFiles]);

  /**
   * Renders both the sidebar as well as the Spotlight-like omnibar.
   *
   * @returns {JSX.Element}
   */
  const renderSidebarSpotlight = useCallback((): JSX.Element => {
    return (
      <>
        <Sidebar state={props.state} />
        <Spotlight state={props.state} />
      </>
    );
  }, [props.state]);

  /**
   * Render the loading indicator.
   */
  const renderLoading = useCallback((): JSX.Element => {
    const percentageLoaded = getPercentageLoaded();

    return (
      <div className="AppCore">
        <div id="content">
          <Loading percentage={percentageLoaded} message={loadingMessage} />
        </div>
      </div>
    );
  }, [getPercentageLoaded, loadingMessage]);

  /**
   * Render the actual content (when loaded).
   */
  const renderContent = useCallback((): JSX.Element => {
    const { isSidebarOpen } = props.state;
    const logContentClassName = classNames({ isSidebarOpen });

    return (
      <div className="AppCore">
        {renderSidebarSpotlight()}

        <div id="content" className={logContentClassName}>
          <LogContent state={props.state} />
        </div>
      </div>
    );
  }, [props.state, renderSidebarSpotlight]);

  return loadedLogFiles ? renderContent() : renderLoading();
});
