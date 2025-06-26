import React from 'react';
import { Progress } from 'antd';

export interface LoadingProps {
  percentage?: number;
  message?: string;
}

/**
 * Sleuth's loading indicator. Used only during processing.
 *
 * @param {LoadingProps} props
 * @returns {JSX.Element}
 */
export const Loading = (props: LoadingProps) => {
  const { percentage, message } = props;

  return (
    <div className="Loading">
      <Progress percent={percentage ?? 0} />
      <br />
      <p>{message}</p>
    </div>
  );
};
