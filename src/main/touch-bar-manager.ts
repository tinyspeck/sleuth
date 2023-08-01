import {
  TouchBarButtonConstructorOptions,
  TouchBarPopoverConstructorOptions,
  BrowserWindow,
  ipcMain,
  TouchBar,
} from 'electron';

import { getNiceGreeting } from '../utils/get-nice-greeting';
import { levelsHave } from '../utils/level-counts';
import { plural } from '../utils/pluralize';

import { IpcEvents } from '../ipc-events';
import { LevelFilter, LogLevel, TouchBarLogFileUpdate } from '../interfaces';

const {
  TouchBarButton,
  TouchBarGroup,
  TouchBarPopover,
  TouchBarSpacer,
  TouchBarLabel,
} = TouchBar;

export class TouchBarManager {
  public touchBar: Electron.TouchBar;

  public homeBtn = new TouchBarButton(this.getHomeBtnOptions());
  public darkModeBtn = new TouchBarButton(this.getDarkModeBtnOptions());
  public spotlightBtn = new TouchBarButton(this.getSpotlightBtnOptions());
  public sidebarBtn = new TouchBarButton(this.getSidebarBtnOptions());
  public errorsLabel = new TouchBarLabel({ label: '' });

  public leftControls = new TouchBarGroup({
    items: new TouchBar({
      items: [
        this.homeBtn,
        this.darkModeBtn,
        this.sidebarBtn,
        this.spotlightBtn,
      ],
    }),
  });

  public toggleFilterBtns = {
    error: new TouchBarButton({
      label: '🚨 Error',
      click: () => this.send(IpcEvents.TOGGLE_FILTER, 'error'),
    }),
    warn: new TouchBarButton({
      label: '⚠️ Warning',
      click: () => this.send(IpcEvents.TOGGLE_FILTER, 'warn'),
    }),
    info: new TouchBarButton({
      label: 'ℹ️ Info',
      click: () => this.send(IpcEvents.TOGGLE_FILTER, 'info'),
    }),
    debug: new TouchBarButton({
      label: '🐛 Debug',
      click: () => this.send(IpcEvents.TOGGLE_FILTER, 'debug'),
    }),
  };

  public filterBtn = new TouchBarPopover(this.getFilterBtnOptions());

  // Lol have mercy, TS
  public items:
    | Array<
        | Electron.TouchBarButton
        | Electron.TouchBarColorPicker
        | Electron.TouchBarGroup
        | Electron.TouchBarLabel
        | Electron.TouchBarPopover
        | Electron.TouchBarScrubber
        | Electron.TouchBarSegmentedControl
        | Electron.TouchBarSlider
        | Electron.TouchBarSpacer
      >
    | undefined;

  constructor(public readonly browserWindow: BrowserWindow) {
    this.handleFilterUpdate = this.handleFilterUpdate.bind(this);
    this.handleDarkModeUpdate = this.handleDarkModeUpdate.bind(this);
    this.handleLogFileUpdate = this.handleLogFileUpdate.bind(this);
    this.teardown = this.teardown.bind(this);
    this.setLogFileItems = this.setLogFileItems.bind(this);

    this.setupTouchBar();

    // Make sure we unsubscribe from Touchbar events
    browserWindow.once('close', this.teardown);
  }

  /**
   * This method is called right after we instantiate the manager. It sets up
   * autoruns that respond to state changes and also greets the user with a
   * kind little message.
   */
  public setupTouchBar() {
    // First, the welcome
    this.setWelcomeItems();

    // All these things are state-relevant and require that
    // we communicate with the window
    ipcMain.on(IpcEvents.LEVEL_FILTER_UPDATE, this.handleFilterUpdate);
    ipcMain.on(IpcEvents.DARK_MODE_UPDATE, this.handleDarkModeUpdate);
    ipcMain.on(IpcEvents.LOG_FILE_UPDATE, this.handleLogFileUpdate);
  }

  public teardown() {
    ipcMain.off(IpcEvents.LEVEL_FILTER_UPDATE, this.handleFilterUpdate);
    ipcMain.off(IpcEvents.DARK_MODE_UPDATE, this.handleDarkModeUpdate);
    ipcMain.off(IpcEvents.LOG_FILE_UPDATE, this.handleLogFileUpdate);
  }

  /**
   * Safely set the touch bar on the current window
   *
   * @param {Partial<Electron.TouchBarConstructorOptions>} options
   */
  public setTouchBar(options: Partial<Electron.TouchBarConstructorOptions>) {
    try {
      this.items = options.items;
      this.touchBar = new TouchBar(
        options as Electron.TouchBarConstructorOptions,
      );
      this.browserWindow.setTouchBar(this.touchBar);
    } catch (error) {
      console.warn(`Could not set touch bar`, { error });
    }
  }

  /**
   * A bar that just contains a little welcome message
   */
  public setWelcomeItems() {
    this.setTouchBar({
      items: [
        new TouchBarSpacer({ size: 'flexible' }),
        new TouchBarLabel({ label: getNiceGreeting() }),
        new TouchBarSpacer({ size: 'flexible' }),
      ],
    });
  }

