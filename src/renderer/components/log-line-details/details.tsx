import { observer } from 'mobx-react';
import { SleuthState } from '../../state/sleuth';
import React from 'react';
import classNames from 'classnames';
import { Card, Button, ButtonGroup, Tag, Elevation } from '@blueprintjs/core';

import { LogEntry } from '../../../interfaces';
import { LogLineData } from './data';
import { Timestamp } from './timestamp';
import { getIsBookmark, toggleBookmark } from '../../state/bookmarks';
import { capitalize } from '../../../utils/capitalize';
import { openLineInSource } from '../../../utils/open-line-in-source';

export interface LogLineDetailsProps {
  state: SleuthState;
}

@observer
export class LogLineDetails extends React.Component<
  LogLineDetailsProps,
  object
> {
  constructor(props: LogLineDetailsProps) {
    super(props);

    this.toggle = this.toggle.bind(this);
    this.openSource = this.openSource.bind(this);
    this.renderLogEntry = this.renderLogEntry.bind(this);
  }

  /**
   * Toggle the whole data view.
   */
  public toggle() {
    this.props.state.isDetailsVisible = !this.props.state.isDetailsVisible;
  }

  /**
   * Opens the file in the default editor (or tries, at least)
   */
  public openSource() {
    const { selectedEntry, defaultEditor } = this.props.state;

    if (selectedEntry && selectedEntry.sourceFile) {
      const { sourceFile, line } = selectedEntry;

      openLineInSource(line, sourceFile, {
        defaultEditor,
      });
    }
  }

  public render(): JSX.Element | null {
    const { isDetailsVisible } = this.props.state;

    if (!isDetailsVisible) return null;

    const className = classNames('Details', { IsVisible: isDetailsVisible });

    return (
      <div className={className}>
        {this.renderLogEntry()}
        {this.renderLogLineData()}
      </div>
    );
  }

  /**
   * Renders a single log entry, ensuring that people can scroll around and still now what log entry they're looking at.
   *
   * @returns {(JSX.Element | null)}
   */
  private renderLogEntry(): JSX.Element | null {
    const { selectedEntry } = this.props.state;
    if (!selectedEntry) return null;

    return (
      <div className="Details-LogEntry">
        <div className="MetaInfo">
          <div className="Details-Moment">
            <Timestamp
              timestamps={this.getProperties('timestamp')}
              momentValues={this.getProperties('momentValue')}
            />
          </div>
          <div className="Details-LogType">
            {this.renderLevel()}
            {this.renderType()}
            <ButtonGroup>
              <Button
                icon="star"
                active={getIsBookmark(this.props.state)}
                onClick={() => toggleBookmark(this.props.state)}
              />
              <Button
                icon="document-open"
                onClick={this.openSource}
                text="Open Source"
              />
              <Button icon="cross" onClick={this.toggle} text="Close" />
            </ButtonGroup>
          </div>
        </div>
        {this.renderMessage()}
      </div>
    );
  }

  private renderLogLineData(): JSX.Element | null {
    const { selectedEntry, selectedRangeEntries } = this.props.state;
    if (!selectedEntry?.meta) return null;

    // Don't show data for multiple entries
    if (selectedRangeEntries && selectedRangeEntries.length > 1) {
      return null;
    }

    return <LogLineData state={this.props.state} meta={selectedEntry.meta} />;
  }

  private renderMessage(): JSX.Element {
    const message = this.getProperties('message').join('\n');

    return (
      <Card className="Message Monospace" elevation={Elevation.THREE}>
        {message}
      </Card>
    );
  }

  private renderLevel(): JSX.Element {
    const levels = Array.from(new Set(this.getProperties('level'))).join(', ');

    return (
      <Tag large={true} icon="box">
        {levels}
      </Tag>
    );
  }

  private renderType(): JSX.Element {
    const logTypes = Array.from(new Set(this.getProperties('logType'))).map(
      capitalize,
    );
    const type = `${logTypes.join(', ')} Process${
      logTypes.length > 1 ? 'es' : ''
    }`;

    return (
      <Tag large={true} icon="applications">
        {type}
      </Tag>
    );
  }

  /**
   * Get an array of all the details for the currently selected entries.
   *
   * @param {keyof LogEntry} key
   * @memberof LogLineDetails
   */
  private getProperties<T>(key: keyof LogEntry): Array<T> {
    const { selectedEntry, selectedRangeEntries } = this.props.state;

    if (selectedRangeEntries && selectedRangeEntries.length > 0) {
      return selectedRangeEntries.map((v) => v[key] as unknown as T);
    } else if (selectedEntry) {
      return [selectedEntry[key] as unknown as T];
    }

    return [];
  }
}
