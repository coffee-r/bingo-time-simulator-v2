/**
 * シード付き疑似乱数（xoshiro128**）
 * Math.random と違ってシードを固定すれば同じ結果を再現できる。
 */
export type Rng = {
  /** [0, 2^32) の整数 */
  nextU32(): number
  /** [0, n) の整数 */
  int(n: number): number
  /** [0, 1) の実数 */
  float(): number
}

const splitmix32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x9e3779b9) >>> 0
    let z = a
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b)
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35)
    return (z ^ (z >>> 16)) >>> 0
  }
}

export const createRng = (seed: number): Rng => {
  const sm = splitmix32(seed)
  let s0 = sm()
  let s1 = sm()
  let s2 = sm()
  let s3 = sm()

  const nextU32 = () => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0
    const t = s1 << 9
    s2 ^= s0
    s3 ^= s1
    s1 ^= s2
    s0 ^= s3
    s2 ^= t
    s3 = rotl(s3, 11)
    return result
  }

  return {
    nextU32,
    // 乗算による範囲縮小。n<=2000 程度なら偏りは 1e-6 以下で無視できる
    int: (n) => Math.floor((nextU32() * n) / 4294967296),
    float: () => nextU32() / 4294967296,
  }
}

const rotl = (x: number, k: number) => (x << k) | (x >>> (32 - k))

export const randomSeed = () => (Math.random() * 4294967296) >>> 0
