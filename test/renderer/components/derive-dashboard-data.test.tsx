import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { deriveDashboardData } from '../../../src/renderer/components/derive-dashboard-data';
import { SleuthState } from '../../../src/renderer/state/sleuth';

function derive(notificationWarnings: unknown) {
  const state = {
    font: 'Arial',
    stateFiles: {
      'notification-warnings.json': { data: notificationWarnings },
    },
    processedLogFiles: undefined,
  } as unknown as SleuthState;
  return deriveDashboardData(state);
}

function text(node: React.ReactNode) {
  return render(<>{node}</>).container.textContent ?? '';
}

describe('deriveDashboardData notification warnings', () => {
  it('categorizes the legacy bare array', () => {
    const { notifCategories, notifDiagnosticItems } = derive([
      'MACOS_DENIED',
      'ZERO_MAX_NOTIFICATIONS',
    ]);

    expect(notifCategories.map((c) => c.category)).toEqual([
      'macOS',
      'Slack Preferences',
    ]);
    expect(notifCategories[0].warnings[0].code).toBe('MACOS_DENIED');
    expect(notifDiagnosticItems).toEqual([]);
  });

  it('surfaces codes it does not recognize instead of dropping them', () => {
    const { notifCategories } = derive(['SOMETHING_NEW']);

    expect(notifCategories).toEqual([
      {
        category: 'Other',
        warnings: [{ code: 'SOMETHING_NEW', description: '' }],
      },
    ]);
  });

  it('reads the diagnostics object shape', () => {
    const { notifCategories, notifDiagnosticItems } = derive({
      exportedAt: '2026-09-25T21:45:00.000Z',
      warnings: ['MACOS_NOT_DETERMINED'],
      cache: {
        cached: ['MACOS_NOT_DETERMINED'],
        ageSeconds: 12,
        lastClearedAt: null,
      },
      macPermission: {
        state: 'MACOS_NOT_DETERMINED',
        utilsHasReauthorization: false,
      },
      settings: { notificationMethod: null, runFromTray: true },
      sinceLaunch: {
        startedAt: '2026-09-25T20:00:00.000Z',
        nativeCreated: 0,
        nativeSucceeded: 0,
        nativeFailed: 0,
        lastNativeAt: null,
        lastNativeError: null,
        dropped: [
          {
            at: '2026-09-25T21:00:00.000Z',
            state: 'MACOS_NOT_DETERMINED',
            notificationId: 'T1_1',
          },
        ],
        reauthorizationRequests: [
          {
            at: '2026-09-25T21:00:01.000Z',
            error: 'Notifications are not allowed',
          },
        ],
      },
    });

    expect(notifCategories[0].warnings[0].code).toBe('MACOS_NOT_DETERMINED');
    expect(notifDiagnosticItems.map((i) => i.key)).toEqual([
      'macPermission',
      'cache',
      'sinceLaunch',
      'dropped',
      'reauth',
      'settings',
    ]);
    expect(text(notifDiagnosticItems[0].children)).toContain(
      'utils cannot re-request',
    );
    expect(notifDiagnosticItems[1].children).toBe(
      'MACOS_NOT_DETERMINED · 12s old',
    );
    expect(text(notifDiagnosticItems[2].children)).toContain(
      '0 native created',
    );
    expect(text(notifDiagnosticItems[3].children)).toContain('T1_1');
    expect(text(notifDiagnosticItems[4].children)).toContain(
      'Notifications are not allowed',
    );
    expect(notifDiagnosticItems[5].children).toBe(
      'notificationMethod=null · runFromTray=true',
    );
  });

  it('hides the macOS permission row off macOS', () => {
    const { notifDiagnosticItems } = derive({
      warnings: [],
      macPermission: { state: 'not-mac', utilsHasReauthorization: false },
    });

    expect(notifDiagnosticItems).toEqual([]);
  });

  it('tolerates a missing or malformed file', () => {
    expect(derive(undefined).notifCategories).toEqual([]);
    expect(derive('garbage').notifCategories).toEqual([]);
  });
});
