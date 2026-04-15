import React from 'react';
import { observer } from 'mobx-react';
import {
  Alert,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Result,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  AppstoreOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CloudOutlined,
  ExperimentOutlined,
  ExportOutlined,
  HddOutlined,
  LaptopOutlined,
  LockOutlined,
  WarningOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import type { DescriptionsItemType } from 'antd/es/descriptions';

import { SleuthState } from '../state/sleuth';
import { getFontForCSS } from './preferences/preferences-utils';
import {
  deriveDashboardData,
  type ConfigDiffEntry,
  type ITPolicyData,
} from './derive-dashboard-data';

function DashboardCard({
  title,
  icon,
  items,
  children,
  warnings,
  actions,
  span,
  emptyDescription,
}: {
  title: string;
  icon?: React.ReactNode;
  items: DescriptionsItemType[];
  children?: React.ReactNode;
  warnings?: React.ReactNode[];
  actions?: React.ReactNode[];
  span?: { xs?: number; xl?: number; xxl?: number };
  emptyDescription?: string;
}) {
  const { xs = 12, xl = 8, xxl = 6 } = span ?? {};
  const isEmpty = items.length === 0 && !children;
  const cardTitle = icon ? (
    <Space size={6}>
      {icon}
      {title}
    </Space>
  ) : (
    title
  );
  return (
    <Col xs={xs} xl={xl} xxl={xxl}>
      <Card className="StateDashboard-card" size="small" actions={actions}>
        {isEmpty ? (
          <>
            <Typography.Text strong className="StateDashboard-emptyTitle">
              {cardTitle}
            </Typography.Text>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={emptyDescription}
            />
          </>
        ) : (
          <>
            <Descriptions
              title={cardTitle}
              column={1}
              size="small"
              colon={false}
              items={items}
            />
            {children}
          </>
        )}
        {warnings?.map((w, i) => (
          <Alert
            key={i}
            type="warning"
            showIcon
            title={w}
            className="StateDashboard-warning"
          />
        ))}
      </Card>
    </Col>
  );
}

function renderJsonValue(v: unknown): React.ReactNode {
  return (
    <Typography.Text>
      {v === undefined ? 'undefined' : JSON.stringify(v)}
    </Typography.Text>
  );
}

function renderDiffTable(diffs: ConfigDiffEntry[]) {
  return (
    <Table
      className="StateDashboard-diff"
      size="small"
      pagination={false}
      dataSource={diffs}
      rowKey={(r) => r.key}
      columns={[
        {
          title: 'Key',
          dataIndex: 'key',
          render: (_v: string, record) => (
            <>
              <Typography.Text code>{record.key}</Typography.Text>
              {record.externalKey !== record.key && (
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: 'var(--ant-font-size-sm)' }}
                >
                  {' '}
                  ({record.externalKey})
                </Typography.Text>
              )}
            </>
          ),
        },
        {
          title: 'root-state',
          dataIndex: 'rootState',
          render: renderJsonValue,
        },
        {
          title: 'external-config',
          dataIndex: 'externalConfig',
          render: renderJsonValue,
        },
      ]}
    />
  );
}

function renderITPolicyChildren(itPolicy: ITPolicyData): React.ReactNode {
  if (!itPolicy.hasConfig) return undefined;

  const { defaultDiffs, policyDiffs, appliedDefaults, appliedPolicies } =
    itPolicy;

  if (defaultDiffs.length > 0 || policyDiffs.length > 0) {
    const diffSections = [
      { key: 'defaults', label: 'IT Defaults', diffs: defaultDiffs },
      { key: 'policies', label: 'IT Policies', diffs: policyDiffs },
    ].filter((s) => s.diffs.length > 0);

    return (
      <Collapse
        size="small"
        ghost
        items={diffSections.map((s) => ({
          key: s.key,
          label: (
            <>
              <WarningOutlined style={{ color: 'var(--ant-color-warning)' }} />{' '}
              {s.label} — {s.diffs.length} mismatched
            </>
          ),
          children: renderDiffTable(s.diffs),
        }))}
      />
    );
  }

  const configItems = (
    [
      ['d', 'default', appliedDefaults],
      ['p', 'policy', appliedPolicies],
    ] as const
  ).flatMap(([prefix, tag, entries]) =>
    Object.entries(entries).map(([key, value]) => ({
      key: `${prefix}-${key}`,
      label: (
        <>
          <Typography.Text code>{key}</Typography.Text> <Tag>{tag}</Tag>
        </>
      ),
      children: <Typography.Text>{JSON.stringify(value)}</Typography.Text>,
    })),
  );

  if (configItems.length > 0) {
    return (
      <Result
        icon={
          <CheckCircleOutlined style={{ color: 'var(--ant-color-success)' }} />
        }
        subTitle="External config and root state match"
      >
        <Descriptions
          column={1}
          size="small"
          colon={false}
          items={configItems}
        />
      </Result>
    );
  }

  return undefined;
}

