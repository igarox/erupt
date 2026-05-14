export interface Decision {
  id: string;
  text: string;
  status: 'open' | 'active' | 'retired';
  createdTurn: number;
  resolutionTurn?: number;
}

export interface DecisionLog {
  active: Decision[];
  retired: Decision[];
  open: Decision[];
}

export interface ClarifyingQuestion {
  question: string;
  context: string;
  affectedArticles: string[];
  answer?: string;
}

export interface ExtractionConfig {
  MAX_TOOL_CALLS_PER_TURN: number;
  MAX_TURN_RANGE: number;
  MAX_TURN_CHARS: number;
  SUBPASS2_BATCH_SIZE: number;
  SUBPASS2_SOLO_THRESHOLD: number;
  SUBPASS1_CONCURRENCY: number;
  DECOMPOSE_THRESHOLD: number;
  RETRY_429_MAX: number;
  RETRY_429_BASE_MS: number;
}

export const DEFAULT_EXTRACTION_CONFIG: ExtractionConfig = {
  MAX_TOOL_CALLS_PER_TURN: 20,
  MAX_TURN_RANGE: 20,
  MAX_TURN_CHARS: 40_000,
  SUBPASS2_BATCH_SIZE: 10,
  SUBPASS2_SOLO_THRESHOLD: 8_000,
  SUBPASS1_CONCURRENCY: 3,
  DECOMPOSE_THRESHOLD: 8_000,
  RETRY_429_MAX: 3,
  RETRY_429_BASE_MS: 2_000,
};

export interface ValidatorRejection {
  validator: string;
  path: string;
  reason: string;
  isTrajectoryPass: boolean;
  ts: number;
}

export interface ExtractionRunState {
  runArticles: Map<string, number>;
  /** Articles written by the main per-turn loop. Trajectory revision pass
   *  cannot delete or shrink these. Populated only during the main loop. */
  perTurnArticles: Set<string>;
  lastGoodContent: Map<string, string>;
  currentTurnWritten: Set<string>;
  clarifyingQuestions: ClarifyingQuestion[];
  errorCount: number;
  /** Total successful write_magma calls — denominator for rejection rate. */
  writeAttempts: number;
  /** Each validator rejection logged for post-run analysis. */
  validatorRejections: ValidatorRejection[];
  currentController: AbortController | null;
  decisionLog: DecisionLog;
  /** article path → turn number it was first written (main loop only). */
  runArticleTurnMap: Map<string, number>;
}

export function createRunState(): ExtractionRunState {
  return {
    runArticles: new Map(),
    perTurnArticles: new Set(),
    lastGoodContent: new Map(),
    currentTurnWritten: new Set(),
    clarifyingQuestions: [],
    errorCount: 0,
    writeAttempts: 0,
    validatorRejections: [],
    currentController: null,
    decisionLog: { active: [], retired: [], open: [] },
    runArticleTurnMap: new Map(),
  };
}
