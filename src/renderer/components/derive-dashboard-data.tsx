import React from 'react';
import { Space, Tag, Tooltip, Typography } from 'antd';
import {
  AppleFilled,
  ExportOutlined,
  HourglassOutlined,
  LinuxOutlined,
  ThunderboltOutlined,
  WindowsFilled,
} from '@ant-design/icons';
import { isEqual } from 'lodash';
import type { DescriptionsItemType } from 'antd/es/descriptions';

import { SleuthState } from '../state/sleuth';
import {
  EXTERNAL_TO_INTERNAL,
  INTERNAL_TO_EXTERNAL,
  getOSInfo,
} from '../../utils/settings-data-helper';
import { getSentryHref } from '../sentry';

const NA = <Typography.Text type="secondary">N/A</Typography.Text>;

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  darwin: <AppleFilled />,
  win32: <WindowsFilled />,
  linux: <LinuxOutlined />,
};

const WARNING_DESCRIPTIONS = {
  'Quiet Hours': {
    QUIET_HOURS:
      'Are Windows Quiet Hours (8 - 10) or Windows Focus Assist (10+) active?',
  },
  'Presentation Mode': {
    PRESENTATION_QUIET_TIME:
      'The current user is in "quiet time", which is the first hour after a new user logs into his or her account for the first time.',
    PRESENTATION_D3D_FULL_SCREEN:
      'A full-screen (exclusive mode) Direct3D application is running.',
    PRESENTATION_MODE:
      'The user has activated Windows presentation settings to block notifications and pop-up messages.',
    PRESENTATION_BUSY:
      'A full-screen application is running or Presentation Settings are applied.',
  },
  'Action Center': {
    AC_DISABLED_BY_MANIFEST:
      'The user has disabled notifications for Slack in Windows Settings.',
    AC_DISABLED_BY_GROUP_POLICY: '',
    AC_DISABLED_FOR_USER: '',
    AC_DISABLED_FOR_APPLICATION: '',
  },
  'Slack Preferences': {
    ZERO_MAX: 'Do we have only zero notifications allowed?',
    ZERO_TIMEOUT: 'Is the notifications timeout very short?',
    UNKNOWN_METHOD: 'Is an unknown notification method set?',
    UNKNOWN_HTML_STYLE: 'Is an unknown html notification style set?',
    NATIVE_PLAYBACK_ENFORCED: 'Is a certain sound playback style enforced?',
    WEBAPP_PLAYBACK_ENFORCED: 'Is a certain sound playback style enforced?',
    FAILOVER_WITHIN_LAST_WEEK: 'Did we just have a failover?',
    FAILOVER_DISABLED: 'Are failovers disabled?',
    GPU_COMPOSITION_UNAVAILABLE: 'Is GPU Composition not available?',
    AERO_GLASS_UNAVAILABLE: 'Is Aero Glass / DWM not available?',
  },
} as const;

const WARNING_CATEGORIES = Object.keys(WARNING_DESCRIPTIONS) as Array<
  keyof typeof WARNING_DESCRIPTIONS
>;

function formatMemory(
  available: number | null | undefined,
  total: number | null | undefined,
): React.ReactNode {
  if (available != null && total != null) {
    return `${available}/${total} GB available`;
  }
  if (total != null) {
    return `${total} GB`;
  }
  return NA;
}

export interface ConfigDiffEntry {
  section: 'defaults' | 'policies';
  key: string;
  externalKey: string;
  rootState: unknown;
  externalConfig: unknown;
}

/**
 * Diff external-config values against root-state values, mapping external
 * setting names to their internal equivalents before comparing.
 *
 * @param section  Which layer we're diffing ('defaults' or 'policies')
 * @param rootObj  root-state.json settings layer (internal names)
 * @param extObj   external-config.json section (external names)
 */
