/**
 * 宴会の進行（時間）モデル
 *
 *   所要時間 = 抽選した回数 × 1回の抽選の時間 + 当選者数 × 1回の当選の時間
 *
 * 景品は1人1個。最後の球で当たった人が残りの景品より多ければジャンケンなどで決めるが、
 * その時間は「1回の当選の時間」に含まれているものとして別には数えない（起きる確率だけ出す）。
 */
import { BALLS } from './bingo'

export type TimeModel = {
  /** 1回の抽選（回す・読み上げ・穴をあける） */
  drawSec: number
  /** 当選者1人あたり（「ビンゴ！」から前に出て景品を受け取り、席に戻るまで） */
  winSec: number
}

export type PartyOutcome = {
  /** 終了までの抽選回数 */
  draws: number
  totalSec: number
  drawingSec: number
  /** 景品の受け渡し（当選者数 × 1人あたり） */
  handSec: number
  /** 最後の球で当選者が残りの景品より多かったか */
  janken: boolean
  /** 渡せた景品数（参加人数 ≥ 景品数なので通常は景品数と同じ） */
  awarded: number
}

/** counts[d] = d 回目の抽選で新たにビンゴになった人数 */
export const resolveParty = (counts: Uint32Array, prizes: number, t: TimeModel): PartyOutcome => {
  let remaining = prizes
  let draws = 0
  let janken = false
  for (let d = 1; d <= BALLS && remaining > 0; d++) {
    draws = d
    const w = counts[d]
    if (w === 0) continue
    if (w > remaining) janken = true
    remaining -= Math.min(w, remaining)
  }
  const awarded = prizes - remaining
  const drawingSec = draws * t.drawSec
  const handSec = awarded * t.winSec
  return { draws, totalSec: drawingSec + handSec, drawingSec, handSec, janken, awarded }
}
