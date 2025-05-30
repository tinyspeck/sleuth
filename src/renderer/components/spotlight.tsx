import React from 'react';
import autoBind from 'react-autobind';
import { observer } from 'mobx-react';
import { Omnibar, ItemRenderer, ItemPredicate } from '@blueprintjs/select';
import { IconName, MenuItem } from '@blueprintjs/core';

import { SleuthState } from '../state/sleuth';
import {
  ProcessedLogFile,
  ProcessedLogFiles,
  UnzippedFile,
  ValidSuggestion,
} from '../../interfaces';
import { isProcessedLogFile } from '../../utils/is-logfile';
import { highlightText } from '../../utils/highlight-text';

interface SpotlightItem {
  text: string;
  icon?: IconName;
  label?: string;
  click: () => void;
}
const SleuthOmnibar = Omnibar.ofType<SpotlightItem>();

export const renderItem: ItemRenderer<SpotlightItem> = (
  { text, label, icon },
  { handleClick, modifiers, query },
) => {
  if (!modifiers.matchesPredicate) {
    return null;
  }

  return (
    <MenuItem
      active={modifiers.active}
      disabled={modifiers.disabled}
      text={highlightText(text, query)}
      key={text}
      onClick={handleClick}
      label={label || ''}
      icon={icon}
    />
  );
};

export const filterItem: ItemPredicate<SpotlightItem> = (query, item) => {
  return item.text.toLowerCase().includes(query.toLowerCase());
};

export interface SpotlightState {
  isOpen: boolean;
}

export interface SpotlightProps {
  state: SleuthState;
}

@observer
export class Spotlight extends React.Component<
  SpotlightProps,
  Partial<SpotlightState>
> {
  constructor(props: SpotlightProps) {
    super(props);

    this.state = {};
    autoBind(this);
  }

  public render(): JSX.Element {
    const { isSpotlightOpen } = this.props.state;
    return (
      <SleuthOmnibar
        isOpen={isSpotlightOpen}
        noResults={<MenuItem disabled={true} text="No results." />}
        onClose={this.props.state.toggleSpotlight}
        items={this.getItems()}
        itemRenderer={renderItem}
        onItemSelect={this.onItemSelect}
        itemPredicate={filterItem}
        resetOnSelect={true}
      />
    );
  }

  private onItemSelect(item: SpotlightItem) {
    if (item && item.click) {
      item.click();
      this.props.state.toggleSpotlight();
    }
  }

  private getItems(): Array<SpotlightItem> {
    const { suggestions } = this.props.state;
    const { processedLogFiles } = this.props.state;

    const spotSuggestions: Array<SpotlightItem> = suggestions
      .filter((s) => !('error' in s))
      .map((s: ValidSuggestion) => ({
        text: s.filePath.split(/[/\\]/).pop() || '',
        label: `${s.age} old`,
        icon: s.filePath.endsWith('zip')
          ? ('compressed' as const)
          : ('folder-open' as const),
        click: () => {
          this.props.state.openFile(s.filePath);
        },
      }));

    const logFileSuggestions: Array<SpotlightItem> = [];

    if (processedLogFiles) {
      Object.keys(processedLogFiles).forEach((key: keyof ProcessedLogFiles) => {
        const keyFiles: Array<ProcessedLogFile | UnzippedFile> =
          processedLogFiles[key];
        keyFiles.forEach((logFile) => {
          if (isProcessedLogFile(logFile)) {
            logFileSuggestions.push({
              text: logFile.logFile.fileName,
              label: `${logFile.logEntries.length} entries`,
              icon: 'document' as const,
              click: () => {
                this.props.state.selectLogFile(logFile);
              },
            });
          } else {
            logFileSuggestions.push({
              text: logFile.fileName,
              label: `State`,
              icon: 'cog' as const,
              click: () => {
                this.props.state.selectLogFile(logFile);
              },
            });
          }
        });
      });
    }

    const appSuggestions = [
      {
        text: 'Quit Sleuth',
        icon: 'power' as const,
        click: async () => await window.Sleuth.quit(),
      },
      {
        text: 'Go Home',
        icon: 'home' as const,
        click: () => {
          this.props.state.reset(true);
        },
      },
      {
        text: 'Toggle Sidebar',
        icon: 'menu' as const,
        click: () => {
          this.props.state.toggleSidebar();
        },
      },
    ];

    return [...spotSuggestions, ...logFileSuggestions, ...appSuggestions];
  }
}
