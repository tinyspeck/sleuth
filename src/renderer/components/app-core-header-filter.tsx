import { observer } from 'mobx-react';
import React from 'react';
import { debounce } from 'lodash';
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
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FilterOutlined,
  FilterTwoTone,
  SearchOutlined,
} from '@ant-design/icons';

export interface FilterProps {
  state: SleuthState;
}

@observer
export class Filter extends React.Component<FilterProps, object> {
  private searchRef = React.createRef<InputRef>();

  constructor(props: FilterProps) {
    super(props);

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

  /**
   * Handles an increment or decrement of the selected index in the
   * searchList array. Essentially goes back and forth between search
   * results.
   * @param change 1 or -1, normally
   */
  public handleSearchIndexChange(change: number) {
    const { searchList, searchIndex, selectedIndex } = this.props.state;
    // noop if we have no search results at the moment
    if (searchList.length === 0 || selectedIndex === undefined) {
      return;
    }
    let newSearchIndex = 0;

    if (selectedIndex === searchList[searchIndex]) {
      const numSearchResults = searchList.length;
      newSearchIndex = searchIndex + change;
      if (newSearchIndex >= numSearchResults) {
        newSearchIndex = 0;
      } else if (newSearchIndex < 0) {
        newSearchIndex = numSearchResults - 1;
      }
    } else {
      // if we're currently selecting a row that isn't in the search result list,
      // we want the arrow keys to point us back to the nearest search result in that
      // direction. This is kind of what VSCode does for its search arrows.
      // For positive change, we just want the next largest search index but for negative
      // change, we want the previous one so we offset by -1 indices.
      const offset = change > 0 ? 0 : -1;
      for (const [index, searchIndex] of searchList.entries()) {
        if (searchIndex > selectedIndex) {
          newSearchIndex = index + offset;
          break;
        }
      }
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
    const isDefaultState = !(debug || info || warn || error);

    const menu = (
      <Menu>
        <Menu.Item
          active={false}
          onClick={() => {
            this.props.state.setFilterLogLevels({
              debug: false,
              info: false,
              warn: false,
              error: false,
            });
          }}
          shouldDismissPopover={true}
          text="Default levels"
        />
        <Menu.Divider />
        <Menu.Item
          active={debug}
          onClick={() => {
            this.props.state.setFilterLogLevels({ debug: !debug });
          }}
          icon="code"
          shouldDismissPopover={false}
          text="Debug"
        />
        <Menu.Item
          active={info}
          onClick={() => {
            this.props.state.setFilterLogLevels({ info: !info });
          }}
          icon="info-sign"
          shouldDismissPopover={false}
          text="Info"
        />
        <Menu.Item
          active={warn}
          onClick={() => {
            this.props.state.setFilterLogLevels({ warn: !warn });
          }}
          icon="warning-sign"
          shouldDismissPopover={false}
          text="Warning"
        />
        <Menu.Item
          active={error}
          onClick={() => {
            this.props.state.setFilterLogLevels({ error: !error });
          }}
          icon="error"
          shouldDismissPopover={false}
          text="Error"
        />
      </Menu>
    );

    return (
      <Popover content={menu} position={Position.BOTTOM}>
        <Button
          icon={isDefaultState ? <FilterOutlined /> : <FilterTwoTone />}
        />
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
        <NavbarGroup className="SearchGroup">
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
          <NavbarGroup className="FilterGroup">
            {this.renderFilter()}
            {showOnlySearchResultsButton}
          </NavbarGroup>
          <NavbarDivider />
          <Space.Compact className="SearchInputGroup">
            <Input
              placeholder="Search"
              prefix={<SearchOutlined />}
              onChange={(e) => this.handleSearchQueryChange(e.target.value)}
              ref={this.searchRef}
              allowClear={true}
              count={{
                show: searchList.length > 0,
                strategy: () => {
                  return searchIndex + 1; // result number is 1-indexed
                },
                max: searchList.length,
              }}
            />
            <Button.Group>
              <Button
                icon={<ArrowUpOutlined />}
                onClick={() => this.handleSearchIndexChange(-1)}
                disabled={this.props.state.searchList.length === 0}
              />
              <Button
                icon={<ArrowDownOutlined />}
                onClick={() => this.handleSearchIndexChange(1)}
                disabled={this.props.state.searchList.length === 0}
              />
            </Button.Group>
          </Space.Compact>
        </NavbarGroup>
      </>
    );
  }
}
