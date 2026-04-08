import { observer } from 'mobx-react';
import React, { useEffect } from 'react';
import { debounce } from 'lodash';
import {
  Button,
  DatePicker,
  Divider,
  Input,
  InputRef,
  Space,
  Switch,
  Tooltip,
} from 'antd';
import { SleuthState } from '../state/sleuth';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { TZDate, tzOffset } from '@date-fns/tz';
import dateFnsGenerateConfig from 'rc-picker/lib/generate/dateFns';

import { getTZDateFromString } from '../../utils/get-tz-date-from-string';

export interface FilterProps {
  state: SleuthState;
}

export const Filter = observer((props: FilterProps) => {
  const searchRef = React.useRef<InputRef>(null);

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

  const handleDateRangeChange = (values: [Date, Date]) => {
    const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const userTZ = props.state.stateFiles['log-context.json']?.data?.systemTZ;
    const tz = props.state.isUserTZ ? userTZ : systemTZ;

    props.state.dateRange = {
      from:
        values && values[0]
          ? getTZDateFromString(values[0].toISOString(), tz)
          : null,
      to:
        values && values[1]
          ? getTZDateFromString(values[1].toISOString(), tz)
          : null,
    };
  };

  useEffect(() => {
    const destructor = window.Sleuth.focusFind(() =>
      searchRef.current?.focus(),
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

  const { RangePicker } = DatePicker.generatePicker<Date>(
    dateFnsGenerateConfig,
  );

  const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userTZ = props.state.stateFiles['log-context.json']?.data?.systemTZ;
  const tz = props.state.isUserTZ ? userTZ : systemTZ;
  const isTZSwitchable = userTZ && userTZ !== systemTZ;

  let offset = '';

  // We do our best to represent the UTC offset based on the latest log entry's date.
  // This could be wrong if daylight savings time changed in the middle of the log bundle.
  if (userTZ && props.state.processedLogFiles?.browser[0]) {
    const latestDate =
      props.state.processedLogFiles.browser[0].logEntries[0].momentValue;
    if (latestDate) {
      const offsetInMinutes = tzOffset(tz, new TZDate(latestDate, tz));
      const offsetTime = Math.abs(offsetInMinutes) / 60;
      const offsetDirection = offsetInMinutes < 0 ? '-' : '+';
      offset = `${offsetDirection}${String(offsetTime)}`;
    }
  }

  return (
    <Space className="SearchGroup">
      {!!userTZ && (
        <div>
          <Space>
            <Tooltip placement="right" title={`${tz} (UTC${offset})`}>
              <Switch
                disabled={!isTZSwitchable}
                checkedChildren={
                  isTZSwitchable ? 'TZ: System' : `TZ: UTC${offset}`
                }
                unCheckedChildren={'TZ: User'}
                checked={!props.state.isUserTZ}
                onChange={() => {
                  props.state.toggleTZ();
                }}
              />
            </Tooltip>
          </Space>
        </div>
      )}
      <RangePicker
        showTime
        onChange={handleDateRangeChange}
        value={[
          props.state.dateRange.from
            ? new TZDate(props.state.dateRange.from, tz)
            : null,
          props.state.dateRange.to
            ? new TZDate(props.state.dateRange.to, tz)
            : null,
        ]}
      />
      <Divider type="vertical" />
      <Space className="FilterGroup">{showOnlySearchResultsButton}</Space>
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
