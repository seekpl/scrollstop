import { CodedError } from '../errors';
import { Standardizer } from './standardizer';
import { LinearKernelRidge, RidgeRegression, type Prediction, type Regressor } from './regressors';

export interface TrainingSample {
  features: number[];
  target: { x: number; y: number };
  /** Identyfikator miejsca na ekranie (ten sam dla powtórzonego punktu). */
  pointId: number;
  /** 1 = próbka z fazy fiksacji na celu, <1 = z płynnego przejścia celu. */
  weight: number;
}

export interface Candidate {
  model: string;
  params: Record<string, number>;
  cvError: number;
}

export interface FitReport {
  model: string;
  params: Record<string, number>;
  cvError: number;
  candidates: Candidate[];
  nTrain: number;
}

export type RegressorFactory = () => Regressor;

/** Kandydaci porównywani walidacją krzyżową leave-one-point-out. */
export const DEFAULT_CANDIDATES: RegressorFactory[] = [
  () => new RidgeRegression('poly2', 0.3),
  () => new RidgeRegression('poly2', 3),
  ...[0.3, 1, 3].flatMap((g) => [0.03, 0.3].map((l) => () => new LinearKernelRidge(g, l))),
];

export function subsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}

/** Minimalny interfejs estymatora — pozwala w v2 podmienić silnik bez zmian w aplikacji. */
export interface GazePredictor {
  readonly name: string;
  predict(features: number[]): Prediction;
}

/** Indywidualne mapowanie: cechy oczu/twarzy → punkt na ekranie (0..1). */
export class GazeModel implements GazePredictor {
  private constructor(
    private readonly standardizer: Standardizer,
    private readonly regressor: Regressor,
  ) {}

  get name(): string {
    return this.regressor.name;
  }

  params(): Record<string, number> {
    return this.regressor.params();
  }

  predict(features: number[]): Prediction {
    return this.regressor.predict(this.standardizer.transform(features));
  }

  static fit(
    samples: TrainingSample[],
    opts: { maxTrain?: number; candidates?: RegressorFactory[] } = {},
  ): { model: GazeModel; report: FitReport } {
    if (samples.length < 12) throw new CodedError('calibration_too_few');
    const train = subsample(samples, opts.maxTrain ?? 260);
    const standardizer = Standardizer.fit(train.map((s) => s.features));
    const X = train.map((s) => standardizer.transform(s.features));
    const Y = train.map((s) => [s.target.x, s.target.y] as [number, number]);
    const W = train.map((s) => s.weight);
    const factories = opts.candidates ?? DEFAULT_CANDIDATES;
    const groups = [...new Set(train.filter((s) => s.weight >= 1).map((s) => s.pointId))];

    const candidates: Candidate[] = [];
    let best: { factory: RegressorFactory; err: number } | null = null;
    for (const factory of factories) {
      const err = groups.length >= 4 ? crossValidate(factory, X, Y, W, train, groups) : NaN;
      const probe = factory();
      candidates.push({ model: probe.name, params: probe.params(), cvError: err });
      if (Number.isFinite(err) && (!best || err < best.err)) best = { factory, err };
    }
    const chosen = best?.factory ?? (() => new LinearKernelRidge(1, 0.3));
    const regressor = chosen();
    regressor.fit(X, Y, W);
    return {
      model: new GazeModel(standardizer, regressor),
      report: {
        model: regressor.name,
        params: regressor.params(),
        cvError: best?.err ?? NaN,
        candidates,
        nTrain: train.length,
      },
    };
  }
}

function crossValidate(
  factory: RegressorFactory,
  X: number[][],
  Y: Array<[number, number]>,
  W: number[],
  train: TrainingSample[],
  groups: number[],
): number {
  let sum = 0;
  let count = 0;
  for (const g of groups) {
    const tr: number[] = [];
    const te: number[] = [];
    for (let i = 0; i < train.length; i++) {
      // Cały punkt (również próbki z dojścia do niego) wypada ze zbioru treningowego.
      if (train[i].pointId === g) {
        if (train[i].weight >= 1) te.push(i);
      } else tr.push(i);
    }
    if (!te.length || tr.length < 12) continue;
    const r = factory();
    r.fit(
      tr.map((i) => X[i]),
      tr.map((i) => Y[i]),
      tr.map((i) => W[i]),
    );
    for (const i of te) {
      const p = r.predict(X[i]);
      sum += Math.hypot(p.x - Y[i][0], p.y - Y[i][1]);
      count++;
    }
  }
  return count ? sum / count : NaN;
}
