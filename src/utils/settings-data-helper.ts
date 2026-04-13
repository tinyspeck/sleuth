/**
 * Maps external setting names (used in external-config.json) to internal
 * setting names (used in root-state.json settings layers).
 *
 * Derived from slack-desktop's external-settings.ts.
 */
export const EXTERNAL_TO_INTERNAL = {
  HardwareAcceleration: 'useHwAcceleration',
  DownloadPath: 'PrefSSBFileDownloadPath',
  HideOnStartup: 'hideOnStartup',
  DefaultSignInTeam: 'defaultSigninTeam',
  SignInMethod: 'signInMethod',
  ReleaseChannel: 'releaseChannelOverride',
  WebSwitches: 'webSwitches',
  AutoUpdate: 'AutoUpdate',
  ClientEnvironment: 'ClientEnvironment',
} as const satisfies Record<string, string>;

export const INTERNAL_TO_EXTERNAL: Record<string, string> = Object.fromEntries(
  Object.entries(EXTERNAL_TO_INTERNAL).map(([ext, int]) => [int, ext]),
);

export function getOSInfo(data?: Record<string, any>): string {
  if (!data) {
    return 'Unknown';
  }

  const os = getPlatform(data);
  const { platformVersion, pretendNotReallyWindows10 } = data;
  const osVersion =
    platformVersion && platformVersion.major
      ? `(${platformVersion.major}.${platformVersion.minor}.${platformVersion.build})`
      : '(unknown version)';

  if (os === 'macOS') {
    const macVersion = data.darwin?.macOSVersion;
    if (macVersion) {
      return `macOS ${macVersion}`;
    }
  }

  if (os === 'Windows' && platformVersion) {
    const winVersion = getWindowsVersion(platformVersion);
    if (winVersion) {
      const pretendNote = pretendNotReallyWindows10
        ? ' (pretending older version)'
        : '';
      return `${winVersion} ${osVersion}${pretendNote}`;
    }
  }

  return `${os} ${osVersion}`;
}

function getPlatform(data?: Record<string, any>): string {
  if (!data) {
    return 'unknown';
  }

  const { platform } = data;
  let os = platform
    ? platform
        .replace('darwin', 'macOS')
        .replace('win32', 'Windows')
        .replace('linux', 'Linux')
    : null;

  if (!os) {
    if (data.win32) {
      os = 'Windows';
    } else if (data.darwin) {
      os = 'macOS';
    } else if (data.linux) {
      os = 'Linux';
    }
  }

  return os ?? 'Unknown';
}

function getWindowsVersion({
  _major,
  _minor,
  build,
}: {
  _major: number;
  _minor: number;
  build: number;
}): string | null {
  const windowsVersions: Record<string, { os: number; version: string }> = {
    '10240': {
      os: 10,
      version: '1507 (RTM)',
    },
    '10586': {
      os: 10,
      version: '1511',
    },
    '14393': {
      os: 10,
      version: '1607',
    },
    '15063': {
      os: 10,
      version: '1703',
    },
    '16299': {
      os: 10,
      version: '1709',
    },
    '17134': {
      os: 10,
      version: '1803',
    },
    '17763': {
      os: 10,
      version: '1809',
    },
    '18362': {
      os: 10,
      version: '1903',
    },
    '18363': {
      os: 10,
      version: '1909',
    },
    '19041': {
      os: 10,
      version: '2004',
    },
    '19042': {
      os: 10,
      version: '20H2',
    },
    '19043': {
      os: 10,
      version: '21H1',
    },
    '19044': {
      os: 10,
      version: '21H2',
    },
    '19045': {
      os: 10,
      version: '22H2',
    },
    '22000': {
      os: 11,
      version: '21H2',
    },
    '22621': {
      os: 11,
      version: '22H2',
    },
    '22631': {
      os: 11,
      version: '23H2',
    },
    '26100': {
      os: 11,
      version: '24H2',
    },
  } as const;
  let version: { os: number; version: string } | null = null;

  for (const [key, value] of Object.entries(windowsVersions)) {
    if (build < Number(key)) {
      break;
    } else {
      version = value;
    }
  }

  if (!version) return null;
  return `Windows ${version.os} ${version.version}`;
}
