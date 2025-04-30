declare global {
  interface Window {
    Sleuth: {
      platform: 'win32' | 'darwin' | 'linux';
      versions: NodeJS.ProcessVersions;
      sleuthVersion: string;
    };
  }
}

export {};
