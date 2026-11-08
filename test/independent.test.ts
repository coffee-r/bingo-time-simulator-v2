/**
 * 独立実装との突き合わせ
 *
 * 本体とコードを一切共有しない「素朴な」実装（2次元配列のカード、1球ずつ全員の穴をあけて
 * 縦横斜めをループで判定、別の乱数）で宴会をシミュレーションし、所要時間の分布が本体と一致するかを見る。
 * 本体側にカード生成・判定・時間計算のどこかに誤りがあれば、ここで分布がずれる。
 */
import { describe, expect, test } from 'vitest'
import { DEFAULT_PARAMS, type Params } from '../src/core/params'
import { runShard } from '../src/core/simulate'

/** mulberry32（本体の xoshiro とは別の乱数） */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** 配列を丸ごとシャッフルしたコピー */
const shuffled = <T>(xs: T[], rand: () => number) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Card = { nums: number[][]; open: boolean[][] } // [行][列]

const makeCard = (rand: () => number): Card => {
  const nums: number[][] = Array.from({ length: 5 }, () => [])
  for (let col = 0; col < 5; col++) {
    const picks = shuffled(
      Array.from({ length: 15 }, (_, i) => col * 15 + i + 1),
      rand,
    ).slice(0, 5)
    for (let row = 0; row < 5; row++) nums[row][col] = picks[row]
  }
  const open = Array.from({ length: 5 }, () => Array(5).fill(false))
  open[2][2] = true // 真ん中はフリー
  return { nums, open }
}

const isBingo = ({ open }: Card) => {
  for (let i = 0; i < 5; i++) {
    if (open[i].every(Boolean)) return true
    if (open.every((row) => row[i])) return true
  }
  if ([0, 1, 2, 3, 4].every((i) => open[i][i])) return true
  if ([0, 1, 2, 3, 4].every((i) => open[i][4 - i])) return true
  return false
}

/** 宴会1回。ルールは README の時間モデルをそのまま書き下したもの */
const naiveParty = (p: Params, rand: () => number) => {
  const cards: Card[] = []
  for (let i = 0; i < p.players; i++) cards.push(makeCard(rand))
  const balls = shuffled(
    Array.from({ length: 75 }, (_, i) => i + 1),
    rand,
  )
  let time = 0
  let prizesLeft = p.prizes
  let janken = false
  let drawn = 0
  const stillPlaying = new Set(cards)
  for (const ball of balls) {
    if (prizesLeft === 0) break
    drawn++
    time += p.drawSec
    for (const c of cards)
      for (let r = 0; r < 5; r++) for (let col = 0; col < 5; col++) if (c.nums[r][col] === ball) c.open[r][col] = true
    const winners = [...stillPlaying].filter(isBingo)
    if (winners.length === 0) continue
    winners.forEach((w) => stillPlaying.delete(w))
    if (winners.length > prizesLeft) {
      janken = true
      time += prizesLeft * p.winSec
      prizesLeft = 0
    } else {
      time += winners.length * p.winSec
      prizesLeft -= winners.length
    }
  }
  return { time, drawn, janken }
}

/** 2標本コルモゴロフ–スミルノフ距離 */
const ks = (a: Float64Array, b: Float64Array) => {
  const x = [...a].sort((p, q) => p - q)
  const y = [...b].sort((p, q) => p - q)
  let i = 0
  let j = 0
  let d = 0
  while (i < x.length && j < y.length) {
    const v = Math.min(x[i], y[j])
    while (i < x.length && x[i] <= v) i++
    while (j < y.length && y[j] <= v) j++
    d = Math.max(d, Math.abs(i / x.length - j / y.length))
  }
  return d
}

const cases: { name: string; p: Params }[] = [
  { name: '既定（50人・景品10）', p: DEFAULT_PARAMS },
  { name: '大人数・景品少なめ・抽選ゆっくり', p: { players: 300, prizes: 6, drawSec: 40, winSec: 60 } },
  { name: 'ほぼ全員に景品（ジャンケン多発）', p: { ...DEFAULT_PARAMS, players: 30, prizes: 27 } },
  { name: '景品1個', p: { ...DEFAULT_PARAMS, players: 40, prizes: 1 } },
]

describe('独立実装との一致', () => {
  for (const c of cases) {
    test(c.name, () => {
      const n = 6000
      const rand = mulberry32(777)
      const naive = Array.from({ length: n }, () => naiveParty(c.p, rand))
      const shard = runShard(c.p, { trials: n, seed: 4242 })

      // 所要時間の分布（KS 検定、有意水準 0.1%: 1.95 * sqrt(2/n)）
      const d = ks(Float64Array.from(naive, (r) => r.time), shard.totals)
      expect(d).toBeLessThan(1.95 * Math.sqrt(2 / n))

      // ジャンケンの発生率（2標本の比率の差、±4σ）
      const p1 = naive.filter((r) => r.janken).length / n
      const p2 = shard.sums.janken / n
      const pooled = (p1 + p2) / 2
      expect(Math.abs(p1 - p2)).toBeLessThanOrEqual(4 * Math.sqrt((2 * pooled * (1 - pooled)) / n) + 1e-9)
    })
  }
})
