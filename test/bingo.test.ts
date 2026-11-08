import { describe, expect, test } from 'vitest'
import {
  BALLS,
  FREE_CELL,
  LINES,
  bingoDraw,
  createPool,
  dealAndCount,
  fillCard,
  shuffleDrawOrder,
  toDrawPositions,
} from '../src/core/bingo'
import { resolveParty } from '../src/core/party'
import { DEFAULT_PARAMS, parseParams, toSearch, toTimeModel } from '../src/core/params'
import { createRng } from '../src/core/rng'
import { simulateSampleParty } from '../src/core/sample'
import { runSimulation } from '../src/core/simulate'
import { quantileSorted } from '../src/core/stats'

describe('抽選順', () => {
  test('1〜75 の並べ替えになっている', () => {
    const order = shuffleDrawOrder(createRng(1), new Uint8Array(BALLS))
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 75 }, (_, i) => i + 1))
  })

  test('どの番号も各位置に均等に出る（カイ二乗の目安）', () => {
    const rng = createRng(2)
    const order = new Uint8Array(BALLS)
    const firstCount = new Array(76).fill(0)
    const n = 75_000
    for (let i = 0; i < n; i++) firstCount[shuffleDrawOrder(rng, order)[0]]++
    const e = n / 75
    const chi2 = firstCount.slice(1).reduce((s, c) => s + (c - e) ** 2 / e, 0)
    // 自由度74 の 99.9% 点は約 117
    expect(chi2).toBeLessThan(117)
  })
})

describe('カード', () => {
  test('各列は範囲内の重複しない5つの番号', () => {
    const rng = createRng(3)
    const pool = createPool()
    const card = new Uint8Array(25)
    for (let t = 0; t < 1000; t++) {
      fillCard(rng, pool, card)
      for (let c = 0; c < 5; c++) {
        const col = [...card.slice(c * 5, c * 5 + 5)]
        expect(new Set(col).size).toBe(5)
        for (const v of col) {
          expect(v).toBeGreaterThanOrEqual(c * 15 + 1)
          expect(v).toBeLessThanOrEqual(c * 15 + 15)
        }
      }
    }
  })

  test('ラインは縦5・横5・斜め2の12本で、中央を通るのは4本', () => {
    expect(LINES).toHaveLength(12)
    expect(LINES.filter((l) => l.includes(FREE_CELL))).toHaveLength(4)
  })
})

describe('ビンゴ判定', () => {
  // 旧版のテストと同じ「並べ替えないカード」: B列 1-5, I列 16-20, N列 31-35, G列 46-50, O列 61-65
  const fixedCard = Uint8Array.from({ length: 25 }, (_, i) => Math.floor(i / 5) * 15 + (i % 5) + 1)
  const drawCardInOrder = (numbers: number[]) => {
    const pos = new Uint8Array(76).fill(99)
    numbers.forEach((n, i) => (pos[n] = i + 1))
    const cellPos = Uint8Array.from(fixedCard, (n) => pos[n])
    cellPos[FREE_CELL] = 0
    return bingoDraw(cellPos)
  }

  test('縦（同じ列）', () => {
    for (let c = 0; c < 5; c++) {
      const nums = [1, 2, 3, 4, 5].map((r) => c * 15 + r).filter((n) => n !== 33)
      expect(drawCardInOrder(nums)).toBe(nums.length)
    }
  })

  test('横（同じ行）', () => {
    for (let r = 1; r <= 5; r++) {
      const nums = [0, 1, 2, 3, 4].map((c) => c * 15 + r).filter((n) => n !== 33)
      expect(drawCardInOrder(nums)).toBe(nums.length)
    }
  })

  test('斜め（中央フリー込みで4球）', () => {
    expect(drawCardInOrder([1, 17, 49, 65])).toBe(4)
    expect(drawCardInOrder([5, 19, 47, 61])).toBe(4)
  })

  test('揃っていなければビンゴにならない', () => {
    expect(drawCardInOrder([1, 2, 3, 4, 17, 18, 19])).toBe(99)
  })
})

describe('進行（時間）モデル', () => {
  const tm = { drawSec: 10, winSec: 20 }

  test('旧版のテストケース: 5球目で2人同時ビンゴ・景品2 → 90秒', () => {
    const counts = new Uint32Array(76)
    counts[5] = 2
    const o = resolveParty(counts, 2, tm)
    expect(o.draws).toBe(5)
    expect(o.totalSec).toBe(90)
    expect(o.janken).toBe(false)
  })

  test('当選者が残り景品より多ければ、景品の数だけ渡して終わる', () => {
    const counts = new Uint32Array(76)
    counts[10] = 1
    counts[12] = 3
    const o = resolveParty(counts, 2, tm)
    // 12球×10 + 2人×20
    expect(o.totalSec).toBe(120 + 40)
    expect(o.janken).toBe(true)
    expect(o.awarded).toBe(2)
  })
})

describe('シミュレーション', () => {
  test('進行ログ（1球ずつ判定する素朴な実装）が高速版の1回目と一致する', () => {
    for (const seed of [1, 2, 3, 42, 1234]) {
      const params = { ...DEFAULT_PARAMS, players: 80, prizes: 15 }
      const sample = simulateSampleParty(params, seed)
      const fast = runSimulation(params, { trials: 1, seed })
      expect(sample.totalSec).toBe(fast.total.p50)
      expect(sample.events.length).toBe(fast.draws.p50)
    }
  })

  test('シードが同じなら結果も同じ', () => {
    const a = runSimulation(DEFAULT_PARAMS, { trials: 300, seed: 99 })
    const b = runSimulation(DEFAULT_PARAMS, { trials: 300, seed: 99 })
    expect(a.total).toEqual(b.total)
  })

  test('内訳の平均を足すと所要時間の平均になる', () => {
    const p = { ...DEFAULT_PARAMS, players: 120, prizes: 30 }
    const r = runSimulation(p, { trials: 2000, seed: 6 })
    expect(r.mean.drawingSec + r.mean.handSec).toBeCloseTo(r.total.mean, 6)
    expect(r.mean.drawingSec).toBeCloseTo(r.mean.draws * p.drawSec, 6)
    expect(r.mean.handSec).toBe(p.prizes * p.winSec)
  })
})

describe('パラメータ', () => {
  test('URL との往復', () => {
    const p = { players: 250, prizes: 30, drawSec: 12, winSec: 45 }
    expect(parseParams(toSearch(p))).toEqual(p)
    expect(toSearch(DEFAULT_PARAMS).toString()).toBe('')
  })

  test('範囲外・不正な値は丸める', () => {
    const p = parseParams(new URLSearchParams('n=99999&p=-3&d=abc'))
    expect(p.players).toBe(2000)
    expect(p.prizes).toBe(1)
    expect(p.drawSec).toBe(DEFAULT_PARAMS.drawSec)
  })

  test('旧版の URL の項目（確認・ジャンケン・準備など）は無視する', () => {
    expect(parseParams(new URLSearchParams('c=20&j=40&s=3&a=10&f=0'))).toEqual(DEFAULT_PARAMS)
  })
})

describe('統計', () => {
  test('分位点', () => {
    const xs = Float64Array.from([10, 20, 60])
    expect(quantileSorted(xs, 0)).toBe(10)
    expect(quantileSorted(xs, 0.5)).toBe(20)
    expect(quantileSorted(xs, 1)).toBe(60)
  })
})