export const StateDashboard = observer(({ state }: { state: SleuthState }) => {
  const {
    font,
    appItems,
    crashItems,
    sentryHref,
    envItems,
    envWarnings,
    itPolicy,
    notifCategories,
    experiments,
    hardwareItems,
    networkItems,
    virtualizationItems,
  } = deriveDashboardData(state);

  // Build experiment children
  const added = experiments.filter((e) =>
    e.flags.every((f) => !f.startsWith('-')),
  );
  const removed = experiments.filter((e) =>
    e.flags.some((f) => f.startsWith('-')),
  );
  const experimentList = (
    items: typeof experiments,
    color: string,
    verb: string,
  ) => (
    <Collapse
      size="small"
      ghost
      items={items.map(({ experiment, flags }, i) => ({
        key: `${experiment}-${i}`,
        label: flags.map((f) => (
          <Tag key={f} color={color}>
            {f}
          </Tag>
        )),
        children: (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 'var(--ant-font-size-sm)' }}
          >
            {experiment ? (
              <>
                {verb} via{' '}
                <Typography.Text
                  code
                  style={{ fontSize: 'var(--ant-font-size-sm)' }}
                >
                  {experiment}
                </Typography.Text>
              </>
            ) : (
              'Default value for all users'
            )}
          </Typography.Text>
        ),
      }))}
    />
  );
  const experimentChildren =
    experiments.length > 0 ? (
      <>
        {added.length > 0 && (
          <>
            <Typography.Text type="secondary">Added</Typography.Text>
            {experimentList(added, 'green', 'Enabled')}
          </>
        )}
        {removed.length > 0 && (
          <>
            <Typography.Text type="secondary">Removed</Typography.Text>
            {experimentList(removed, 'red', 'Disabled')}
          </>
        )}
      </>
    ) : undefined;

  const cards: Array<{
    title: string;
    icon: React.ReactNode;
    items: DescriptionsItemType[];
    emptyDescription: string;
    children?: React.ReactNode;
    actions?: React.ReactNode[];
    warnings?: React.ReactNode[];
    span?: { xs?: number; xl?: number; xxl?: number };
  }> = [
    {
      title: 'App',
      icon: <AppstoreOutlined />,
      items: appItems,
      emptyDescription: 'No app info available',
    },
    {
      title: 'Crashes',
      icon: <WarningOutlined />,
      items: crashItems,
      emptyDescription: 'No crash data available',
      actions: sentryHref
        ? [
            <Button
              key="sentry"
              type="link"
              size="small"
              onClick={() => window.Sleuth.openExternal(sentryHref)}
            >
              View in Sentry <ExportOutlined />
            </Button>,
          ]
        : undefined,
    },
    {
      title: 'Environment',
      icon: <LaptopOutlined />,
      items: envItems,
      emptyDescription: 'No environment data available',
      warnings: envWarnings,
    },
    {
      title: 'Experiments',
      icon: <ExperimentOutlined />,
      items: [],
      emptyDescription: 'No feature overrides',
      children: experimentChildren,
    },
    {
      title: 'Hardware',
      icon: <HddOutlined />,
      items: hardwareItems,
      emptyDescription: 'No hardware diagnostics available',
    },
    {
      title: 'IT Policy',
      icon: <LockOutlined />,
      items: [],
      emptyDescription: 'No IT policies configured',
      children: renderITPolicyChildren(itPolicy),
    },
    {
      title: 'Network',
      icon: <WifiOutlined />,
      items: networkItems,
      emptyDescription: 'No network diagnostics available',
    },
    {
      title: 'Notification Warnings',
      icon: <BellOutlined />,
      emptyDescription: 'No notification warnings',
      span: { xs: 24, xl: 16 },
      items: notifCategories.map(({ category, warnings }) => ({
        key: category,
        label: category,
        children: (
          <ul className="StateDashboard-list">
            {warnings.map(({ code, description }) => (
              <li key={code}>
                <Typography.Text code>{code}</Typography.Text>
                {description && (
                  <Typography.Text type="secondary">
                    {' '}
                    — {description}
                  </Typography.Text>
                )}
              </li>
            ))}
          </ul>
        ),
      })),
    },
    {
      title: 'Virtualization',
      icon: <CloudOutlined />,
      items: virtualizationItems,
      emptyDescription: 'No virtualization data available',
    },
  ];

  // Sort: cards with data first (alphabetically), then empty cards (alphabetically)
  cards.sort((a, b) => {
    const aHasData = a.items.length > 0 || !!a.children;
    const bHasData = b.items.length > 0 || !!b.children;
    if (aHasData !== bHasData) return aHasData ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="StateDashboard" style={{ fontFamily: getFontForCSS(font) }}>
      <Typography.Title level={4}>Summary</Typography.Title>
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <DashboardCard key={card.title} {...card} />
        ))}
      </Row>
    </div>
  );
});
