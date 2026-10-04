import { fingerprintDiagnosticEvidence } from "./utils/fingerprint-diagnostic-evidence.js";
import type { Diagnostic } from "./types/index.js";

export const DIAGNOSTIC_DELTA_IDENTITY = Symbol.for("react-doctor/diagnostic-delta-identity");

export interface DiagnosticDelta {
  readonly newDiagnostics: Diagnostic[];
  readonly fixedCount: number;
  readonly crossFileMatchCount: number;
  readonly ruleCountMatchCount: number;
}

export interface ComputeDiagnosticDeltaInput {
  readonly renamedFiles?: Readonly<Record<string, string>>;
  readonly headDiagnostics: ReadonlyArray<Diagnostic>;
  readonly baseDiagnostics: ReadonlyArray<Diagnostic>;
  readonly readHeadLine: (filePath: string, line: number) => string | null;
  readonly readBaseLine: (filePath: string, line: number) => string | null;
  readonly readHeadEvidence?: (diagnostic: Diagnostic) => string | null;
  readonly readBaseEvidence?: (diagnostic: Diagnostic) => string | null;
  readonly mapBaseLine?: (headFilePath: string, baseLine: number) => number;
}

interface DiagnosticMatchCandidate {
  readonly diagnosticIndex: number;
  readonly filePath: string;
  readonly groupKey: string;
  readonly fingerprint: string | null;
  readonly message: string;
  readonly messageWords: ReadonlySet<string>;
  readonly line: number;
}

interface DiagnosticMatchRank {
  readonly fingerprintMatch: number;
  readonly messageSimilarity: number;
  readonly lineDistance: number;
}

interface RankedDiagnosticMatch extends DiagnosticMatchRank {
  readonly head: DiagnosticMatchCandidate;
  readonly base: DiagnosticMatchCandidate;
}

const buildMatchCandidates = (
  diagnostics: ReadonlyArray<Diagnostic>,
  readEvidence: ComputeDiagnosticDeltaInput["readHeadEvidence"],
  readLine: ComputeDiagnosticDeltaInput["readHeadLine"],
  renamedFiles: Readonly<Record<string, string>> = {},
): DiagnosticMatchCandidate[] =>
  diagnostics.map((diagnostic, diagnosticIndex) => {
    const filePath = renamedFiles[diagnostic.filePath] ?? diagnostic.filePath;
    const evidence = readEvidence?.(diagnostic) ?? readLine(diagnostic.filePath, diagnostic.line);
    const explicitIdentity = Reflect.get(diagnostic, DIAGNOSTIC_DELTA_IDENTITY);
    let fingerprint = diagnostic.fingerprint ?? null;
    if (typeof explicitIdentity === "string") {
      fingerprint = `identity:${fingerprintDiagnosticEvidence(explicitIdentity)}`;
    } else if (fingerprint === null && evidence?.trim()) {
      fingerprint = fingerprintDiagnosticEvidence(evidence);
    }
    const message = `${diagnostic.title ?? ""}\0${diagnostic.message}`;
    return {
      diagnosticIndex,
      filePath,
      groupKey: `${filePath}\0${diagnostic.plugin}/${diagnostic.rule}`,
      fingerprint,
      message,
      messageWords: new Set(message.toLowerCase().match(/\w+/g) ?? []),
      line: diagnostic.line,
    };
  });

const compareMatchRanks = (left: DiagnosticMatchRank, right: DiagnosticMatchRank): number =>
  right.fingerprintMatch - left.fingerprintMatch ||
  right.messageSimilarity - left.messageSimilarity ||
  left.lineDistance - right.lineDistance;

