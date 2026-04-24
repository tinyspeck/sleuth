import { observer } from 'mobx-react';
import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import debug from 'debug';

import { SleuthState } from '../state/sleuth';
import {
  MergedLogFile,
  MergedLogFiles,
  ProcessedLogFiles,
  LogType,
  LOG_TYPES_TO_PROCESS,
  SortedUnzippedFiles,
  UnzippedFiles,
  ProcessedLogFile,
} from '../../interfaces';
import { applyLiveTailUpdate } from '../live-tail';
import { Sidebar } from './sidebar/sidebar';
import { Loading } from './loading';
import { LogContent } from './log-content';
import { flushLogPerformance } from '../processor/performance';
import { rehydrateBookmarks } from '../state/bookmarks';
import { getTypeForFile, getTypesForFiles } from '../../utils/get-file-types';
import { mergeLogFiles, processLogFiles } from '../processor';

const d = debug('sleuth:app-core');

const MERGE_CANDIDATES = [
  { key: 'browser', type: LogType.BROWSER },
  { key: 'rx_epic', type: LogType.RX_EPIC },
  { key: 'webapp', type: LogType.WEBAPP },
  { key: 'webapp_sw', type: LogType.SERVICE_WORKER },
  { key: 'chromium', type: LogType.CHROMIUM },
  { key: 'installer', type: LogType.INSTALLER },
] as const;

export interface CoreAppProps {
  state: SleuthState;
  unzippedFiles: UnzippedFiles;
}

