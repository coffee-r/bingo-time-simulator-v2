/**
 * ビンゴのカード・抽選・判定
 *
 * カードは 5×5。セル番号は col*5 + row（col: B,I,N,G,O / row: 上から 0〜4）。
 * 列ごとに番号の範囲が決まっている（B:1-15, I:16-30, N:31-45, G:46-60, O:61-75）。
 * 中央（N列の3行目 = セル12）はフリー。
 */
import type { Rng } from './rng'

export const BALLS = 75
export const SIZE = 5
export const FREE_CELL = 12
export const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const

/** 縦5・横5・斜め2 の計12ライン。各ラインはセル番号5つ */
export const LINES: readonly (readonly number[])[] = (() => {
  const lines: number[][] = []
  for (let r = 0; r < SIZE; r++) lines.push([0, 1, 2, 3, 4].map((c) => c * SIZE + r))
  for (let c = 0; c < SIZE; c++) lines.push([0, 1, 2, 3, 4].map((r) => c * SIZE + r))
  lines.push([0, 1, 2, 3, 4].map((i) => i * SIZE + i))
  lines.push([0, 1, 2, 3, 4].map((i) => i * SIZE + (SIZE - 1 - i)))
  return lines
})()

const FLAT_LINES = Uint8Array.from(LINES.flat())

export const ballLabel = (n: number) => `${LETTERS[Math.floor((n - 1) / 15)]}-${n}`

/** 1〜75 をシャッフルした抽選順。order[i] は i+1 回目に出る番号 */
export const shuffleDrawOrder = (rng: Rng, order: Uint8Array) => {
  for (let i = 0; i < BALLS; i++) order[i] = i + 1
  for (let i = BALLS - 1; i > 0; i--) {
    const j = rng.int(i + 1)
    const t = order[i]
    order[i] = order[j]
    order[j] = t
  }
  return order
}

/** pos[番号] = その番号が出る抽選回（1始まり） */
export const toDrawPositions = (order: Uint8Array, pos: Uint8Array) => {
  for (let i = 0; i < BALLS; i++) pos[order[i]] = i + 1
  return pos
}

/**
 * カードの番号を生成する。各列で範囲内の15個から5個を重複なく選ぶ。
 * pool は長さ75の作業領域（中身は常に1〜75の並べ替えになっていればよい）。
 */
export const fillCard = (rng: Rng, pool: Uint8Array, card: Uint8Array) => {
  for (let c = 0; c < SIZE; c++) {
    const base = c * 15
    for (let i = 0; i < SIZE; i++) {
      const j = i + rng.int(15 - i)
      const t = pool[base + i]
      pool[base + i] = pool[base + j]
      pool[base + j] = t
      card[c * SIZE + i] = pool[base + i]
    }
  }
  return card
}

export const createPool = () => {
  const pool = new Uint8Array(BALLS)
  for (let i = 0; i < BALLS; i++) pool[i] = i + 1
  return pool
}

/**
 * カードが何回目の抽選でビンゴになるか。
 * 各ラインは「そのラインで一番遅く出る番号の回」に揃い、カードは一番早く揃うラインでビンゴになる。
 */
export const bingoDraw = (cellPos: Uint8Array) => {
  let best = 255
  for (let l = 0; l < FLAT_LINES.length; l += SIZE) {
    let m = cellPos[FLAT_LINES[l]]
    for (let k = 1; k < SIZE; k++) {
      const p = cellPos[FLAT_LINES[l + k]]
      if (p > m) m = p
    }
    if (m < best) best = m
  }
  return best
}

export type DealOptions = {
  players: number
  freeCenter: boolean
}

/**
 * 1回のビンゴ大会ぶんのカードを配り、抽選回ごとの「新たにビンゴになった人数」を数える。
 * 景品は1人1個（当選者は以後抜ける）なので、k人目の当選が出る回 = ビンゴ回の小さい方から k 番目。
 * counts は長さ BALLS+1。
 */
export const dealAndCount = (
  rng: Rng,
  opt: DealOptions,
  pos: Uint8Array,
  pool: Uint8Array,
  card: Uint8Array,
  cellPos: Uint8Array,
  counts: Uint32Array,
) => {
  counts.fill(0)
  for (let p = 0; p < opt.players; p++) {
    fillCard(rng, pool, card)
    for (let i = 0; i < 25; i++) cellPos[i] = pos[card[i]]
    if (opt.freeCenter) cellPos[FREE_CELL] = 0
    counts[bingoDraw(cellPos)]++
  }
  return counts
}
