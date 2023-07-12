import { useRef, useCallback } from 'react';

export function useRefReRender<T>(
  initialValue: T | null,
  teardown?: (current: T | null) => void,
): [() => T | null, (ref: T) => void] {
  const ref = useRef<T | null>(initialValue);
  const setRef = useCallback((value) => {
    if (ref.current && teardown) {
      teardown(ref.current);
    }

    ref.current = value;
  }, []);

  const getRef = useCallback(() => {
    return ref.current;
  }, []);
  return [getRef, setRef];
}
