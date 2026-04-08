import { Checkbox, Space, Typography } from 'antd';
import React, { useState } from 'react';

export interface CheckboxItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

interface SidebarCheckboxGroupProps {
  title: string;
  items: CheckboxItem[];
  filter: Record<string, boolean>;
  onToggle: (key: string, checked: boolean) => void;
  onFocus: (key: string) => void;
  onShowAll: () => void;
  /** When is "all shown"? 'all-true' = all checked means all shown (log types).
   *  'all-false' = all unchecked means all shown (log levels). */
  allShownWhen: 'all-true' | 'all-false';
}

export function SidebarCheckboxGroup({
  title,
  items,
  filter,
  onToggle,
  onFocus,
  onShowAll,
  allShownWhen,
}: SidebarCheckboxGroupProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const allShown =
    allShownWhen === 'all-true'
      ? items.every(({ key }) => filter[key])
      : items.every(({ key }) => !filter[key]);

  return (
    <fieldset className="SidebarCheckboxGroup">
      <legend className="SidebarCheckboxGroup-legend">
        <Typography.Text
          type="secondary"
          className="SidebarCheckboxGroup-title"
        >
          {title}
        </Typography.Text>
        {!allShown && (
          <Typography.Text
            strong
            className="SidebarCheckboxGroup-showAll"
            onClick={onShowAll}
          >
            Show all
          </Typography.Text>
        )}
      </legend>
      {items.map(({ key, label, icon, count }) => {
        const isHovered = hoveredKey === key;
        return (
          <div
            key={key}
            className="SidebarCheckboxGroup-row"
            onMouseEnter={() => setHoveredKey(key)}
            onMouseLeave={() => setHoveredKey(null)}
            onClick={() => onFocus(key)}
          >
            <Checkbox
              checked={filter[key]}
              onChange={(e) => {
                e.stopPropagation();
                onToggle(key, e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <Space size={4} style={{ flex: 1 }}>
              {icon}
              <Typography.Text className="SidebarCheckboxGroup-label">
                {label}
              </Typography.Text>
            </Space>
            <span className="SidebarCheckboxGroup-countWrap">
              {count !== undefined && (
                <Typography.Text
                  type="secondary"
                  className="SidebarCheckboxGroup-count"
                  style={{ opacity: isHovered ? 0 : 1 }}
                >
                  {count >= 1000
                    ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`
                    : count}
                </Typography.Text>
              )}
              <Typography.Text
                strong
                className="SidebarCheckboxGroup-only"
                style={{ opacity: isHovered ? 1 : 0 }}
              >
                ONLY
              </Typography.Text>
            </span>
          </div>
        );
      })}
    </fieldset>
  );
}
