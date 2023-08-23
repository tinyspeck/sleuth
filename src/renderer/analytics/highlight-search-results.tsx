import React from 'react';

export function highlight(fuseSearchResult: any) {

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
        highlightedItem.message = highlightMatches(match.value, match.indices)
      });
      return highlightedItem;
    });
}
