/**
 * 「k 人目のビンゴが何球目までに出るか」の厳密な確率（シミュレーションの検証用）
 *
 * d 球引いた時点で各列から何個出たか (a1..a5) が決まれば、各カードがビンゴ済みである確率 p は
 * 12ラインの包除原理で厳密に計算できる（カードの各列は15個から5個を無作為に選ぶので、
 * その列の m マスがすべて出ている確率は C(a,m)/C(15,m)）。
 * 列ごとの出方を固定すると各カードは独立なので、ビンゴ人数は二項分布 Bin(N, p) に従う。
 * これを列ごとの出方（多変量超幾何分布）で平均する。
 */
import { FREE_CELL, LINES, SIZE } from './bingo'

const binom = (() => {
  const t: number[][] = []
  for (let n = 0; n <= 75; n++) {
    t.push([])
    for (let k = 0; k <= n; k++) t[n].push(k === 0 || k === n ? 1 : t[n - 1][k - 1] + t[n - 1][k])
  }
  return (n: number, k: number) => (k < 0 || k > n ? 0 : t[n][k])
})()

/** 包除原理の項を「各列で何マス必要か」(m1..m5) ごとにまとめた係数 */
const inclusionExclusionTerms = (freeCenter: boolean) => {
  const coef = new Map<number, number>()
  const L = LINES.length
  for (let s = 1; s < 1 << L; s++) {
    let cells = 0
    let size = 0
    for (let l = 0; l < L; l++) {
      if (!(s & (1 << l))) continue
      size++
      for (const c of LINES[l]) cells |= 1 << c
    }
    if (freeCenter) cells &= ~(1 << FREE_CELL)
    let key = 0
    for (let c = SIZE - 1; c >= 0; c--) {
      let m = 0
      for (let r = 0; r < SIZE; r++) if (cells & (1 << (c * SIZE + r))) m++
      key = key * 6 + m
    }
    coef.set(key, (coef.get(key) ?? 0) + (size % 2 ? 1 : -1))
  }
  const terms: { m: number[]; coef: number }[] = []
  for (const [key, c] of coef) {
    if (c === 0) continue
    const m: number[] = []
    let k = key
    for (let i = 0; i < SIZE; i++) {
      m.push(k % 6)
      k = Math.floor(k / 6)
    }
    terms.push({ m, coef: c })
  }
  return terms
}

/** P(Bin(n, p) >= k) */
const binomTail = (n: number, p: number, k: number) => {
  if (k <= 0) return 1
  if (p <= 0) return 0
  if (p >= 1) return 1
  // 対数のまま P(X = x) を漸化式で更新し、x = k..n を足し上げる（p≈1 でも桁あふれしない）
  let logTerm = 0
  for (let i = 0; i < k; i++) logTerm += Math.log(n - i) - Math.log(i + 1)
  logTerm += k * Math.log(p) + (n - k) * Math.log1p(-p)
  const logRatio = Math.log(p) - Math.log1p(-p)
  let sum = Math.exp(logTerm)
  for (let x = k; x < n; x++) {
    logTerm += Math.log((n - x) / (x + 1)) + logRatio
    sum += Math.exp(logTerm)
  }
  return Math.min(1, sum)
}

type Trie = { coef: number; children: Map<number, Trie> }

/** 項を列ごとの木にまとめ、Σ coef Π g[a_c][m_c] を共通部分をくくり出して計算する */
const buildTrie = (terms: { m: number[]; coef: number }[]) => {
  const root: Trie = { coef: 0, children: new Map() }
  for (const t of terms) {
    let node = root
    for (const m of t.m) {
      let next = node.children.get(m)
      if (!next) node.children.set(m, (next = { coef: 0, children: new Map() }))
      node = next
    }
    node.coef += t.coef
  }
  // 評価を速くするため配列に変換
  type Flat = { ms: number[]; kids: Flat[]; coef: number }
  const flatten = (n: Trie): Flat => ({
    ms: [...n.children.keys()],
    kids: [...n.children.values()].map(flatten),
    coef: n.coef,
  })
  return flatten(root)
}

type Table = { d: Uint8Array; weight: Float64Array; p: Float64Array }
const tableCache = new Map<boolean, Table>()

/**
 * 列ごとの出方 (a1..a5) すべてについて「その出方になる確率」と「1枚のカードがビンゴ済みの確率 p」の表。
 * 参加人数・景品数によらないので一度だけ作る。
 */
const compositionTable = (freeCenter: boolean): Table => {
  const cached = tableCache.get(freeCenter)
  if (cached) return cached
  const trie = buildTrie(inclusionExclusionTerms(freeCenter))
  const g = Array.from({ length: 16 }, (_, a) => Array.from({ length: 6 }, (_, m) => binom(a, m) / binom(15, m)))
  const size = 16 ** SIZE
  const table: Table = { d: new Uint8Array(size), weight: new Float64Array(size), p: new Float64Array(size) }
  const a = [0, 0, 0, 0, 0]
  const evalTrie = (node: ReturnType<typeof buildTrie>, col: number): number => {
    if (col === SIZE) return node.coef
    let v = 0
    const row = g[a[col]]
    for (let i = 0; i < node.ms.length; i++) {
      const gm = row[node.ms[i]]
      if (gm !== 0) v += gm * evalTrie(node.kids[i], col + 1)
    }
    return v
  }
  let idx = 0
  for (a[0] = 0; a[0] <= 15; a[0]++)
    for (a[1] = 0; a[1] <= 15; a[1]++)
      for (a[2] = 0; a[2] <= 15; a[2]++)
        for (a[3] = 0; a[3] <= 15; a[3]++)
          for (a[4] = 0; a[4] <= 15; a[4]++) {
            const d = a[0] + a[1] + a[2] + a[3] + a[4]
            table.d[idx] = d
            table.weight[idx] = a.reduce((w, x) => w * binom(15, x), 1) / binom(75, d)
            table.p[idx] = Math.min(1, Math.max(0, evalTrie(trie, 0)))
            idx++
          }
  tableCache.set(freeCenter, table)
  return table
}

/**
 * cdf[d] = P(d 球目までに k 人以上ビンゴ) を d = 0..75 について返す。
 * （全員参加・1人1枚。k 人目の景品が渡る抽選回の分布そのもの）
 */
export const exactKthBingoCdf = (players: number, k: number, freeCenter = true) => {
  const t = compositionTable(freeCenter)
  const cdf = new Array<number>(76).fill(0)
  for (let i = 0; i < t.d.length; i++) cdf[t.d[i]] += t.weight[i] * binomTail(players, t.p[i], k)
  return cdf
}