const rankDiagnosticMatch = (
  head: DiagnosticMatchCandidate,
  base: DiagnosticMatchCandidate,
  mapBaseLine: ComputeDiagnosticDeltaInput["mapBaseLine"],
): RankedDiagnosticMatch => {
  let sharedWordCount = 0;
  for (const word of head.messageWords) {
    if (base.messageWords.has(word)) sharedWordCount += 1;
  }
  const unionWordCount = head.messageWords.size + base.messageWords.size - sharedWordCount;
  return {
    head,
    base,
    fingerprintMatch: Number(head.fingerprint !== null && head.fingerprint === base.fingerprint),
    messageSimilarity:
      head.message === base.message ? 1 : sharedWordCount / Math.max(1, unionWordCount),
    lineDistance: Math.abs(head.line - (mapBaseLine?.(base.filePath, base.line) ?? base.line)),
  };
};

export const computeDiagnosticDelta = (input: ComputeDiagnosticDeltaInput): DiagnosticDelta => {
  const baseCandidates = buildMatchCandidates(
    input.baseDiagnostics,
    input.readBaseEvidence,
    input.readBaseLine,
    input.renamedFiles,
  );
  const headCandidates = buildMatchCandidates(
    input.headDiagnostics,
    input.readHeadEvidence,
    input.readHeadLine,
  );
  const baseGroups = new Map<string, DiagnosticMatchCandidate[]>();
  const headGroups = new Map<string, DiagnosticMatchCandidate[]>();
  for (const [candidates, groups] of [
    [baseCandidates, baseGroups],
    [headCandidates, headGroups],
  ] satisfies ReadonlyArray<
    readonly [DiagnosticMatchCandidate[], Map<string, DiagnosticMatchCandidate[]>]
  >) {
    for (const candidate of candidates) {
      const group = groups.get(candidate.groupKey) ?? [];
      group.push(candidate);
      groups.set(candidate.groupKey, group);
    }
  }

  const matchedHeadIndexes = new Set<number>();
  const matchedBaseIndexes = new Set<number>();
  let ruleCountMatchCount = 0;
  for (const [groupKey, headGroup] of headGroups) {
    const baseGroup = baseGroups.get(groupKey);
    if (!baseGroup) continue;
    for (const requireExactMatch of [true, false]) {
      const rankHead = (head: DiagnosticMatchCandidate): RankedDiagnosticMatch | null => {
        let bestMatch: RankedDiagnosticMatch | null = null;
        for (const base of baseGroup) {
          if (matchedBaseIndexes.has(base.diagnosticIndex)) continue;
          const rank = rankDiagnosticMatch(head, base, input.mapBaseLine);
          if (requireExactMatch && (rank.fingerprintMatch === 0 || head.message !== base.message)) {
            continue;
          }
          if (bestMatch === null || compareMatchRanks(rank, bestMatch) < 0) bestMatch = rank;
        }
        return bestMatch;
      };
      const rankedHeads = headGroup
        .filter((head) => !matchedHeadIndexes.has(head.diagnosticIndex))
        .flatMap((head) => {
          const rank = rankHead(head);
          return rank === null ? [] : [rank];
        })
        .sort(compareMatchRanks);
      for (const rankedHead of rankedHeads) {
        const match = matchedBaseIndexes.has(rankedHead.base.diagnosticIndex)
          ? rankHead(rankedHead.head)
          : rankedHead;
        if (!match) continue;
        matchedHeadIndexes.add(match.head.diagnosticIndex);
        matchedBaseIndexes.add(match.base.diagnosticIndex);
        if (!requireExactMatch) ruleCountMatchCount += 1;
      }
    }
  }

  return {
    newDiagnostics: input.headDiagnostics.filter(
      (_diagnostic, diagnosticIndex) => !matchedHeadIndexes.has(diagnosticIndex),
    ),
    fixedCount: input.baseDiagnostics.length - matchedBaseIndexes.size,
    crossFileMatchCount: [...matchedBaseIndexes].filter((diagnosticIndex) =>
      Boolean(input.renamedFiles?.[input.baseDiagnostics[diagnosticIndex].filePath]),
    ).length,
    ruleCountMatchCount,
  };
};
