/// <reference lib="webworker" />
/**
 * シミュレーションを UI スレッドの外で実行する。
 * 1つの Worker は試行の一部（シャード）を受け持ち、生データを返す。
 */
import type { Params } from '../core/params'
import { simulateSampleParty } from '../core/sample'
import { runShard } from '../core/simulate'

export type WorkerRequest =
  | { type: 'shard'; params: Params; trials: number; seed: number }
  | { type: 'sample'; params: Params; seed: number }

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data
  if (req.type === 'sample') {
    self.postMessage({ type: 'sample', sample: simulateSampleParty(req.params, req.seed) })
    return
  }
  const shard = runShard(req.params, {
    trials: req.trials,
    seed: req.seed,
    progressEvery: 250,
    onProgress: (done) => self.postMessage({ type: 'progress', done }),
  })
  self.postMessage({ type: 'shard', shard }, [shard.totals.buffer, shard.draws.buffer])
}
