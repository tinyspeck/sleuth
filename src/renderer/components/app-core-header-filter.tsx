import { observer } from 'mobx-react';
import React, { useEffect } from 'react';
import { debounce } from 'lodash';
import dayjs, { Dayjs } from 'dayjs';
import {
  Button,
  DatePicker,
  Divider,
  Dropdown,
  Input,
  InputRef,
  Space,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import { SleuthState } from '../state/sleuth';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BugOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FilterOutlined,
  FilterTwoTone,
  FireOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { tzOffset } from '@date-fns/tz';

export interface FilterProps {
  state: SleuthState;
}

export const Filter = observer((props: FilterProps) => {
  const searchRef = React.useRef<InputRef>(null);
  const [open, setOpen] = React.useState(false);

  /**
   * Handles an increment or decrement of the selected index in the
   * searchList array. Essentially goes back and forth between search
   * results.
   * @param change 1 or -1, normally
   */
  const handleSearchIndexChange = (change: number) => {
    const { searchList, searchIndex, selectedIndex } = props.state;
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

    props.state.searchIndex = newSearchIndex;
  };

  const handleSearchQueryChange = debounce((value: string) => {
    props.state.search = value;
  }, 500);

  const handleDateRangeChange = (
    values: [Dayjs, Dayjs],
    dateStrings: [string, string],
  ) => {
    props.state.dateRange = {
      from: values && values[0] ? new Date(dateStrings[0]) : null,
      to: values && values[1] ? new Date(dateStrings[1]) : null,
    };
  };

  useEffect(() => {
    const destructor = window.Sleuth.focusFind(
      () => searchRef.current?.focus(),
    );
    return () => {
      destructor();
    };
  }, []);

  const { showOnlySearchResults, searchIndex, searchList } = props.state;

  const showOnlySearchResultsButton = (
    <Button
      onClick={() => {
        props.state.showOnlySearchResults = !props.state.showOnlySearchResults;
      }}
      icon={showOnlySearchResults ? <EyeInvisibleOutlined /> : <EyeOutlined />}
    />
  );

  const { RangePicker } = DatePicker;

  function renderFilter() {
    const { error, warn, info, debug } = props.state.levelFilter;
    const isDefaultState = !(debug || info || warn || error);

    const selectedKeys: string[] = [];

    for (const level of ['debug', 'info', 'warn', 'error']) {
      if (props.state.levelFilter[level]) {
        selectedKeys.push(level);
      }
    }

    return (
      <Dropdown
        open={open}
        trigger={['click']}
        menu={{
          selectable: true,
          selectedKeys: [
            debug ? 'debug' : '',
            info ? 'info' : '',
            warn ? 'warn' : '',
            error ? 'error' : '',
          ],
          items: [
            {
              label: (
                <Space>
                  <BugOutlined />
                  Debug
                </Space>
              ),
              onClick: () => {
                props.state.setFilterLogLevels({ debug: !debug });
              },
              key: 'debug',
            },
            {
              label: (
                <Space>
                  <InfoCircleOutlined />
                  Info
                </Space>
              ),
              onClick: () => {
                props.state.setFilterLogLevels({ info: !info });
              },
              key: 'info',
            },
            {
              label: (
                <Space>
                  <WarningOutlined />
                  Warning
                </Space>
              ),
              onClick: () => {
                props.state.setFilterLogLevels({ warn: !warn });
              },
              key: 'warn',
            },
            {
              label: (
                <Space>
                  <FireOutlined />
                  Error
                </Space>
              ),
              onClick: () => {
                props.state.setFilterLogLevels({ error: !error });
              },
              key: 'error',
            },
            {
              type: 'divider',
            },
            {
              label: 'Reset Levels',
              onClick: () => {
                setOpen(false);
                props.state.setFilterLogLevels({
                  debug: false,
                  info: false,
                  warn: false,
                  error: false,
                });
              },
              key: 'reset',
            },
          ],
        }}
      >
        <Button
          onClick={() => setOpen(!open)}
          icon={isDefaultState ? <FilterOutlined /> : <FilterTwoTone />}
        />
      </Dropdown>
    );
  }

  const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userTZ = props.state.stateFiles['log-context.json']?.data?.systemTZ;
  const tz = props.state.isUserTZ ? userTZ : systemTZ;
  const offset = tzOffset(tz, new Date('2020-01-15T00:00:00Z'));
  const isTZSwitchable = userTZ && userTZ !== systemTZ;

  return (
    <Space className="SearchGroup">
      <div>
        <Space>
          <Typography.Text style={{ whiteSpace: 'nowrap' }}>TZ</Typography.Text>
          <Tooltip title={`${tz} (UTC${offset < 0 ? '' : '+'}${offset / 60})`}>
            <Switch
              disabled={!isTZSwitchable}
              checkedChildren={
                isTZSwitchable
                  ? 'System'
                  : `UTC${offset < 0 ? '' : '+'}${offset / 60}`
              }
              unCheckedChildren={'User'}
              checked={!props.state.isUserTZ}
              onChange={() => {
                props.state.toggleTZ();
              }}
            />
          </Tooltip>
        </Space>
      </div>
      <RangePicker
        showTime={{
          defaultValue: [
            dayjs('00:00:00', 'HH:mm:ss'),
            dayjs('23:59:59', 'HH:mm:ss'),
          ],
        }}
        onChange={handleDateRangeChange}
        allowEmpty={[true, true]}
      />
      <Divider type="vertical" />
      <Space className="FilterGroup">
        {renderFilter()}
        {showOnlySearchResultsButton}
      </Space>
      <Divider type="vertical" />
      <Space.Compact className="SearchInputGroup">
        <Input
          placeholder="Search"
          prefix={<SearchOutlined />}
          onChange={(e) => handleSearchQueryChange(e.target.value)}
          ref={searchRef}
          allowClear={true}
          count={{
            show: searchList.length > 0,
            strategy: () => {
              return searchIndex + 1; // result number is 1-indexed
            },
            max: searchList.length,
          }}
        />
        <Space.Compact>
          <Button
            icon={<ArrowUpOutlined />}
            onClick={() => handleSearchIndexChange(-1)}
            disabled={props.state.searchList.length === 0}
          />
          <Button
            icon={<ArrowDownOutlined />}
            onClick={() => handleSearchIndexChange(1)}
            disabled={props.state.searchList.length === 0}
          />
        </Space.Compact>
      </Space.Compact>
    </Space>
  );
});
