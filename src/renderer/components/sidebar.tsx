import React from 'react';
import classNames from 'classnames';
import {
  ITreeNode,
  Tree,
  Icon,
  Position,
  Tooltip,
  Intent,
} from '@blueprintjs/core';
import { observer } from 'mobx-react';

import {
  LogType,
  MergedFilesLoadStatus,
  ProcessedLogFile,
  SelectableLogType,
  Tool,
  UnzippedFile,
} from '../../interfaces';
import { levelsHave } from '../../utils/level-counts';
import { SleuthState } from '../state/sleuth';
import { isProcessedLogFile } from '../../utils/is-logfile';
import { countExcessiveRepeats } from '../../utils/count-excessive-repeats';
import { plural } from '../../utils/pluralize';
import { getRootStateWarnings } from '../analytics/root-state-analytics';
import { getTraceWarnings } from '../analytics/trace-analytics';
import { getEnvironmentWarnings } from '../analytics/environment-analytics';

export interface SidebarProps {
  selectedLogFileName: string;
  mergedFilesStatus: MergedFilesLoadStatus;
  state: SleuthState;
}

export interface SidebarState {
  nodes: Array<ITreeNode>;
}

export interface SidebarNodeData {
  file: UnzippedFile | ProcessedLogFile;
  type: SelectableLogType | Tool;
}

const enum NODE_ID {
  ALL = 'all-desktop',
  STATE = 'state',
  BROWSER = 'browser',
  TRACE = 'trace',
  WEBAPP = 'webapp',
  INSTALLER = 'installer',
  NETWORK = 'network',
  CACHE = 'cache',
  MOBILE = 'mobile',
  CHROMIUM = 'chromium',
}

const DEFAULT_NODES: Array<ITreeNode> = [
  {
    id: NODE_ID.STATE,
    hasCaret: true,
    icon: 'cog',
    label: 'State & Settings',
    isExpanded: true,
    childNodes: [],
  },
  {
    id: NODE_ID.ALL,
    hasCaret: false,
    label: 'All Desktop Logs',
    icon: 'compressed',
    nodeData: { type: LogType.ALL },
  },
  {
    id: NODE_ID.BROWSER,
    hasCaret: true,
    icon: 'application',
    label: 'Browser Process',
    isExpanded: true,
    childNodes: [],
    nodeData: { type: LogType.BROWSER },
  },
  {
    id: NODE_ID.TRACE,
    hasCaret: true,
    icon: 'applications',
    label: 'Trace',
    isExpanded: true,
    childNodes: [],
    nodeData: { type: LogType.TRACE },
  },
  {
    id: NODE_ID.CHROMIUM,
    hasCaret: true,
    icon: 'modal',
    label: 'Chromium',
    isExpanded: true,
  },
  {
    id: NODE_ID.WEBAPP,
    hasCaret: true,
    icon: 'chat',
    label: 'WebApp',
    isExpanded: true,
    childNodes: [],
    nodeData: { type: LogType.WEBAPP },
  },
  {
    id: NODE_ID.INSTALLER,
    hasCaret: true,
    icon: 'automatic-updates',
    label: 'Installer',
    isExpanded: true,
    childNodes: [],
  },
  {
    id: NODE_ID.NETWORK,
    hasCaret: true,
    icon: 'feed',
    label: 'Network',
    isExpanded: true,
    childNodes: [],
  },
  {
    id: NODE_ID.CACHE,
    hasCaret: false,
    icon: 'projects',
    label: 'Cache',
    nodeData: { type: 'cache' },
  },
  {
    id: NODE_ID.MOBILE,
    hasCaret: true,
    icon: 'mobile-phone',
    label: 'Mobile',
    isExpanded: true,
  },
];

