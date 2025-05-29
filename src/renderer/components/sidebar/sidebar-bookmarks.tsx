import { observer } from 'mobx-react';
import React, { useCallback } from 'react';
import { SleuthState } from '../../state/sleuth';
import { getFileName } from '../../../utils/get-file-name';
import { truncate } from '../../../utils/truncate-string';
import { Button, Dropdown, MenuProps, Tag, Tooltip, Typography } from 'antd';
import {
  BookFilled,
  BookOutlined,
  DeleteOutlined,
  ExportOutlined,
  PaperClipOutlined,
} from '@ant-design/icons';

import {
  saveBookmark,
  goToBookmark,
  exportBookmarks,
  deleteAllBookmarks,
} from '../../state/bookmarks';

interface SidebarBookmarksProps {
  state: SleuthState;
}

const SidebarBookmarks = observer((props: SidebarBookmarksProps) => {
  const bookmarkItems: MenuProps['items'] = props.state.bookmarks.map(
    (bookmark) => {
      const { logFile, logEntry } = bookmark;
      const fileName = getFileName(logFile);
      const shortLine = truncate(logEntry.message);
      const text = (
        <span>
          <Tag>
            {fileName}:{logEntry.line}
          </Tag>{' '}
          <Typography.Text code>{shortLine}</Typography.Text>
        </span>
      );
      return {
        label: (
          <div onClick={() => goToBookmark(props.state, bookmark)}>{text}</div>
        ),
        key: bookmark.logEntry.timestamp,
      };
    },
  );

  if (bookmarkItems.length > 0) {
    bookmarkItems.push({ type: 'divider' });
  }

  const actionItems: MenuProps['items'] = [
    {
      label: 'Bookmark current line',
      key: 'save-line',
      icon: <PaperClipOutlined />,
      onClick: useCallback(() => saveBookmark(props.state), [props.state]),
    },
    {
      label: 'Export bookmarks',
      key: 'export-bookmarks',
      icon: <ExportOutlined />,
      onClick: useCallback(() => exportBookmarks(props.state), [props.state]),
    },
    {
      label: 'Clear bookmarks',
      key: 'delete-all',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: useCallback(
        () => deleteAllBookmarks(props.state),
        [props.state],
      ),
    },
  ];
  return (
    <Dropdown
      menu={{
        items: [...bookmarkItems, ...actionItems],
      }}
      trigger={['click']}
      placement="bottomRight"
    >
      <Tooltip title="Bookmarks" placement="right">
        <Button
          icon={
            props.state.bookmarks.length > 0 ? <BookFilled /> : <BookOutlined />
          }
        />
      </Tooltip>
    </Dropdown>
  );
});

export { SidebarBookmarks };
