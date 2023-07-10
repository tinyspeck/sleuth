import React from 'react';
import NumberResults from '../../../src/renderer/components/number-results';
import { render, screen } from '@testing-library/react';

jest.mock('electron');

describe('results', () => {
  it('shows the results number in correct format', () => {
    const resultLength = 20342;
    render(<NumberResults numberOfResults={resultLength} />);
    const result = screen.getByText('20,342');
    expect(result).toBeInTheDocument();
  });

  it('when result number is 1, should use result not results (grammar)', () => {
    const resultLength = 1;
    render(<NumberResults numberOfResults={resultLength} />);
    const result = screen.getByText('result');
    expect(result).toBeInTheDocument();
  });
});
