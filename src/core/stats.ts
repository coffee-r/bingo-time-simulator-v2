/** 昇順ソート済み配列の分位点（線形補間） */
export const quantileSorted = (sorted: ArrayLike<number>, q: number) => {
  const n = sorted.length
  if (n === 0) return NaN
  const h = (n - 1) * q
  const lo = Math.floor(h)
  const hi = Math.min(n - 1, lo + 1)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo)
}

export const meanOf = (xs: ArrayLike<number>) => {
  let s = 0
  for (let i = 0; i < xs.length; i++) s += xs[i]
  return s / xs.length
}
