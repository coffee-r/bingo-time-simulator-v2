/**
 * 宴会1回分を1球ずつ進めて、司会者目線の進行ログを作る（表示用）。
 * 集計用の高速版（dealAndCount + resolveParty）と同じルール・同じ時間モデルで動く。
 */
import { BALLS, FREE_CELL, LINES, createPool, fillCard, shuffleDrawOrder } from './bingo'
import { FREE_CENTER, type Params, toTimeModel } from './params'
import { createRng } from './rng'

export type SampleEvent = {
  draw: number
  ball: number
  /** この球を引き始めた時点の経過秒 */
  startSec: number
  /** この球を処理し終えた時点の経過秒 */
  atSec: number
  /** リーチ中の人数（まだ当選していない参加者のみ） */
  reach: number
  /** この球で新たにビンゴになった人数 */
  bingo: number
  /** この球で景品を受け取った人数 */
  awarded: number
  janken: boolean
}

export type SampleParty = {
  seed: number
  events: SampleEvent[]
  totalSec: number
  awarded: number
}

const LINE_MASKS = LINES.map((l) => l.reduce((m, c) => m | (1 << c), 0))

const popcount = (x: number) => {
  x -= (x >>> 1) & 0x55555555
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
}

export const simulateSampleParty = (params: Params, seed: number): SampleParty => {
  const rng = createRng(seed)
  const tm = toTimeModel(params)
  const order = shuffleDrawOrder(rng, new Uint8Array(BALLS))
  const pool = createPool()

  // holders[番号] にその番号があるカードとセルを登録しておく
  const marks: number[] = []
  const holders: { card: number; cell: number }[][] = Array.from({ length: BALLS + 1 }, () => [])
  const card = new Uint8Array(25)
  for (let id = 0; id < params.players; id++) {
    fillCard(rng, pool, card)
    marks.push(FREE_CENTER ? 1 << FREE_CELL : 0)
    for (let c = 0; c < 25; c++) {
      if (FREE_CENTER && c === FREE_CELL) continue
      holders[card[c]].push({ card: id, cell: c })
    }
  }

  const won = new Uint8Array(marks.length)
  let remaining = params.prizes
  let t = 0
  const events: SampleEvent[] = []

  for (let d = 1; d <= BALLS && remaining > 0; d++) {
    const ball = order[d - 1]
    for (const h of holders[ball]) marks[h.card] |= 1 << h.cell

    let bingo = 0
    let reach = 0
    for (let id = 0; id < marks.length; id++) {
      if (won[id]) continue
      const m = marks[id]
      let isBingo = false
      let isReach = false
      for (const lm of LINE_MASKS) {
        const hit = popcount(m & lm)
        if (hit === 5) isBingo = true
        else if (hit === 4) isReach = true
      }
      if (isBingo) {
        won[id] = 1
        bingo++
      } else if (isReach) reach++
    }

    const startSec = t
    t += tm.drawSec
    let awarded = 0
    let janken = false
    if (bingo > 0) {
      awarded = Math.min(bingo, remaining)
      janken = bingo > remaining
      t += awarded * tm.winSec
      remaining -= awarded
    }
    events.push({ draw: d, ball, startSec, atSec: t, reach, bingo, awarded, janken })
  }

  return { seed, events, totalSec: t, awarded: params.prizes - remaining }
}
