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
  let windowsInfo = '';

  if (os === 'Windows' && platformVersion) {
    const niceName = getWindowsVersion(platformVersion);
    windowsInfo = pretendNotReallyWindows10
      ? ` We're pretending it's an older version, but the user is running on ${niceName}`
      : ` That's ${niceName}`;
  }

  return `${os} ${osVersion}.${windowsInfo}`;
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

  return os;
}

function getWindowsVersion({
  major,
  minor,
  build,
}: {
  major: number;
  minor: number;
  build: number;
}): string {
  const windowsVersions: Record<string, { os: number; version: string }> = {
    '10240': {
      os: 10,
      version: 'Version 1507 (RTM)',
    },
    '10586': {
      os: 10,
      version: 'Version 1511',
    },
    '14393': {
      os: 10,
      version: 'Version 1607',
    },
    '15063': {
      os: 10,
      version: 'Version 1703',
    },
    '16299': {
      os: 10,
      version: 'Version 1709',
    },
    '17134': {
      os: 10,
      version: 'Version 1803',
    },
    '17763': {
      os: 10,
      version: 'Version 1809',
    },
    '18362': {
      os: 10,
      version: 'Version 1903',
    },
    '18363': {
      os: 10,
      version: 'Version 1909',
    },
    '19041': {
      os: 10,
      version: 'Version 2004',
    },
    '19042': {
      os: 10,
      version: 'Version 20H2',
    },
    '19043': {
      os: 10,
      version: 'Version 21H1',
    },
    '19044': {
      os: 10,
      version: 'Version 21H2',
    },
    '19045': {
      os: 10,
      version: 'Version 22H2',
    },
    '22000': {
      os: 11,
      version: 'Version 21H2',
    },
    '22621': {
      os: 11,
      version: 'Version 22H2',
    },
    '22631': {
      os: 11,
      version: 'Version 23H2',
    },
    '26100': {
      os: 11,
      version: 'Version 24H2',
    },
  } as const;
  let version: { os: number; version: string } = { os: 0, version: '' };

  for (const [key, value] of Object.entries(windowsVersions)) {
    if (build < Number(key)) {
      break;
    } else {
      version = value;
    }
  }

  return `Windows ${version.os} ${version.version}.`;
}