function diffKeys(
  section: 'defaults' | 'policies',
  rootObj: Record<string, unknown> | undefined,
  extObj: Record<string, unknown> | undefined,
): ConfigDiffEntry[] {
  const rs = rootObj ?? {};
  const ec = extObj ?? {};
  const diffs: ConfigDiffEntry[] = [];

  // Track which root-state keys we've matched so we can detect orphans
  const matchedRsKeys = new Set<string>();

  // Walk external-config keys — map each to its internal name
  for (const extKey of Object.keys(ec)) {
    const intKey =
      (EXTERNAL_TO_INTERNAL as Record<string, string>)[extKey] ?? extKey;
    matchedRsKeys.add(intKey);

    if (!isEqual(rs[intKey], ec[extKey])) {
      diffs.push({
        section,
        key: intKey,
        externalKey: extKey,
        rootState: rs[intKey],
        externalConfig: ec[extKey],
      });
    }
  }

  // Walk root-state keys that had no external-config counterpart
  for (const intKey of Object.keys(rs)) {
    if (matchedRsKeys.has(intKey)) continue;
    const extKey = INTERNAL_TO_EXTERNAL[intKey] ?? intKey;
    diffs.push({
      section,
      key: intKey,
      externalKey: extKey,
      rootState: rs[intKey],
      externalConfig: undefined,
    });
  }

  return diffs;
}

export interface NotifCategory {
  category: keyof typeof WARNING_DESCRIPTIONS;
  warnings: Array<{ code: string; description: string }>;
}

export interface ExperimentOverride {
  experiment: string;
  type: string;
  flags: string[];
}

export type ITPolicyData =
  | { hasConfig: false }
  | {
      hasConfig: true;
      appliedDefaults: Record<string, unknown>;
      appliedPolicies: Record<string, unknown>;
      defaultDiffs: ConfigDiffEntry[];
      policyDiffs: ConfigDiffEntry[];
    };

export interface DashboardData {
  font: string;
  appItems: DescriptionsItemType[];
  crashItems: DescriptionsItemType[];
  sentryHref: string | null;
  envItems: DescriptionsItemType[];
  envWarnings: React.ReactNode[];
  itPolicy: ITPolicyData;
  notifCategories: NotifCategory[];
  experiments: ExperimentOverride[];
  hardwareItems: DescriptionsItemType[];
  networkItems: DescriptionsItemType[];
  virtualizationItems: DescriptionsItemType[];
}

function safeDerive<T>(fn: () => T, fallback: T, section: string): T {
  try {
    return fn();
  } catch (error) {
    console.warn(`StateDashboard: failed to derive "${section}":`, error);
    return fallback;
  }
}

