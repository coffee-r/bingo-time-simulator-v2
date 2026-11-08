/**
 * 入力パラメータ。サーバー・ブラウザ・テストで共用する。
 */
import type { TimeModel } from './party'

export type Params = {
  players: number
  prizes: number
  /** 1回の抽選にかける秒数 */
  drawSec: number
  /** 1回の当選（当選者1人）にかける秒数 */
  winSec: number
}

export type NumKey = keyof Params

export const NUM_FIELDS: Record<NumKey, { min: number; max: number; q: string }> = {
  players: { min: 1, max: 2000, q: 'n' },
  prizes: { min: 1, max: 2000, q: 'p' },
  drawSec: { min: 1, max: 300, q: 'd' },
  winSec: { min: 0, max: 600, q: 'w' },
}

/**
 * 既定値
 * 1回の抽選 20秒 = ガラガラを回す・番号の読み上げと復唱・参加者が探して穴をあける
 * 1回の当選 60秒 = 「ビンゴ！」の申告・前に出る・カード確認・景品の受け取り・席に戻る
 */
export const DEFAULT_PARAMS: Params = {
  players: 50,
  prizes: 10,
  drawSec: 20,
  winSec: 60,
}

/** ビンゴカードの真ん中は最初から開いている（一般的な市販カードと同じ） */
export const FREE_CENTER = true

/** 1回の計算で試すビンゴ大会の回数 */
export const TRIALS = 10_000

const KEYS = Object.keys(NUM_FIELDS) as NumKey[]

export const clampField = (key: NumKey, value: number) => {
  const f = NUM_FIELDS[key]
  if (!Number.isFinite(value)) return DEFAULT_PARAMS[key]
  return Math.min(f.max, Math.max(f.min, Math.round(value)))
}

export const parseParams = (search: URLSearchParams): Params => {
  const p: Params = { ...DEFAULT_PARAMS }
  for (const key of KEYS) {
    const raw = search.get(NUM_FIELDS[key].q)
    if (raw !== null && raw !== '') p[key] = clampField(key, Number(raw))
  }
  return p
}

/** 既定値と同じ項目は省略して短い URL にする */
export const toSearch = (p: Params) => {
  const s = new URLSearchParams()
  for (const key of KEYS) if (p[key] !== DEFAULT_PARAMS[key]) s.set(NUM_FIELDS[key].q, String(p[key]))
  return s
}

export const validate = (p: Params): string | null => {
  if (p.prizes > p.players) return '景品数は参加人数以下にしてください（景品は1人1個の前提です）'
  return null
}

export const toTimeModel = (p: Params): TimeModel => ({ drawSec: p.drawSec, winSec: p.winSec })
