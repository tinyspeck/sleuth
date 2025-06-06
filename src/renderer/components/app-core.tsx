import { observer } from 'mobx-react';
import React from 'react';
import classNames from 'classnames';

import { getFirstLogFile } from '../../utils/get-first-logfile';
import { SleuthState } from '../state/sleuth';
import {
  LevelFilter,
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

export interface CoreAppState {
  processedLogFiles: ProcessedLogFiles;
  loadingMessage: string;
  loadedLogFiles: boolean;
  loadedMergeFiles: boolean;
  filter: LevelFilter;
  search?: string;
}

@observer
export class CoreApplication extends React.Component<
  CoreAppProps,
  Partial<CoreAppState>
> {
  constructor(props: CoreAppProps) {
    super(props);

    this.state = {
      processedLogFiles: {
        browser: [],
        webapp: [],
        state: [],
        installer: [],
        netlog: [],
        trace: [],
        mobile: [],
        chromium: [],
      },
      loadingMessage: '',
      loadedLogFiles: false,
      loadedMergeFiles: false,
    };
  }

  /**
   * Once the component has mounted, we'll start processing files.
   */
  public componentDidMount() {
    this.processFiles();
  }

  public render() {
    return this.state.loadedLogFiles
      ? this.renderContent()
      : this.renderLoading();
  }

  /**
   * Take an array of processed files (for logs) or unzipped files (for state files)
   * and add them to the state of this component.
   */
  private addFilesToState(filesToAdd: Partial<ProcessedLogFiles>) {
    const { processedLogFiles } = this.state;

    if (!processedLogFiles) {
      return;
    }

    const newProcessedLogFiles: ProcessedLogFiles = { ...processedLogFiles };

    for (const [type, filesOfType] of Object.entries(filesToAdd)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentState = processedLogFiles[
        type as keyof ProcessedLogFiles
      ] as Array<any>;
      newProcessedLogFiles[type as keyof ProcessedLogFiles] =
        currentState.concat(filesOfType);
    }

    this.setState({
      processedLogFiles: newProcessedLogFiles,
    });
  }

  /**
   * Process files - most of the work happens over in ../processor.ts.
   */
  private async processFiles() {
    const { unzippedFiles } = this.props;

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

    this.addFilesToState(rawLogFiles);

    console.time('process-files');
    // process log files
    for (const type of LOG_TYPES_TO_PROCESS) {
      const preFiles = sortedUnzippedFiles[type];
      const files = await processLogFiles(preFiles, (loadingMessage) => {
        this.setState({ loadingMessage });
      });
      const delta: Partial<ProcessedLogFiles> = {};

      delta[type] = files as ProcessedLogFile[];
      this.addFilesToState(delta);
    }
    // also process state files
    for (const stateFile of rawLogFiles[STATE]) {
      const content = await window.Sleuth.readStateFile(stateFile);
      if (content) {
        this.props.state.stateFiles[stateFile.fileName] = content;
      }
    }
    console.timeEnd('process-files');

    const { processedLogFiles } = this.state;
    const { selectedLogFile } = this.props.state;

    this.props.state.processedLogFiles = processedLogFiles;

    if (!selectedLogFile && processedLogFiles) {
      this.props.state.selectedLogFile = getFirstLogFile(processedLogFiles);
    }
    this.setState({ loadedLogFiles: true });

    // We're done processing the files, so let's get started on the merge files.
    const { setMergedFile } = this.props.state;

    if (processedLogFiles) {
      await mergeLogFiles(processedLogFiles.browser, LogType.BROWSER).then(
        setMergedFile,
      );
      await mergeLogFiles(processedLogFiles.webapp, LogType.WEBAPP).then(
        setMergedFile,
      );

      const merged = this.props.state.mergedLogFiles as MergedLogFiles;
      const toMerge = [merged.browser, merged.webapp];

      mergeLogFiles(toMerge, LogType.ALL).then((r) => setMergedFile(r));
    }

    rehydrateBookmarks(this.props.state);
    flushLogPerformance();
  }

  /**
   * Returns a rounded percentage number for our init process.
   *
   * @returns {number} Percentage loaded
   */
  private getPercentageLoaded(): number {
    const { unzippedFiles } = this.props;
    const processedLogFiles: Partial<ProcessedLogFiles> =
      this.state.processedLogFiles || {};
    const alreadyLoaded = Object.keys(processedLogFiles)
      .map((k: keyof ProcessedLogFiles) => processedLogFiles[k])
      .reduce((p, c) => p + (c ? c.length : 0), 0);
    const toLoad = unzippedFiles.length;

    return Math.round((alreadyLoaded / toLoad) * 100);
  }

  /**
   * Renders both the sidebar as well as the Spotlight-like omnibar.
   *
   * @returns {JSX.Element}
   */
  private renderSidebarSpotlight(): JSX.Element {
    return (
      <>
        <Sidebar state={this.props.state} />
        <Spotlight state={this.props.state} />
      </>
    );
  }

  /**
   * Render the loading indicator.
   *
   * @returns {JSX.Element}
   */
  private renderLoading() {
    const { loadingMessage } = this.state;
    const percentageLoaded = this.getPercentageLoaded();

    return (
      <div className="AppCore">
        <div id="content">
          <Loading percentage={percentageLoaded} message={loadingMessage} />
        </div>
      </div>
    );
  }

  /**
   * Render the actual content (when loaded).
   *
   * @returns {JSX.Element}
   */
  private renderContent(): JSX.Element {
    const { isSidebarOpen } = this.props.state;
    const logContentClassName = classNames({ isSidebarOpen });

    return (
      <div className="AppCore">
        {this.renderSidebarSpotlight()}

        <div id="content" className={logContentClassName}>
          <LogContent state={this.props.state} />
        </div>
      </div>
    );
  }
}