export const CoreApplication = observer((props: CoreAppProps) => {
  const [processedLogFiles, setProcessedLogFiles] = useState<ProcessedLogFiles>(
    {
      browser: [],
      rx_epic: [],
      webapp: [],
      webapp_sw: [],
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
  const liveTailCleanupRef = useRef<(() => void) | null>(null);

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
        // oxlint-disable-next-line @typescript-eslint/no-explicit-any
        const currentState = current[
          type as keyof ProcessedLogFiles
        ] as Array<any>;
        newProcessedLogFiles[type as keyof ProcessedLogFiles] =
          currentState.concat(filesOfType);
      }

      processedLogFilesRef.current = newProcessedLogFiles;
      setProcessedLogFiles(newProcessedLogFiles);
    }

    /** Create empty ProcessedLogFile/MergedLogFile shells and register the live tail update listener. */
    async function processFilesLiveTail(
      sortedUnzippedFiles: SortedUnzippedFiles,
      addFiles: typeof addFilesToState,
    ) {
      for (const { key } of MERGE_CANDIDATES) {
        const unzippedOfType = sortedUnzippedFiles[key];
        const shells: ProcessedLogFile[] = unzippedOfType.map((file) => ({
          id: file.fullPath,
          type: 'ProcessedLogFile' as const,
          levelCounts: {},
          repeatedCounts: {},
          logEntries: [],
          logFile: file,
          logType: getTypeForFile(file) as ProcessedLogFile['logType'],
        }));
        addFiles({ [key]: shells });
      }

      const currentProcessed = processedLogFilesRef.current;
      props.state.processedLogFiles = currentProcessed;

      const { setMergedFile } = props.state;
      const perTypeMerged: MergedLogFile[] = [];

      for (const { key, type } of MERGE_CANDIDATES) {
        const files = (
          currentProcessed[
            key as keyof typeof currentProcessed
          ] as ProcessedLogFile[]
        ).filter((f) => 'logEntries' in f);

        if (files.length === 0) continue;

        const merged: MergedLogFile = {
          id: type,
          type: 'MergedLogFile',
          logFiles: files,
          logEntries: [],
          logType: type,
        };
        setMergedFile(merged);
        perTypeMerged.push(merged);
      }

      if (perTypeMerged.length > 0) {
        const allFiles = perTypeMerged.flatMap((m) => m.logFiles);
        const allMerged: MergedLogFile = {
          id: LogType.ALL,
          type: 'MergedLogFile',
          logFiles: allFiles,
          logEntries: [],
          logType: LogType.ALL,
        };
        setMergedFile(allMerged);
        props.state.selectAllLogs();
      }

      setLoadedLogFiles(true);

      liveTailCleanupRef.current = window.Sleuth.setupLiveTailUpdate(
        (_event, payload) => {
          applyLiveTailUpdate(props.state, payload);
        },
      );
    }

    /** Parse, process, and merge log files for the standard (non-live-tail) flow. */
    async function processFilesNormal(
      sortedUnzippedFiles: SortedUnzippedFiles,
      userTZ: string | undefined,
      addFiles: typeof addFilesToState,
    ) {
      console.time('process-files');

      const results = await Promise.allSettled(
        LOG_TYPES_TO_PROCESS.map(async (type) => {
          const preFiles = sortedUnzippedFiles[type];
          const files = await processLogFiles(preFiles, userTZ, (msg) => {
            setLoadingMessage(msg);
          });
          return { type, files };
        }),
      );

      const failedTypes: string[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') {
          const { type, files } = r.value;
          addFiles({ [type]: files as ProcessedLogFile[] });

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
        } else {
          const type = LOG_TYPES_TO_PROCESS[i];
          const reason = r.reason;
          console.error(`Failed to process ${type} log files:`, reason);
          d(`Failed to process ${type} log files:`, reason);
          failedTypes.push(type);
        }
      }

      if (failedTypes.length > 0) {
        window.Sleuth.showMessageBox({
          title: 'Some logs failed to process',
          message: `The following log types could not be processed: ${failedTypes.join(', ')}. Some data may be missing.`,
          type: 'warning',
        });
      }
      console.timeEnd('process-files');

      const currentProcessed = processedLogFilesRef.current;
      props.state.processedLogFiles = currentProcessed;

      const { setMergedFile } = props.state;

      if (currentProcessed) {
        const toProcess = MERGE_CANDIDATES.map(({ key, type }) => {
          const files = (
            currentProcessed[
              key as keyof typeof currentProcessed
            ] as ProcessedLogFile[]
          ).filter((f) => 'logEntries' in f);
          return { key, type, files };
        }).filter(({ files }) => files.length > 0);
        const mergeResults = await Promise.allSettled(
          toProcess.map(({ files, type }) => mergeLogFiles(files, type)),
        );

        const failedMergeTypes: string[] = [];
        for (let i = 0; i < mergeResults.length; i++) {
          const result = mergeResults[i];
          if (result.status === 'fulfilled') {
            setMergedFile(result.value);
          } else {
            const type = toProcess[i].key;
            console.error(`Failed to merge ${type} log files:`, result.reason);
            failedMergeTypes.push(type);
          }
        }

        if (failedMergeTypes.length > 0) {
          window.Sleuth.showMessageBox({
            title: 'Some logs failed to merge',
            message: `The following log types could not be merged: ${failedMergeTypes.join(', ')}. The combined view may be incomplete.`,
            type: 'warning',
          });
        }

        const merged = props.state.mergedLogFiles;
        const toMerge = [
          merged?.browser,
          merged?.rx_epic,
          merged?.webapp,
          merged?.webapp_sw,
          merged?.chromium,
          merged?.installer,
        ].filter(Boolean) as MergedLogFiles[keyof MergedLogFiles][];

        if (toMerge.length > 0) {
          const allMerged = await mergeLogFiles(toMerge, LogType.ALL);
          setMergedFile(allMerged);
          props.state.selectAllLogs();
        } else {
          const firstFile =
            currentProcessed.installer[0] ??
            currentProcessed.mobile[0] ??
            currentProcessed.chromium[0] ??
            currentProcessed.netlog[0] ??
            currentProcessed.state[0];
          if (firstFile) {
            props.state.selectFile(firstFile);
          }
        }
      }

      setLoadedLogFiles(true);
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

        if (props.state.isLiveTailActive) {
          await processFilesLiveTail(sortedUnzippedFiles, addFilesToState);
        } else {
          await processFilesNormal(
            sortedUnzippedFiles,
            userTZ,
            addFilesToState,
          );
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

    return () => {
      liveTailCleanupRef.current?.();
      liveTailCleanupRef.current = null;
    };
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
      <div id="content" className={logContentClassName}>
        <LogContent state={props.state} />
      </div>
    </div>
  );
});
