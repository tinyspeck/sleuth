import { getPoliciesAndDefaultsRootState, getPoliciesAndDefaultsExternalConfig, getMessage } from '../../../src/renderer/analytics/external-config-analytics';
import { render, screen } from '@testing-library/react';

jest.mock('electron');

const fakeExternalConfigData1: any = {
	defaults: {}
};

const fakeRootStateData1: any = {
	appTeams: {},
	settings: {
		itDefaults: {},
		itPolicy: {}
	}
}

const fakeExternalConfigData2: any = {
	defaults: {
		"HideOnStartup": false,
		"AutoUpdate": false,
	}
};

const fakeRootStateData2: any = {
	appTeams: {},
	settings: {
		itDefaults: {
			"HideOnStartup": false,
			"AutoUpdate": true,
		}
	}
}


describe('comparison', () => {
	const externalConfig1 = getPoliciesAndDefaultsExternalConfig(fakeExternalConfigData1);
	const rootState1 = getPoliciesAndDefaultsRootState(fakeRootStateData1);

	const externalConfig2 = getPoliciesAndDefaultsExternalConfig(fakeExternalConfigData2);
	const rootState2 = getPoliciesAndDefaultsRootState(fakeRootStateData2);

	it('shows both files defaults and policies match', () => {
		const message = getMessage(rootState1, externalConfig1);

		render(message)
		const result = screen.getByText('No problems detected');
		expect(result).toBeInTheDocument();
	})

	it('shows differences', () => {
		const message = getMessage(rootState2, externalConfig2);
		render(message)
		const result = screen.getByText('Problems detected');
		expect(result).toBeInTheDocument();
	})
})