@observer
export class Sidebar extends React.Component<SidebarProps, SidebarState> {
  public static getDerivedStateFromProps(
    props: SidebarProps,
    state: SidebarState,
  ) {
    const { processedLogFiles } = props.state;

    if (!processedLogFiles) return {};

    Sidebar.setChildNodes(
      NODE_ID.STATE,
      state,
      processedLogFiles.state.map((file) =>
        Sidebar.getStateFileNode(file, props),
      ),
    );
    Sidebar.setChildNodes(
      NODE_ID.BROWSER,
      state,
      processedLogFiles.browser.map((file) => Sidebar.getFileNode(file, props)),
    );
    Sidebar.setChildNodes(
      NODE_ID.WEBAPP,
      state,
      processedLogFiles.webapp.map((file) => Sidebar.getFileNode(file, props)),
    );
    Sidebar.setChildNodes(
      NODE_ID.INSTALLER,
      state,
      processedLogFiles.installer.map((file) =>
        Sidebar.getInstallerFileNode(file, props),
      ),
    );
    Sidebar.setChildNodes(
      NODE_ID.NETWORK,
      state,
      processedLogFiles.netlog.map((file, i) =>
        Sidebar.getNetlogFileNode(file, props, i),
      ),
    );
    Sidebar.setChildNodes(
      NODE_ID.MOBILE,
      state,
      processedLogFiles.mobile.map((file) => Sidebar.getFileNode(file, props)),
    );
    Sidebar.setChildNodes(
      NODE_ID.TRACE,
      state,
      processedLogFiles.trace.map((file) =>
        Sidebar.getStateFileNode(file, props),
      ),
    );
    Sidebar.setChildNodes(
      NODE_ID.CHROMIUM,
      state,
      processedLogFiles.chromium.map((file) =>
        Sidebar.getFileNode(file, props),
      ),
    );

    return { nodes: state.nodes };
  }

  /**
   * Returns a generic tree node, given all the parameters.
   *
   * @static
   * @param {string} id
   * @param {*} nodeData
   * @param {boolean} isSelected
   * @param {Partial<ITreeNode>} [options={}]
   * @returns {ITreeNode}
   */
  public static getNode(
    id: string,
    nodeData: Partial<SidebarNodeData>,
    isSelected: boolean,
    options: Partial<ITreeNode> = {},
  ): ITreeNode {
    return {
      id,
      label: id,
      isSelected,
      nodeData,
      icon: 'document',
      ...options,
    };
  }

  /**
   * Get a single tree node for a file.
   *
   * @static
   * @param {(ProcessedLogFile | UnzippedFile)} file
   * @param {SidebarProps} props
   * @returns {ITreeNode}
   */
  public static getFileNode(
    file: ProcessedLogFile | UnzippedFile,
    props: SidebarProps,
  ): ITreeNode {
    return isProcessedLogFile(file)
      ? Sidebar.getLogFileNode(file, props)
      : Sidebar.getStateFileNode(file, props);
  }

  /**
   * Returns a single tree node for an UnzippedFile (which are state files).
   *
   * @static
   * @param {UnzippedFile} file
   * @param {SidebarProps} props
   * @returns {ITreeNode}
   */
  public static getStateFileNode(
    file: UnzippedFile,
    props: SidebarProps,
  ): ITreeNode {
    const { selectedLogFileName } = props;
    const isSelected = selectedLogFileName === file.fileName;

    let label: string;
    if (
      file.fileName.endsWith('gpu-info.json') ||
      file.fileName.endsWith('gpu-info.html')
    ) {
      label = 'GPU';
    } else if (file.fileName.endsWith('notification-warnings.json')) {
      label = 'Notification Warnings';
    } else if (file.fileName.endsWith('environment.json')) {
      label = 'Environment';
    } else if (file.fileName.endsWith('local-settings.json')) {
      label = 'Local Settings';
    } else if (file.fileName.endsWith('.trace')) {
      label = 'Performance Profile';
    } else if (file.fileName.endsWith('root-state.json')) {
      label = 'Root State';
    } else if (file.fileName.endsWith('external-config.json')) {
      label = 'External Config';
    } else if (file.fileName.endsWith('logfiles-shipping-manifest.json')) {
      label = 'Log Manifest';
    } else if (file.fileName.endsWith('log-context.json')) {
      label = 'Log Context';
    } else if (file.fileName.endsWith('installation')) {
      label = 'Installation';
    } else {
      label = file.fileName;
    }

    const options: Partial<ITreeNode> = {
      secondaryLabel: this.getStateFileHint(file, props),
    };

    return Sidebar.getNode(label, { file }, isSelected, options);
  }