export function deriveDashboardData(state: SleuthState): DashboardData {
  const { stateFiles, font } = state;

  const env = stateFiles['environment.json']?.data;
  const localSettings = stateFiles['local-settings.json']?.data;
  const rootState = stateFiles['root-state.json']?.data;
  const logContext = stateFiles['log-context.json']?.data;
  const notifWarnings = stateFiles['notification-warnings.json']?.data;
  const installationState = stateFiles['installation'];
  const externalConfig = stateFiles['external-config.json']?.data;
  const diagnostic = stateFiles['diagnostic.json']?.data;
  const manifest = stateFiles['logfiles-shipping-manifest.json']?.data;

  // -- Derived values --
  const gpuInfoFile = state.processedLogFiles?.state?.find(
    (f) => f.fileName === 'gpu-info.html',
  );
  const platformText = env ? getOSInfo(env) : null;
  const gpuAvailable = env?.isGpuCompositionAvailable;
  const channel = rootState?.settings?.releaseChannelOverride;

  const crashDumpCount = Array.isArray(manifest?.files)
    ? manifest.files.filter(
        (f: any) =>
          typeof f?.fileName === 'string' && f.fileName.endsWith('.dmp'),
      ).length
    : 0;

  let sentryId: string | null = null;
  if (Array.isArray(installationState?.data) && installationState.data[0]) {
    try {
      sentryId = atob(installationState.data[0]);
    } catch (error) {
      console.warn('Failed to decode installation ID as base64:', error);
    }
  }

  // Electron release link
  const electronVersion = localSettings?.lastElectronVersionLaunched as
    | string
    | undefined;
  let electronDisplay: React.ReactNode = NA;
  if (electronVersion) {
    const link = `https://releases.electronjs.org/release/v${electronVersion}`;
    electronDisplay = (
      <span>
        {electronVersion}{' '}
        <Tooltip title="See release notes">
          <Typography.Link onClick={() => window.Sleuth.openExternal(link)}>
            <ExportOutlined />
          </Typography.Link>
        </Tooltip>
      </span>
    );
  }

  // IT Policy / External Config comparison
  const itPolicy: ITPolicyData = safeDerive(
    () => {
      if (
        externalConfig?.externalConfig &&
        typeof externalConfig.externalConfig === 'object' &&
        !Array.isArray(externalConfig.externalConfig) &&
        externalConfig?.rootState &&
        typeof externalConfig.rootState === 'object'
      ) {
        const { defaults: ecDefaults, ...ecPolicies } =
          externalConfig.externalConfig;
        const ecRootState = externalConfig.rootState;
        const rsDefaults = ecRootState?.settings?.itDefaults;
        const rsPolicies = ecRootState?.settings?.itPolicy;

        return {
          hasConfig: true as const,
          appliedDefaults: rsDefaults ?? {},
          appliedPolicies: rsPolicies ?? {},
          defaultDiffs: diffKeys('defaults', rsDefaults, ecDefaults),
          policyDiffs: diffKeys('policies', rsPolicies, ecPolicies),
        };
      }
      return { hasConfig: false as const };
    },
    { hasConfig: false },
    'IT Policy',
  );

  // Notification warnings — categorized
  const notifCategories: NotifCategory[] = safeDerive(
    () => {
      const result: NotifCategory[] = [];
      if (Array.isArray(notifWarnings) && notifWarnings.length > 0) {
        for (const category of WARNING_CATEGORIES) {
          const dict = WARNING_DESCRIPTIONS[category];
          const matched = Object.keys(dict).filter((code) =>
            notifWarnings.includes(code),
          );
          if (matched.length > 0) {
            result.push({
              category,
              warnings: matched.map((code) => ({
                code,
                description: dict[code as keyof typeof dict],
              })),
            });
          }
        }
      }
      return result;
    },
    [],
    'Notification Warnings',
  );

  // ========== ITEMS ==========

  const appItems: DescriptionsItemType[] = safeDerive(
    () => [
      {
        key: 'channel',
        label: 'Release Channel',
        children: (
          <Tag color={!channel || channel === 'prod' ? 'green' : 'orange'}>
            {channel ?? 'prod'}
          </Tag>
        ),
      },
      {
        key: 'distribution',
        label: 'Distribution',
        children: env?.distribution ?? NA,
      },
      { key: 'version', label: 'App Version', children: env?.appVersion ?? NA },
      { key: 'electron', label: 'Electron', children: electronDisplay },
      {
        key: 'chrome',
        label: 'Chrome',
        children: diagnostic?.hardware?.chrome_version ?? NA,
      },
    ],
    [],
    'App',
  );

  const sentryHref = sentryId ? getSentryHref(sentryId) : null;

  const crashItems: DescriptionsItemType[] = safeDerive(
    () => [
      ...(sentryId
        ? [
            {
              key: 'sentry',
              label: 'Sentry ID',
              children: <Typography.Text code>{sentryId}</Typography.Text>,
            },
          ]
        : []),
      {
        key: 'crashDumps',
        label: 'Crash Dumps',
        children: (
          <Tag color={crashDumpCount > 0 ? 'red' : 'green'}>
            {crashDumpCount} .dmp {crashDumpCount === 1 ? 'file' : 'files'}
          </Tag>
        ),
      },
    ],
    [],
    'Crashes',
  );

  const platformIcon = env?.platform
    ? (PLATFORM_ICONS[env.platform] ?? null)
    : null;

  const { envItems, envWarnings } = safeDerive(
    () => {
      const items: DescriptionsItemType[] = [
        {
          key: 'platform',
          label: 'Platform',
          children: platformText ? (
            <Space>
              {platformIcon}
              {platformText}
            </Space>
          ) : (
            NA
          ),
        },
        ...(env?.win32?.osProduct
          ? [
              {
                key: 'osProduct',
                label: 'OS Product',
                children: env.win32.osProduct,
              },
            ]
          : []),
        {
          key: 'arch',
          label: 'Architecture',
          children: env?.arch ?? NA,
        },
        {
          key: 'gpu',
          label: 'GPU Composition',
          children:
            gpuAvailable != null ? (
              <Space>
                <Tag color={gpuAvailable ? 'green' : 'red'}>
                  {gpuAvailable ? 'Available' : 'Unavailable'}
                </Tag>
                {gpuInfoFile && (
                  <Typography.Link
                    onClick={() => state.selectFile(gpuInfoFile)}
                    style={{ fontSize: 'var(--ant-font-size-sm)' }}
                  >
                    (see gpu info)
                  </Typography.Link>
                )}
              </Space>
            ) : (
              NA
            ),
        },
        {
          key: 'timezone',
          label: 'Timezone',
          children: logContext?.systemTZ ?? NA,
        },
      ];

      const warnings: React.ReactNode[] = [];
      if (
        env?.platform === 'darwin' &&
        typeof env?.resourcePath === 'string' &&
        !env.resourcePath.startsWith('/Applications/Slack.app')
      ) {
        warnings.push(
          <>
            App is running from{' '}
            <Typography.Text code>{env.resourcePath}</Typography.Text> instead
            of <Typography.Text code>/Applications/Slack.app</Typography.Text>,
            which may cause performance issues.
          </>,
        );
      }

      return { envItems: items, envWarnings: warnings };
    },
    { envItems: [], envWarnings: [] },
    'Environment',
  );

  // Experiments — electron feature overrides
  const experiments: ExperimentOverride[] = safeDerive(
    () => {
      const result: ExperimentOverride[] = [];
      if (Array.isArray(localSettings?.electronFeatureOverrides)) {
        const FLAG_PREFIXES: Array<[string, string]> = [
          ['enable_chrome_features', '+chrome'],
          ['disable_chrome_features', '-chrome'],
          ['enable_blink_features', '+blink'],
          ['disable_blink_features', '-blink'],
          ['add_browser_command_line_args', 'arg'],
        ];
        for (const entry of localSettings.electronFeatureOverrides) {
          if (!entry || typeof entry !== 'object') continue;
          const flags: string[] = [];
          for (const [field, prefix] of FLAG_PREFIXES) {
            const fieldValue = entry[field];
            if (!Array.isArray(fieldValue)) continue;
            for (const f of fieldValue) flags.push(`${prefix}:${f}`);
          }
          if (flags.length === 0) continue;
          result.push({
            experiment: entry.experiment || '',
            type: entry.type ?? 'unknown',
            flags,
          });
        }
      }
      return result;
    },
    [],
    'Experiments',
  );

  // Diagnostic data
  const hw = diagnostic?.hardware;
  const net = diagnostic?.network;
  const virt = diagnostic?.virtualization;

  const hardwareItems: DescriptionsItemType[] = safeDerive(
    () =>
      hw
        ? [
            { key: 'cpu', label: 'CPU', children: hw.cpu_model ?? NA },
            {
              key: 'cores',
              label: 'Logical Cores',
              children: hw.cpu_logical_core ?? NA,
            },
            {
              key: 'clock',
              label: 'Clock Speed',
              children: hw.cpu_clock_speed ? `${hw.cpu_clock_speed} MHz` : NA,
            },
            {
              key: 'model',
              label: 'Machine',
              children:
                hw.machine_model_name && hw.machine_model_version
                  ? `${hw.machine_model_name} ${hw.machine_model_version}`
                  : NA,
            },
            {
              key: 'memory',
              label: 'Memory',
              children: formatMemory(
                hw.available_memory_gb,
                hw.total_memory_in_gb,
              ),
            },
            { key: 'locale', label: 'Locale', children: hw.locale ?? NA },
            {
              key: 'uptime',
              label: 'Uptime',
              children:
                hw.uptime_hours != null ? `${hw.uptime_hours} hours` : NA,
            },
          ]
        : [],
    [],
    'Hardware',
  );

  const networkItems: DescriptionsItemType[] = safeDerive(
    () =>
      net
        ? [
            {
              key: 'effectiveType',
              label: 'Connection Type',
              children: net.connectionEffectiveType ? (
                <Space>
                  {net.connectionEffectiveType.includes('fast') ? (
                    <ThunderboltOutlined
                      style={{ color: 'var(--ant-color-success)' }}
                    />
                  ) : (
                    <HourglassOutlined
                      style={{ color: 'var(--ant-color-warning)' }}
                    />
                  )}
                  {net.connectionEffectiveType}
                </Space>
              ) : (
                NA
              ),
            },
            {
              key: 'downlink',
              label: 'Downlink Speed',
              children:
                net.downlinkSpeed != null ? `${net.downlinkSpeed} Mbps` : NA,
            },
          ]
        : [],
    [],
    'Network',
  );

  const virtualizationItems: DescriptionsItemType[] = safeDerive(
    () => {
      const items: DescriptionsItemType[] = [];
      if (virt && typeof virt === 'object') {
        for (const [key, value] of Object.entries(virt)) {
          items.push({
            key,
            label: key,
            children:
              typeof value === 'object' && value !== null
                ? JSON.stringify(value)
                : String(value),
          });
        }
      }
      return items;
    },
    [],
    'Virtualization',
  );

  return {
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
  };
}
