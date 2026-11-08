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

/** 秒 → 「12:34」（経過時間） */
export const fmtElapsed = (sec: number) => {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return `${h ? `${h}:` : ''}${mm}:${String(r).padStart(2, '0')}`
}

export const fmtPct = (r: number) => {
  if (r > 0 && r < 0.01) return '1%未満'
  if (r < 1 && r > 0.99) return '99%超'
  return `${Math.round(r * 100)}%`
}

export const fmtNum = (n: number, digits = 0) =>
  n.toLocaleString('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