  /**
   * Returns a single tree node for an UnzippedFile (in this case, net logs).
   *
   * @static
   * @param {UnzippedFile} file
   * @param {SidebarProps} props
   * @param {number} index
   * @returns {ITreeNode}
   */
  public static getNetlogFileNode(
    file: UnzippedFile,
    props: SidebarProps,
    i: number,
  ): ITreeNode {
    const { selectedLogFileName } = props;
    const isSelected = selectedLogFileName === file.fileName;

    return Sidebar.getNode(`Net Log ${i + 1}`, { file }, isSelected);
  }

  /**
   * Returns a single tree node for an UnzippedFile (in this case, net logs).
   *
   * @static
   * @param {UnzippedFile} file
   * @param {SidebarProps} props
   * @returns {ITreeNode}
   */
  public static getInstallerFileNode(
    file: UnzippedFile | ProcessedLogFile,
    props: SidebarProps,
  ): ITreeNode {
    const { selectedLogFileName } = props;
    const name = isProcessedLogFile(file)
      ? file.logFile.fileName
      : file.fileName;
    const isSelected = selectedLogFileName === name;

    return Sidebar.getNode(name, { file }, isSelected);
  }

  /**
   * Returns a single tree node for a ProcessedLogFile (all log files, not state files).
   *
   * @static
   * @param {ProcessedLogFile} file
   * @param {SidebarProps} props
   * @returns {ITreeNode}
   */
  public static getLogFileNode(
    file: ProcessedLogFile,
    props: SidebarProps,
  ): ITreeNode {
    const { selectedLogFileName } = props;
    const name = file.logFile.fileName;
    const isSelected = selectedLogFileName === name;
    const hoverText =
      name.length > 20 ? (
        <Tooltip content={name} hoverOpenDelay={800}>
          {name}
        </Tooltip>
      ) : (
        name
      );
    const options: Partial<ITreeNode> = {
      secondaryLabel: this.getLogNodeHint(file),
      label: hoverText,
    };

    return Sidebar.getNode(name, { file }, isSelected, options);
  }

  /**
   * Get potential warnings for state files
   *
   * @static
   * @param {ProcessedLogFile} file
   * @returns {(JSX.Element | null)}
   */
  public static getStateFileHint(
    file: UnzippedFile,
    props: SidebarProps,
  ): JSX.Element | null {
    if (file.fileName.endsWith('root-state.json')) {
      const warnings = getRootStateWarnings(
        props.state.stateFiles[file.fileName].data,
      );

      if (warnings && warnings.length > 0) {
        const content = warnings.join('\n');
        return (
          <Tooltip
            content={content}
            position={Position.RIGHT}
            boundary="viewport"
          >
            <Icon icon="error" intent={Intent.WARNING} />
          </Tooltip>
        );
      }
    }

    if (file.fileName.endsWith('.trace')) {
      const warnings = getTraceWarnings(
        props.state.stateFiles[file.fileName]?.data,
      );
      if (warnings && warnings.length > 0) {
        const content = warnings.join('\n');
        return (
          <Tooltip
            content={content}
            position={Position.RIGHT}
            boundary="viewport"
          >
            <Icon icon="error" intent={Intent.WARNING} />
          </Tooltip>
        );
      }
    }

    // TODO: refactor this rendering code probably
    if (file.fileName.endsWith('environment.json')) {
      const warnings = getEnvironmentWarnings(
        props.state.stateFiles[file.fileName].data,
      );
      if (warnings.length > 0) {
        const content = warnings.join('\n');
        return (
          <Tooltip
            content={content}
            position={Position.RIGHT}
            boundary="viewport"
          >
            <Icon icon="error" intent={Intent.WARNING} />
          </Tooltip>
        );
      }
    }

    return null;
  }

