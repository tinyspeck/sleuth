import { observer } from 'mobx-react';
import React from 'react';
import debounce from 'debounce';
import {
  NavbarDivider,
  NavbarGroup,
  Popover,
  Menu,
  Position,
} from '@blueprintjs/core';
import dayjs, { Dayjs } from 'dayjs';
import { Button, DatePicker, Input, InputRef, Space } from 'antd';
import { SleuthState } from '../state/sleuth';
import { ipcRenderer } from 'electron';
import { IpcEvents } from '../../ipc-events';
import { LogLevel } from '../../interfaces';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import debug from 'debug';

const d = debug('sleuth:header:filter');

export interface FilterProps {
  state: SleuthState;
}

@observer
export class Filter extends React.Component<FilterProps, object> {
  private searchRef = React.createRef<InputRef>();

  constructor(props: FilterProps) {
    super(props);

    this.props.state.onFilterToggle =
      this.props.state.onFilterToggle.bind(this);
    this.toggleSearchResultVisibility =
      this.toggleSearchResultVisibility.bind(this);
    this.handleSearchQueryChange = debounce(
      this.handleSearchQueryChange.bind(this),
      500,
    );
    this.handleSearchIndexChange = this.handleSearchIndexChange.bind(this);
    this.handleDateRangeChange = this.handleDateRangeChange.bind(this);
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

  public handleSearchQueryChange(value: string) {
    this.props.state.search = value;
  }

  public handleSearchIndexChange(change: number) {
    const { searchList, searchIndex } = this.props.state;
    const numSearchResults = searchList.length;
    let newSearchIndex = searchIndex + change;

    if (newSearchIndex >= numSearchResults) {
      newSearchIndex = 0;
    } else if (newSearchIndex < 0) {
      newSearchIndex = numSearchResults - 1;
    }

    this.props.state.searchIndex = newSearchIndex;
  }

  public handleDateRangeChange(
    values: [Dayjs, Dayjs],
    dateStrings: [string, string],
  ) {
    this.props.state.dateRange = {
      from: values && values[0] ? new Date(dateStrings[0]) : null,
      to: values && values[1] ? new Date(dateStrings[1]) : null,
    };
  }

  public toggleSearchResultVisibility() {
    this.props.state.showOnlySearchResults =
      !this.props.state.showOnlySearchResults;
  }

  public renderFilter() {
    const { error, warn, info, debug } = this.props.state.levelFilter;

    const menu = (
      <Menu>
        <Menu.Item
          active={debug}
          onClick={() => this.props.state.onFilterToggle(LogLevel.debug)}
          icon="code"
          shouldDismissPopover={false}
          text="Debug"
        />
        <Menu.Item
          active={info}
          onClick={() => this.props.state.onFilterToggle(LogLevel.info)}
          icon="info-sign"
          shouldDismissPopover={false}
          text="Info"
        />
        <Menu.Item
          active={warn}
          onClick={() => this.props.state.onFilterToggle(LogLevel.warn)}
          icon="warning-sign"
          shouldDismissPopover={false}
          text="Warning"
        />
        <Menu.Item
          active={error}
          onClick={() => this.props.state.onFilterToggle(LogLevel.error)}
          icon="error"
          shouldDismissPopover={false}
          text="Error"
        />
      </Menu>
    );

    return (
      <Popover content={menu} position={Position.BOTTOM}>
        <Button icon={<FilterOutlined />} />
      </Popover>
    );
  }

  public render() {
    const { showOnlySearchResults, searchIndex, searchList } = this.props.state;

    const showOnlySearchResultsButton = (
      <Button
        onClick={this.toggleSearchResultVisibility}
        icon={
          showOnlySearchResults ? <EyeInvisibleOutlined /> : <EyeOutlined />
        }
      />
    );

    const { RangePicker } = DatePicker;

    return (
      <>
        <NavbarGroup className="FilterGroup">{this.renderFilter()}</NavbarGroup>
        <NavbarGroup className="SearchGroup">
          <NavbarDivider />
          <RangePicker
            showTime={{
              defaultValue: [
                dayjs('00:00:00', 'HH:mm:ss'),
                dayjs('23:59:59', 'HH:mm:ss'),
              ],
            }}
            onChange={this.handleDateRangeChange}
            allowEmpty={[true, true]}
          />
          <NavbarDivider />
          <Space.Compact>
            <Input
              placeholder="Search"
              prefix={<SearchOutlined />}
              onChange={(e) => this.handleSearchQueryChange(e.target.value)}
              ref={this.searchRef}
              count={{
                show: searchList.length > 0,
                strategy: () => {
                  return searchIndex + 1; // result number is 1-indexed
                },
                max: searchList.length,
              }}
            />
            <Button.Group>
              {showOnlySearchResultsButton}
              <Button
                icon={<ArrowUpOutlined />}
                onClick={() => this.handleSearchIndexChange(-1)}
              />
              <Button
                icon={<ArrowDownOutlined />}
                onClick={() => this.handleSearchIndexChange(1)}
              />
            </Button.Group>
          </Space.Compact>
        </NavbarGroup>
      </>
    );
  }
}
