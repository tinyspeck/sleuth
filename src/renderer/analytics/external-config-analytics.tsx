import React from 'react';
import { isEqual } from 'lodash';

export interface RootData {
  defaults: object | undefined;
  policies: object | undefined;
}

export function getPoliciesAndDefaultsRootState(rootState: any): RootData {
  const { itDefaults, itPolicy } = rootState.settings;

  const data: RootData = {
    defaults: itDefaults,
    policies: itPolicy,
  };

  return data;
}

export function getPoliciesAndDefaultsExternalConfig(
  externalConfig: any,
): RootData {
  const { defaults, ...policies } = externalConfig;

  const data: RootData = {
    defaults,
    policies,
  };

  return data;
}

export function getMessage(
  rootStateData: RootData,
  externalConfigData: RootData,
): JSX.Element {
  const isDefaultEqual = isEqual(
    rootStateData.defaults,
    externalConfigData.defaults,
  );
  const isPoliciesEqual = isEqual(
    rootStateData.policies,
    externalConfigData.policies,
  );
  if (isDefaultEqual && isPoliciesEqual) {
    return (
      <div>
        <p className="matchMessage">No problems detected</p>
        <p>Both files match</p>
      </div>
    );
  } else if (!isDefaultEqual && isPoliciesEqual) {
    return (
      <div>
        <p className="errorMessage">Problems detected</p>
        <p>
          Files do not match: <strong>defaults</strong> differ
        </p>
      </div>
    );
  } else if (isDefaultEqual && !isPoliciesEqual) {
    return (
      <div>
        <p className="errorMessage">Problems detected</p>
        <p>
          Files do not match: <strong>policies</strong> differ
        </p>
      </div>
    );
  } else {
    return (
      <div>
        <p className="errorMessage">Problems detected</p>
        <p>
          Files do not match: <strong>policies</strong> and{' '}
          <strong>defaults</strong> differ
        </p>
      </div>
    );
  }
}
