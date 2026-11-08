/**
 * 秒 → 「31分」。範囲の下限は floor、上限は ceil にして見積もりが楽観側に寄らないようにする。
 * 10分未満は 30秒刻みで「8分30秒」。
 */
export const fmtMin = (sec: number, mode: 'round' | 'floor' | 'ceil' = 'round') => {
  if (!Number.isFinite(sec)) return '—'
  if (sec < 600) {
    const s = Math[mode](sec / 30) * 30
    const m = Math.floor(s / 60)
    return s % 60 ? `${m}分30秒` : `${m}分`
  }
  return `${Math[mode](sec / 60)}分`
}

/** 秒の範囲 → 「18分 〜 21分」。下限は切り捨て、上限は切り上げ */
export const fmtRange = (lo: number, hi: number) => {
  const a = fmtMin(lo, 'floor')
  const b = fmtMin(hi, 'ceil')
  return a === b ? `約${a}` : `${a} 〜 ${b}`
}

/** 秒 → 「19分40秒」「45秒」 */
export const fmtDur = (sec: number) => {
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r}秒`
  return r ? `${m}分${r}秒` : `${m}分`
}

/** 秒 → 「19:40」（進行表の経過時間。1時間を超えても分で数える: 「75:20」） */
export const fmtElapsed = (sec: number) => {
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const fmtPct = (r: number) => {
  if (r > 0 && r < 0.01) return '1%未満'
  if (r < 1 && r > 0.99) return '99%超'
  return `${Math.round(r * 100)}%`
}

export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
