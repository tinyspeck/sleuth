import React from 'react';

export function highlight(fuseSearchResult: any) {
  const set = (obj: any, path: string, value: JSX.Element) => {
    const pathValue = path.split('.');
    let i;

    for (i = 0; i < pathValue.length - 1; i++) {
      obj = obj[pathValue[i]];
    }

    obj[pathValue[i]] = value;
  };

  const highlightMatches = (
    inputText: string,
    regions: [number, number][] = [],
  ) => {
    const children: React.ReactNode[] = [];
    let nextUnhighlightedRegionStartingIndex = 0;

    regions.forEach((region, i) => {
      const lastRegionNextIndex = region[1] + 1;

      children.push(
        ...[
          inputText
            .substring(nextUnhighlightedRegionStartingIndex, region[0])
            .replace(' ', '\u00A0'),
          <span key={region + ' ' + i} className="fuse-highlight">
            {inputText
              .substring(region[0], lastRegionNextIndex)
              .replace(' ', '\u00A0')}
          </span>,
        ],
      );

      nextUnhighlightedRegionStartingIndex = lastRegionNextIndex;
    });

    children.push(
      inputText
        .substring(nextUnhighlightedRegionStartingIndex)
        .replace(' ', '\u00A0'),
    );

    return <>{children}</>;
  };

  return fuseSearchResult
    .filter(({ matches }: any) => matches && matches.length)
    .map(({ item, matches }: any) => {
      const highlightedItem = { ...item };
      // Need to store originalText due to item.message being replaced with JSX element for styling highlights, this cannot be used for is-redux-action function in messageCellRenderer
      highlightedItem.originalText = item.message;

      matches.forEach((match: any) => {
        set(
          highlightedItem,
          match.key,
          highlightMatches(match.value, match.indices),
        );
      });

      return highlightedItem;
    });
}
