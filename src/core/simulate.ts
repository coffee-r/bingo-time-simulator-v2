/**
 * モンテカルロ・シミュレーション本体（ブラウザの Web Worker で実行する）
 */
import { BALLS, createPool, dealAndCount, shuffleDrawOrder, toDrawPositions } from './bingo'
import { resolveParty } from './party'
import { FREE_CENTER, type Params, toTimeModel } from './params'
import { createRng } from './rng'
import { meanOf, quantileSorted } from './stats'

/** 終了時間の範囲として表示する分位点（10回に8回はこの間におさまる） */
export const RANGE_LO = 0.1
export const RANGE_HI = 0.9

export type Summary = {
  mean: number
  lo: number
  p50: number
  hi: number
}

export type SimResult = {
  trials: number
  seed: number
  elapsedMs: number
  total: Summary
  draws: Summary
  /** 1回あたりの平均 */
  mean: { draws: number; drawingSec: number; handSec: number }
  /** 最後の球で当選者が残りの景品より多くジャンケンになる確率 */
  jankenRate: number
}

const summarize = (sorted: Float64Array): Summary => ({
  mean: meanOf(sorted),
  lo: quantileSorted(sorted, RANGE_LO),
  p50: quantileSorted(sorted, 0.5),
  hi: quantileSorted(sorted, RANGE_HI),
})

export type RunOptions = {
  trials: number
  seed: number
  onProgress?: (done: number) => void
  progressEvery?: number
}

/**
 * 1つの Web Worker が受け持つ試行の生データ。
 * 分位点を正しく出すため、集計は全シャードを合わせてから行う。
 */
export type Shard = {
  n: number
  totals: Float64Array
  draws: Float64Array
  sums: { draws: number; drawingSec: number; handSec: number; janken: number }
}

export const runShard = (params: Params, opt: RunOptions): Shard => {
  const rng = createRng(opt.seed)
  const tm = toTimeModel(params)
  const deal = { players: params.players, freeCenter: FREE_CENTER }

  const order = new Uint8Array(BALLS)
  const pos = new Uint8Array(BALLS + 1)
  const pool = createPool()
  const card = new Uint8Array(25)
  const cellPos = new Uint8Array(25)
  const counts = new Uint32Array(BALLS + 1)

  const n = opt.trials
  const sums = { draws: 0, drawingSec: 0, handSec: 0, janken: 0 }
  const shard: Shard = { n, totals: new Float64Array(n), draws: new Float64Array(n), sums }
  const every = opt.progressEvery ?? 500

  for (let i = 0; i < n; i++) {
    shuffleDrawOrder(rng, order)
    toDrawPositions(order, pos)
    dealAndCount(rng, deal, pos, pool, card, cellPos, counts)

    const o = resolveParty(counts, params.prizes, tm)
    shard.totals[i] = o.totalSec
    shard.draws[i] = o.draws
    sums.draws += o.draws
    sums.drawingSec += o.drawingSec
    sums.handSec += o.handSec
    if (o.janken) sums.janken++

    if (opt.onProgress && (i + 1) % every === 0) opt.onProgress(i + 1)
  }
  return shard
}

const concat = (parts: Float64Array[]) => {
  const out = new Float64Array(parts.reduce((s, p) => s + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export const summarizeShards = (shards: Shard[], seed: number, elapsedMs: number): SimResult => {
  const n = shards.reduce((s, sh) => s + sh.n, 0)
  const avg = (key: keyof Shard['sums']) => shards.reduce((s, sh) => s + sh.sums[key], 0) / n

  return {
    trials: n,
    seed,
    elapsedMs,
    total: summarize(concat(shards.map((s) => s.totals)).sort()),
    draws: summarize(concat(shards.map((s) => s.draws)).sort()),
    mean: { draws: avg('draws'), drawingSec: avg('drawingSec'), handSec: avg('handSec') },
    jankenRate: avg('janken'),
  }
}

/** 単一スレッドでまとめて実行する（テスト・検証用） */
export const runSimulation = (params: Params, opt: RunOptions): SimResult => {
  const t0 = Date.now()
  return summarizeShards([runShard(params, opt)], opt.seed, Date.now() - t0)
}

/** シャードごとのシード（同じシード・同じシャード数なら結果は再現する） */
export const shardSeed = (seed: number, index: number) => (seed + Math.imul(index, 0x9e3779b9)) >>> 0
