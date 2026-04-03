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
    <fieldset
      style={{
        border: 'none',
        borderTop: '1px solid var(--ant-color-border)',
        margin: 0,
        padding: '4px 0 12px',
      }}
    >
      <legend
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          padding: '0 4px 0 0',
          margin: 0,
        }}
      >
        <Typography.Text
          type="secondary"
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {title}
        </Typography.Text>
        {!allShown && (
          <Typography.Text
            strong
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              cursor: 'pointer',
            }}
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
            style={{
              padding: '1px 4px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 4,
              cursor: 'pointer',
              background: isHovered
                ? 'var(--ant-color-fill-secondary)'
                : 'transparent',
              transition: 'background 0.15s ease',
            }}
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
              <Typography.Text style={{ fontSize: 14 }}>
                {label}
              </Typography.Text>
            </Space>
            <span
              style={{
                position: 'relative',
                minWidth: 36,
                textAlign: 'right',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              {count !== undefined && (
                <Typography.Text
                  type="secondary"
                  style={{
                    fontSize: 14,
                    opacity: isHovered ? 0 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {count >= 1000
                    ? `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`
                    : count}
                </Typography.Text>
              )}
              <Typography.Text
                strong
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  opacity: isHovered ? 1 : 0,
                  transition: 'opacity 0.15s ease',
                  color: 'var(--ant-color-primary)',
                }}
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