  /**
   * Renders the little warning hint to the right of the file - if the
   * file contains any errors.
   *
   * @static
   * @param {ProcessedLogFile} file
   * @returns {(JSX.Element | null)}
   */
  public static getLogNodeHint(file: ProcessedLogFile): JSX.Element | null {
    const { levelCounts, repeatedCounts } = file;
    const hasErrors = levelsHave('error', levelCounts);
    const hasWarnings = levelsHave('warn', levelCounts);
    const excessiveRepeats = countExcessiveRepeats(repeatedCounts);

    if (!hasErrors && !hasWarnings && !excessiveRepeats) {
      return null;
    }

    // Check for errors
    let content = hasErrors
      ? `This file contains ${levelCounts.error} errors`
      : '';

    if (levelsHave('warn', levelCounts)) {
      content += hasErrors
        ? ` and ${levelCounts.warn} warnings.`
        : `This file contains ${levelCounts.warn} warnings.`;
    }

    // Check for excessive repeats
    if (excessiveRepeats) {
      // Not empty? Add a space
      if (content) content += ` `;

      const line = plural('line', excessiveRepeats);
      const has = plural('has', excessiveRepeats, 'have');

      content += `${excessiveRepeats} log ${line} ${has} been excessively repeated.`;
    }

    return (
      <Tooltip content={content} position={Position.RIGHT} boundary="viewport">
        <Icon icon="error" intent={Intent.WARNING} />
      </Tooltip>
    );
  }

  /**
   * Set the child nodes
   *
   * @static
   * @param {NODE_ID} searchId
   * @param {SidebarState} state
   * @param {Array<ITreeNode>} childNodes
   * @returns {void}
   */
  public static setChildNodes(
    searchId: NODE_ID,
    state: SidebarState,
    childNodes: Array<ITreeNode>,
  ) {
    const parentNode = state.nodes.find(({ id }) => id === searchId);

    if (!parentNode) {
      return;
    }

    // Do not show categories if they have no files in them
    if (childNodes.length === 0) {
      state.nodes = state.nodes.filter(({ id }) => searchId !== id);
    }

    parentNode.childNodes = childNodes;
  }

  constructor(props: SidebarProps) {
    super(props);

    this.state = {
      nodes: DEFAULT_NODES,
    };

    this.forEachNode = this.forEachNode.bind(this);
    this.handleNodeClick = this.handleNodeClick.bind(this);
    this.handleNodeCollapse = this.handleNodeCollapse.bind(this);
    this.handleNodeExpand = this.handleNodeExpand.bind(this);
  }

  public render(): JSX.Element {
    const { isSidebarOpen } = this.props.state;
    const className = classNames('Sidebar', { Open: isSidebarOpen });

    return (
      <div className={className}>
        <Tree
          contents={this.state.nodes}
          onNodeClick={this.handleNodeClick}
          onNodeCollapse={this.handleNodeCollapse}
          onNodeExpand={this.handleNodeExpand}
        />
      </div>
    );
  }

  /**
   * Do an operation for all nodes in the tree.
   *
   * @private
   * @param {Array<ITreeNode>} nodes
   * @param {(node: ITreeNode) => void} callback
   */
  private forEachNode(
    nodes: Array<ITreeNode>,
    callback: (node: ITreeNode) => void,
  ) {
    for (const node of nodes) {
      callback(node);

      if (node.childNodes) {
        this.forEachNode(node.childNodes, callback);
      }
    }
  }

  /**
   * Handle a click on a single tree node.
   */
  private handleNodeClick(
    node: ITreeNode<Partial<SidebarNodeData>>,
    _nodePath: Array<number>,
    _e: React.MouseEvent<HTMLElement>,
  ) {
    const { nodeData } = node;

    if (nodeData?.file) {
      this.props.state.selectLogFile(nodeData.file);
    } else if (nodeData?.type) {
      this.props.state.selectLogFile(null, nodeData.type);
    }

    if (nodeData) {
      this.forEachNode(this.state.nodes, (n) => (n.isSelected = false));
      node.isSelected = true;

      this.setState(this.state);
    }
  }

  /**
   * Handle the collapsing of a node (aka a folder).
   *
   * @private
   * @param {ITreeNode} nodeData
   */
  private handleNodeCollapse(nodeData: ITreeNode) {
    nodeData.isExpanded = false;
    this.setState(this.state);
  }

  /**
   * Handle the expansion of a node (aka a folder).
   *
   * @private
   * @param {ITreeNode} nodeData
   */
  private handleNodeExpand(nodeData: ITreeNode) {
    nodeData.isExpanded = true;
    this.setState(this.state);
  }
}
