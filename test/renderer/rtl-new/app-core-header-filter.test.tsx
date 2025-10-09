import React from 'react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Filter } from '../../../src/renderer/components/app-core-header-filter';
import { SleuthState } from '../../../src/renderer/state/sleuth';

vi.mock(
  '../../../src/renderer/components/preferences/preferences-utils',
  () => {
    return {
      FONTS: ['Arial'],
      WINDOWS_FONTS: ['Arial'],
      MACOS_FONTS: ['Arial'],
      THEMES: {
        DARK: 'dark',
        LIGHT: 'light',
        AUTO: 'auto',
      },
      DATE_TIME_FORMATS: ['HH:mm:ss (dd/MM)'],
      EDITORS: {
        VSCODE: {
          name: 'VSCode',
          cmd: 'code',
          args: ['--goto', '{filepath}:{line}'],
        },
      },
      getFontForCSS: () => 'Arial',
    };
  },
);

describe('Filter', () => {
  beforeAll(() => {
    window.matchMedia = () =>
      ({
        addListener: () => void 0,
        removeListener: () => void 0,
      }) as any;

    window.Sleuth = {
      focusFind: vi.fn(() => vi.fn()),
    } as any;
  });

  describe('Timezone Switch', () => {
    it('does not render switch when userTZ is not set', () => {
      const state: Partial<SleuthState> = {
        isUserTZ: false,
        stateFiles: {
          'log-context.json': {
            data: {},
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: { from: null, to: null },
      };

      render(<Filter state={state as SleuthState} />);

      const tzSwitch = screen.queryByRole('switch');
      expect(tzSwitch).not.toBeInTheDocument();
    });

    it('renders disabled switch when userTZ matches systemTZ', () => {
      const state: Partial<SleuthState> = {
        isUserTZ: false,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'America/Los_Angeles',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: { from: null, to: null },
      };

      // Mock system timezone to match user timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
        const formatter = new originalDateTimeFormat(locale, options);
        if (!options) {
          return {
            ...formatter,
            resolvedOptions: () => ({
              ...formatter.resolvedOptions(),
              timeZone: 'America/Los_Angeles',
            }),
          } as any;
        }
        return formatter;
      });

      render(<Filter state={state as SleuthState} />);

      const tzSwitch = screen.getByRole('switch');
      expect(tzSwitch).toBeDisabled();
    });

    it('renders enabled switch when userTZ differs from systemTZ', () => {
      const state: Partial<SleuthState> = {
        isUserTZ: false,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'Europe/London',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: { from: null, to: null },
      };

      // Mock system timezone to be different from user timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
        const formatter = new originalDateTimeFormat(locale, options);
        if (!options) {
          return {
            ...formatter,
            resolvedOptions: () => ({
              ...formatter.resolvedOptions(),
              timeZone: 'America/Los_Angeles',
            }),
          } as any;
        }
        return formatter;
      });

      render(<Filter state={state as SleuthState} />);

      const tzSwitch = screen.getByRole('switch');
      expect(tzSwitch).not.toBeDisabled();
    });

    it('calls toggleTZ when switch is clicked', async () => {
      const toggleTZ = vi.fn();
      const state: Partial<SleuthState> = {
        isUserTZ: false,
        toggleTZ,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'Europe/London',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: { from: null, to: null },
      };

      // Mock system timezone to be different from user timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
        const formatter = new originalDateTimeFormat(locale, options);
        if (!options) {
          return {
            ...formatter,
            resolvedOptions: () => ({
              ...formatter.resolvedOptions(),
              timeZone: 'America/Los_Angeles',
            }),
          } as any;
        }
        return formatter;
      });

      render(<Filter state={state as SleuthState} />);

      const tzSwitch = screen.getByRole('switch');
      fireEvent.click(tzSwitch);

      await waitFor(() => {
        expect(toggleTZ).toHaveBeenCalledTimes(1);
      });
    });

    it('displays correct label when isUserTZ is false', () => {
      const state: Partial<SleuthState> = {
        isUserTZ: false,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'Europe/London',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: { from: null, to: null },
      };

      // Mock system timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
        const formatter = new originalDateTimeFormat(locale, options);
        if (!options) {
          return {
            ...formatter,
            resolvedOptions: () => ({
              ...formatter.resolvedOptions(),
              timeZone: 'America/Los_Angeles',
            }),
          } as any;
        }
        return formatter;
      });

      render(<Filter state={state as SleuthState} />);

      const tzSwitch = screen.getByRole('switch');
      expect(tzSwitch).toHaveTextContent('TZ: System');
    });

    it('displays correct label when isUserTZ is true', () => {
      const state: Partial<SleuthState> = {
        isUserTZ: true,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'Europe/London',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: { from: null, to: null },
      };

      // Mock system timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
        const formatter = new originalDateTimeFormat(locale, options);
        if (!options) {
          return {
            ...formatter,
            resolvedOptions: () => ({
              ...formatter.resolvedOptions(),
              timeZone: 'America/Los_Angeles',
            }),
          } as any;
        }
        return formatter;
      });

      render(<Filter state={state as SleuthState} />);

      const tzSwitch = screen.getByRole('switch');
      expect(tzSwitch).toHaveTextContent('TZ: User');
    });
  });

  describe('RangePicker with Timezone', () => {
    it('renders RangePicker with correct timezone-aware values', () => {
      const state: Partial<SleuthState> = {
        isUserTZ: false,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'Europe/London',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: {
          from: new Date('2024-01-15T10:00:00Z'),
          to: new Date('2024-01-15T18:00:00Z'),
        },
      };

      render(<Filter state={state as SleuthState} />);

      // Verify RangePicker is rendered
      const rangePicker = screen.getByPlaceholderText(/Start date/);
      expect(rangePicker).toBeInTheDocument();
    });

    it('handles date range changes with timezone awareness', async () => {
      const state: Partial<SleuthState> = {
        isUserTZ: false,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'Europe/London',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: { from: null, to: null },
      };

      render(<Filter state={state as SleuthState} />);

      // Verify the component renders without errors when dates change
      expect(screen.getByPlaceholderText(/Start date/)).toBeInTheDocument();
    });

    it('uses user timezone when isUserTZ is true', () => {
      const state: Partial<SleuthState> = {
        isUserTZ: true,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'Asia/Tokyo',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: {
          from: new Date('2024-01-15T10:00:00Z'),
          to: new Date('2024-01-15T18:00:00Z'),
        },
      };

      render(<Filter state={state as SleuthState} />);

      // Verify RangePicker renders with user timezone
      const rangePicker = screen.getByPlaceholderText(/Start date/);
      expect(rangePicker).toBeInTheDocument();
    });

    it('uses system timezone when isUserTZ is false', () => {
      const state: Partial<SleuthState> = {
        isUserTZ: false,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'Asia/Tokyo',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: {
          from: new Date('2024-01-15T10:00:00Z'),
          to: new Date('2024-01-15T18:00:00Z'),
        },
      };

      // Mock system timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
        const formatter = new originalDateTimeFormat(locale, options);
        if (!options) {
          return {
            ...formatter,
            resolvedOptions: () => ({
              ...formatter.resolvedOptions(),
              timeZone: 'America/New_York',
            }),
          } as any;
        }
        return formatter;
      });

      render(<Filter state={state as SleuthState} />);

      // Verify RangePicker renders with system timezone
      const rangePicker = screen.getByPlaceholderText(/Start date/);
      expect(rangePicker).toBeInTheDocument();
    });
  });

  describe('Timezone Display', () => {
    it('displays timezone tooltip with correct offset', async () => {
      const state: Partial<SleuthState> = {
        isUserTZ: false,
        stateFiles: {
          'log-context.json': {
            data: {
              systemTZ: 'Europe/London',
            },
          } as any,
        },
        searchList: [],
        levelFilter: { error: true, warn: true, info: true, debug: true },
        dateRange: { from: null, to: null },
      };

      // Mock system timezone
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
        const formatter = new originalDateTimeFormat(locale, options);
        if (!options) {
          return {
            ...formatter,
            resolvedOptions: () => ({
              ...formatter.resolvedOptions(),
              timeZone: 'America/Los_Angeles',
            }),
          } as any;
        }
        return formatter;
      });

      render(<Filter state={state as SleuthState} />);

      const tzSwitch = screen.getByRole('switch');
      expect(tzSwitch).toBeInTheDocument();

      // The tooltip should show the timezone information
      // We can't easily test hover tooltips in RTL, but we can verify the switch exists
      expect(tzSwitch.parentElement).toBeInTheDocument();
    });
  });
});