  /**
   * A bar with the default items
   */
  public setLogFileItems() {
    this.setTouchBar({
      items: [
        this.leftControls,
        new TouchBarSpacer({ size: 'flexible' }),
        this.errorsLabel,
        new TouchBarSpacer({ size: 'flexible' }),
        this.filterBtn,
      ],
    });
  }

  /**
   * Creates a button wired up to control the filters for the log table
   *
   * @returns {TouchBarButtonConstructorOptions}
   */
  public getFilterBtnOptions(): TouchBarPopoverConstructorOptions {
    const label = '🔖 Filter';
    const items = [
      this.toggleFilterBtns.error,
      this.toggleFilterBtns.warn,
      this.toggleFilterBtns.info,
      this.toggleFilterBtns.debug,
    ];

    return { label, items: new TouchBar({ items }) };
  }

  /**
   * Creates a button wired up to take you home
   *
   * @returns {TouchBarButtonConstructorOptions}
   */
  public getHomeBtnOptions(): TouchBarButtonConstructorOptions {
    return {
      label: '🏠',
      click: () => this.send(IpcEvents.RESET),
    };
  }

  /**
   * Creates a button wired up to switch the theme
   *
   * @returns {TouchBarButtonConstructorOptions}
   */
  public getDarkModeBtnOptions(): TouchBarButtonConstructorOptions {
    return {
      label: '🌙',
      click: () => this.send(IpcEvents.TOGGLE_DARKMODE),
    };
  }

  /**
   * Creates a button wired up to toggle spotlight
   *
   * @returns {TouchBarButtonConstructorOptions}
   */
  public getSpotlightBtnOptions(): TouchBarButtonConstructorOptions {
    return {
      label: '🔍',
      click: () => this.send(IpcEvents.TOGGLE_SPOTLIGHT),
    };
  }

  /**
   * Creates a button wired up to toggle the sidebar
   *
   * @returns {TouchBarButtonConstructorOptions}
   */
  public getSidebarBtnOptions(): TouchBarButtonConstructorOptions {
    return {
      label: '🗂',
      click: () => this.send(IpcEvents.TOGGLE_SIDEBAR),
    };
  }

  public handleFilterUpdate(
    event: Electron.IpcMainEvent,
    levelFilter: LevelFilter,
  ) {
    if (!this.isRightSender(event)) return;

    Object.keys(levelFilter).forEach((key: LogLevel) => {
      this.toggleFilterBtns[key].backgroundColor = levelFilter[key]
        ? '#ffffff'
        : '#4d5a68';
    });
  }

  public handleDarkModeUpdate(
    event: Electron.IpcMainEvent,
    isDarkMode: boolean,
  ) {
    if (!this.isRightSender(event)) return;

    this.darkModeBtn.label = isDarkMode ? '🌙' : '☀️';
  }

  public handleLogFileUpdate(
    event: Electron.IpcMainEvent,
    update: TouchBarLogFileUpdate,
  ) {
    if (this.isRightSender(event)) {
      this.setWarningLabel(update.levelCounts);

      if (update.isLogFile) {
        this.setLogFileItems();
      }
    }
  }

  public setWarningLabel(levelCounts: Record<string, number>) {
    const hasCounts = Object.keys(levelCounts).length > 0;

    if (hasCounts) {
      const { error, warn } = levelCounts;

      const errorCount = levelsHave('error', levelCounts);
      const warnCount = levelsHave('warn', levelCounts);
      const errorLabel = plural('error', error);
      const warnLabel = plural('warning', warn);

      if (errorCount === 0 && warnCount === 0) {
        this.errorsLabel.label = `😇 No errors or warnings`;
      } else if (errorCount < 10 && warnCount < 10) {
        this.errorsLabel.label = `😨 ${errorCount} ${errorLabel} and ${warnCount} ${warnLabel}`;
      } else if (errorCount < 100 && warnCount < 100) {
        this.errorsLabel.label = `😰 ${errorCount} ${errorLabel} and ${warnCount} ${warnLabel}`;
      } else if (errorCount < 250 && warnCount < 250) {
        this.errorsLabel.label = `😭 ${errorCount} ${errorLabel} and ${warnCount} ${warnLabel}`;
      } else if (errorCount < 800 && warnCount < 800) {
        this.errorsLabel.label = `😱 ${errorCount} ${errorLabel} and ${warnCount} ${warnLabel}`;
      } else {
        this.errorsLabel.label = `🚨 Dear god, ${errorCount} ${errorLabel} and ${warnCount} ${warnLabel}`;
      }
    } else {
      this.errorsLabel.label = '';
    }
  }

  /**
   * Is this IPC event coming from the window this manager was setup for?
   *
   * @private
   * @param {Electron.IpcMainInvokeEvent} event
   * @returns
   * @memberof TouchBarManager
   */
  private isRightSender(event: Electron.IpcMainInvokeEvent) {
    return event.sender.id === this.browserWindow.webContents?.id;
  }

  private send(channel: string, ...args: Array<unknown>) {
    this.browserWindow.webContents?.send(channel, ...args);
  }
}
