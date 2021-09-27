import { SourceMapConsumer } from "source-map";
import path from "path";
import memoize from "lodash.memoize";
import { SourcemapResolver } from "./resolver";
import LRUCache from "lru-cache";
import { ChromiumTraceEvent, TraceParser } from "./parser";
import { EventEmitter } from "events";

export interface SourceReference {
  lineNumber: number;
  columnNumber: number;
  url: string;
  functionName?: string;
  sourceType: "JS";
  scriptId?: number;
}

interface TraceCPUProfileNode {
  callFrame?: SourceReference;
}

type TraceDataNode = {
  stackTrace?: SourceReference[];
  cpuProfile?: {
    nodes?: TraceCPUProfileNode[];
  };
} & SourceReference;

export interface TraceEntry {
  args?: {
    data?: TraceDataNode;
    beginData?: TraceDataNode;
  };
}

const maybeInitializeConsumer = memoize(() => {
  (SourceMapConsumer as any).initialize({
    "lib/mappings.wasm": path.join(
      __dirname,
      "../../dist/node_modules/source-map/lib/mappings.wasm"
    ),
  });
});

function isSourceRef(obj: any) {
  return !!(obj?.lineNumber && obj?.columnNumber && obj?.url);
}

function hasSourceRef(arr: any) {
  return Array.isArray(arr) && arr.some((item) => isSourceRef(item));
}

function hasNodesWithSourceRef(arr: any) {
  return Array.isArray(arr) && arr.some((item) => isSourceRef(item.callFrame));
}

export class TraceMapper extends EventEmitter{
  parser: TraceParser;
  resolver: SourcemapResolver;
  cache: LRUCache<string, SourceMapConsumer>;
  constructor(parser: TraceParser, resolver: SourcemapResolver) {
    super();
    this.parser = parser;
    this.resolver = resolver;
    this.cache = new LRUCache({
      max: 50,
      dispose: (key: string, n: SourceMapConsumer) => n.destroy(),
    });
    maybeInitializeConsumer();
  }

  private async getConsumer(fileName: string) {
    const cachedConsumer = this.cache.get(fileName);
    if (cachedConsumer) {
      return cachedConsumer;
    }

    try {
      const sourceMap = await this.resolver.get(fileName);
      if (sourceMap) {
        const consumer = await new SourceMapConsumer(sourceMap);
        this.cache.set(fileName, consumer);
        return consumer;
      }
    } catch (e) {}

    return;
  }

  private async mapReference(
    reference: SourceReference
  ): Promise<string | undefined> {
    try {
      const url = new URL(reference.url);
      const fileName = url.pathname.split("/").pop() || "";
      const consumer = await this.getConsumer(fileName);
  
      if (consumer) {
        const position = consumer.originalPositionFor({
          line: reference.lineNumber + 1,
          column: reference.columnNumber,
        });
        if (position.line && position.column) {
          // hmm
          reference.sourceType = "JS";
          reference.lineNumber = position.line - 1;
          reference.columnNumber = position.column;
          reference.url =
            position.source?.replace("webpack:///", "webpack:///./") || "";
          reference.functionName = position.name || reference.functionName;
  
          // scriptIds are non consistent between the user's renderer and our
          // fake env for opening the profile, so we'll delete them. Doing so
          // enables click-through on source links
          delete reference.scriptId;
  
          return fileName;
        }
      }
    } catch (e) {}

    return;
  }

  private async mapReferences(entry: ChromiumTraceEvent) {
    const fileNames = new Set<string>();
    const data = entry?.args?.data;
    const beginData = entry?.args?.beginData;
    if (isSourceRef(data)) {
      const fileName = await this.mapReference(data!);
      if (fileName) fileNames.add(fileName);
    } else if (isSourceRef(beginData)) {
      const fileName = await this.mapReference(beginData!);
      if (fileName) fileNames.add(fileName);
    } else if (hasSourceRef(data?.stackTrace)) {
      for (const traceItem of data!.stackTrace!) {
        const fileName = await this.mapReference(traceItem);
        if (fileName) fileNames.add(fileName);
      }
    } else if (hasSourceRef(beginData?.stackTrace)) {
      for (const traceItem of beginData!.stackTrace!) {
        const fileName = await this.mapReference(traceItem);
        if (fileName) fileNames.add(fileName);
      }
    } else if (hasNodesWithSourceRef(data?.cpuProfile?.nodes)) {
      for (const node of data!.cpuProfile!.nodes!) {
        if (node?.callFrame) {
          const fileName = await this.mapReference(node?.callFrame);
          if (fileName) fileNames.add(fileName);
        }
      }
    } else if (hasNodesWithSourceRef(beginData?.cpuProfile?.nodes)) {
      for (const node of beginData!.cpuProfile!.nodes!) {
        if (node?.callFrame) {
          const fileName = await this.mapReference(node?.callFrame);
          if (fileName) fileNames.add(fileName);
        }
      }
    }
    return fileNames;
  }

  async map() {
    const used: Set<string> = new Set();
    const events = this.parser.getTraceEvents();
    const mapped = [];
    const progressChunk = Math.floor(events.length / 100); 
    for (let i = 0; i < events.length; i++) {
      const entry = events[i];
      const fileNames = await this.mapReferences(entry);
      if (i % progressChunk === 0) {
        this.emit("progress", 1/events.length * i);
      }
      fileNames.forEach(used.add, used);
      mapped.push(entry);
    }
    this.emit("progress", 1);
    return {
      used: Array.from(used),
      events
    }
  }
}
