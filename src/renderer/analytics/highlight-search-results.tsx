import React from 'react';
import Fuse from 'fuse.js';
import { LogEntry } from 'src/interfaces';

export function highlight(fuseSearchResult: Fuse.FuseResult<LogEntry>[]) {
  const highlightMatches = (
    inputText: string,
    regions: readonly [number, number][] = [],
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
    .filter(({ matches }: Fuse.FuseResult<LogEntry>) => Array.isArray(matches))
    .map(({ item, matches }: Fuse.FuseResult<LogEntry>) => {
      const highlightedItem = { ...item };

      if (matches) {
        matches.forEach((match: Fuse.FuseResultMatch) => {
          if (match.value && match.indices)
            highlightedItem.highlightMessage = highlightMatches(
              match.value,
              match.indices,
            );
        });
      }
      return highlightedItem;
    });
}
