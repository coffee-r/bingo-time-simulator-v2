/**
 * 複数の Web Worker に試行を分けて並列実行し、結果を合算する。
 */
import type { Params } from '../core/params'
import type { SampleParty } from '../core/sample'
import { type Shard, type SimResult, shardSeed, summarizeShards } from '../core/simulate'
import type { WorkerRequest } from './sim.worker'

const spawn = () => new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })

export const workerCount = () => Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1))

export type RunHandle = { cancel(): void; done: Promise<SimResult> }

export const runParallel = (
  params: Params,
  trials: number,
  seed: number,
  onProgress: (ratio: number) => void,
): RunHandle => {
  const n = Math.min(workerCount(), Math.ceil(trials / 500))
  const workers = Array.from({ length: n }, spawn)
  const progress = new Array<number>(n).fill(0)
  const t0 = performance.now()
  const cancel = () => workers.forEach((w) => w.terminate())

  const done = Promise.all(
    workers.map(
      (w, i) =>
        new Promise<Shard>((resolve, reject) => {
          const share = Math.floor(trials / n) + (i < trials % n ? 1 : 0)
          w.onmessage = (e) => {
            if (e.data.type === 'progress') {
              progress[i] = e.data.done
              onProgress(progress.reduce((a, b) => a + b, 0) / trials)
            } else if (e.data.type === 'shard') {
              resolve(e.data.shard)
            }
          }
          w.onerror = (err) => reject(err)
          w.postMessage({ type: 'shard', params, trials: share, seed: shardSeed(seed, i) } satisfies WorkerRequest)
        }),
    ),
  ).then((shards) => {
    cancel()
    return summarizeShards(shards, seed, performance.now() - t0)
  })

  return { cancel, done }
}

export const runSample = (params: Params, seed: number) =>
  new Promise<SampleParty>((resolve, reject) => {
    const w = spawn()
    w.onmessage = (e) => {
      w.terminate()
      resolve(e.data.sample)
    }
    w.onerror = (err) => {
      w.terminate()
      reject(err)
    }
    w.postMessage({ type: 'sample', params, seed } satisfies WorkerRequest)
  })
