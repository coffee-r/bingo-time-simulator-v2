/**
 * シミュレーションを厳密計算と突き合わせる（精度の検証）
 */
import { describe, expect, test } from 'vitest'
import { BALLS, createPool, dealAndCount, shuffleDrawOrder, toDrawPositions } from '../src/core/bingo'
import { exactKthBingoCdf } from '../src/core/exact'
import { createRng } from '../src/core/rng'

/** モンテカルロで k 人目のビンゴが出る抽選回の CDF を求める */
const simulatedCdf = (players: number, k: number, freeCenter: boolean, trials: number, seed: number) => {
  const rng = createRng(seed)
  const order = new Uint8Array(BALLS)
  const pos = new Uint8Array(BALLS + 1)
  const pool = createPool()
  const card = new Uint8Array(25)
  const cellPos = new Uint8Array(25)
  const counts = new Uint32Array(BALLS + 1)
  const hist = new Array(76).fill(0)
  for (let i = 0; i < trials; i++) {
    toDrawPositions(shuffleDrawOrder(rng, order), pos)
    dealAndCount(rng, { players, freeCenter }, pos, pool, card, cellPos, counts)
    let cum = 0
    for (let d = 1; d <= BALLS; d++) {
      cum += counts[d]
      if (cum >= k) {
        hist[d]++
        break
      }
    }
  }
  const cdf: number[] = []
  let c = 0
  for (let d = 0; d <= BALLS; d++) cdf.push((c += hist[d]) / trials)
  return cdf
}

const maxDiff = (a: number[], b: number[]) => Math.max(...a.map((x, i) => Math.abs(x - b[i])))

describe('厳密計算との一致', () => {
  test('厳密解は確率分布になっている（単調・75球で1）', () => {
    const cdf = exactKthBingoCdf(1, 1)
    for (let d = 1; d <= 75; d++) expect(cdf[d]).toBeGreaterThanOrEqual(cdf[d - 1] - 1e-12)
    expect(cdf[3]).toBeCloseTo(0, 12)
    expect(cdf[75]).toBeCloseTo(1, 9)
    // 4球でビンゴ = 中央を通る4ラインのどれかが4球ちょうどで揃う。
    // 各ラインの4マスが4球と一致する確率は 15^4 / C(75,4)（列ごとに1マスずつ、各列 1/15 で選ばれる）
    // 4つの事象は排反なので和をとる
    const c75_4 = (75 * 74 * 73 * 72) / 24
    expect(cdf[4]).toBeCloseTo((4 * (1 / 15) ** 4 * 15 ** 4) / c75_4, 12)
  })

  // コルモゴロフ–スミルノフ距離の許容値は 1.63/√n（有意水準 1%）
  const cases = [
    { players: 1, k: 1, freeCenter: true },
    { players: 1, k: 1, freeCenter: false },
    { players: 30, k: 5, freeCenter: true },
    { players: 100, k: 20, freeCenter: true },
  ]
  for (const c of cases) {
    test(`参加 ${c.players}人・${c.k}人目・中央フリー${c.freeCenter ? 'あり' : 'なし'}`, () => {
      const n = 40_000
      const exact = exactKthBingoCdf(c.players, c.k, c.freeCenter)
      const sim = simulatedCdf(c.players, c.k, c.freeCenter, n, 2024 + c.players)
      expect(maxDiff(exact, sim)).toBeLessThan(1.63 / Math.sqrt(n))
    })
  }
})
