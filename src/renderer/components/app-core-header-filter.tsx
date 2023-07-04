import { observer } from 'mobx-react';
import React from 'react';
import debounce from 'debounce';
import {
  Button,
  Classes,
  NavbarDivider,
  NavbarGroup,
  ButtonGroup,
  InputGroup,
  Popover,
  Menu,
  Position
} from '@blueprintjs/core';
import { DateRangeInput, TimePrecision } from '@blueprintjs/datetime';

import { SleuthState } from '../state/sleuth';
import { ipcRenderer } from 'electron';
import { IpcEvents } from '../../ipc-events';

import { LogLevel } from '../../interfaces';


export interface FilterProps {
  state: SleuthState;
}

@observer
export class Filter extends React.Component<FilterProps, object> {
  private searchRef = React.createRef<HTMLInputElement>();

  constructor(props: FilterProps) {
    super(props);

    this.props.state.onFilterToggle = this.props.state.onFilterToggle.bind(this);
    this.toggleSearchResultVisibility = this.toggleSearchResultVisibility.bind(this);
    this.onSearchChange = debounce(this.onSearchChange.bind(this), 700);
    this.onDateRangeChange = this.onDateRangeChange.bind(this);
    this.renderFilter = this.renderFilter.bind(this);
    this.focus = this.focus.bind(this);
  }

  public focus() {
    this.searchRef.current?.focus();
  }

  public componentDidMount() {
    ipcRenderer.on(IpcEvents.FIND, this.focus);
  }

  public componentWillUnmount() {
    ipcRenderer.off(IpcEvents.FIND, this.focus);
  }

  public onSearchChange(value: string) {
    if (this.props.state.showOnlySearchResults === undefined) {
      this.props.state.showOnlySearchResults = true;
    }

    this.props.state.search = value;
  }

  public onSearchIndexChange(change: number) {
    this.props.state.searchIndex = this.props.state.searchIndex + change;
  }

  public onDateRangeChange(range: [ Date | null, Date | null ]) {
    this.props.state.dateRange = {
      from: range[0] || null,
      to: range[1] || null
    };
  }

  public toggleSearchResultVisibility() {
    this.props.state.showOnlySearchResults = !this.props.state.showOnlySearchResults;
  }

  public renderFilter() {
    const { error, warn, info, debug } = this.props.state.levelFilter;

    const menu = (
      <Menu>
        <Menu.Item
          active={debug}
          onClick={() => this.props.state.onFilterToggle(LogLevel.debug)}
          icon='code'
          shouldDismissPopover={false}
          text='Debug'
        />
        <Menu.Item
          active={info}
          onClick={() => this.props.state.onFilterToggle(LogLevel.info)}
          icon='info-sign'
          shouldDismissPopover={false}
          text='Info'
        />
        <Menu.Item
          active={warn}
          onClick={() => this.props.state.onFilterToggle(LogLevel.warn)}
          icon='warning-sign'
          shouldDismissPopover={false}
          text='Warning'
        />
        <Menu.Item
          active={error}
          onClick={() => this.props.state.onFilterToggle(LogLevel.error)}
          icon='error'
          shouldDismissPopover={false}
          text='Error'
        />
      </Menu>
    );

    return (
      <Popover content={menu} position={Position.BOTTOM}>
        <Button icon='filter-list' text='Filter'/>
      </Popover>
    );
  }

  public render() {
    const { showOnlySearchResults, dateRange } = this.props.state;

    const showOnlySearchResultsButton = (
      <Button
        active={showOnlySearchResults}
        onClick={this.toggleSearchResultVisibility}
        className={Classes.MINIMAL}
        icon={showOnlySearchResults ? 'eye-off' : 'eye-open'}
      />
    );

    return (
      <>
        <NavbarGroup className='FilterGroup'>
          {this.renderFilter()}
        </NavbarGroup>
        <NavbarGroup className='SearchGroup'>
          <NavbarDivider />
          <DateRangeInput
            allowSingleDayRange={true}
            timePickerProps={{precision: TimePrecision.MINUTE, showArrowButtons: true}}
            formatDate={(date) => date.toLocaleString()}
            onChange={this.onDateRangeChange}
            parseDate={(str) => new Date(str)}
            value={[ dateRange.from, dateRange.to ]}
          />
          <Button
            icon='cross'
            style={{ marginLeft: '5px' }}
            onClick={() => this.onDateRangeChange([ null, null ])}
          />
          <NavbarDivider />
          <InputGroup
            leftIcon='search'
            inputRef={this.searchRef}
            placeholder='Search'
            rightElement={showOnlySearchResultsButton}
            onChange={(e: React.FormEvent) => this.onSearchChange((e.target as HTMLInputElement).value)}
          />
          <NavbarDivider />
          <ButtonGroup>
            <Button icon='arrow-left' onClick={() => this.onSearchIndexChange(-1)} />
            <Button icon='arrow-right' onClick={() => this.onSearchIndexChange(1)} />
          </ButtonGroup>
        </NavbarGroup>
      </>
    );
  }
}
