/** @jsxImportSource hono/jsx/dom */
import { render, useEffect, useRef, useState } from 'hono/jsx/dom'
import { ballLabel } from '../core/bingo'
import { NUM_FIELDS, type NumKey, type Params, TRIALS, clampField, parseParams, toSearch, validate } from '../core/params'
import { randomSeed } from '../core/rng'
import type { SampleParty } from '../core/sample'
import type { SimResult } from '../core/simulate'
import { fmtDur, fmtElapsed, fmtNum, fmtRange } from './format'
import { type RunHandle, runParallel, runSample } from './runner'

/** 数値入力。入力途中の空欄は許し、数字が入った時点で範囲内に丸めて反映する */
const NumInput = (props: { id: NumKey; value: number; onChange: (v: number) => void; label: string }) => {
  const [text, setText] = useState(String(props.value))
  useEffect(() => setText(String(props.value)), [props.value])
  return (
    <input
      id={props.id}
      type="text"
      inputmode="numeric"
      autocomplete="off"
      aria-label={props.label}
      value={text}
      onInput={(e: InputEvent) => {
        const v = (e.target as HTMLInputElement).value
        setText(v)
        const digits = v.replace(/[^0-9]/g, '')
        if (digits !== '') props.onChange(clampField(props.id, Number(digits)))
      }}
      onBlur={() => setText(String(props.value))}
    />
  )
}

/** −/＋ つきの数値入力 */
const Stepper = (props: {
  id: NumKey
  label: string
  note?: string
  unit: string
  value: number
  onChange: (v: number) => void
}) => {
  const f = NUM_FIELDS[props.id]
  const step = (d: number) => props.onChange(clampField(props.id, props.value + d))
  return (
    <div class="stepper-row">
      <label for={props.id}>
        {props.label}
        {props.note && <small>{props.note}</small>}
      </label>
      <div class="stepper">
        <button type="button" aria-label={`${props.label}を減らす`} disabled={props.value <= f.min} onClick={() => step(-1)}>
          −
        </button>
        <NumInput id={props.id} label={props.label} value={props.value} onChange={props.onChange} />
        <button type="button" aria-label={`${props.label}を増やす`} disabled={props.value >= f.max} onClick={() => step(1)}>
          ＋
        </button>
        <span class="unit">{props.unit}</span>
      </div>
    </div>
  )
}

const Headline = (props: { r: SimResult; p: Params }) => {
  const { r, p } = props
  return (
    <div class="headline" aria-live="polite">
      <p class="headline-label">終了までの時間目安</p>
      <p class="headline-value">{fmtRange(r.total.lo, r.total.hi)}</p>
      <p class="headline-sub">
        抽選 平均{fmtNum(r.mean.draws, 1)}回 × {p.drawSec}秒 ＋ 当選 {fmtNum(p.prizes)}人 × {p.winSec}秒
      </p>
    </div>
  )
}

const Timeline = (props: { sample: SampleParty; onReroll: () => void }) => {
  const { sample } = props
  const first = sample.events.find((e) => e.bingo > 0)
  return (
    <details class="block sample">
      <summary>1回分の進行例を見る</summary>
      <div class="block-head">
        <p class="fine">
          {sample.events.length}球で終了、{fmtDur(sample.totalSec)}かかった回です。
          {first && `最初のビンゴは${first.draw}球目。`}
        </p>
        <button type="button" class="text-btn" onClick={props.onReroll}>
          別の回を見る
        </button>
      </div>
      <div class="timeline-wrap">
        <table class="timeline">
          <thead>
            <tr>
              <th scope="col">経過（分:秒）</th>
              <th scope="col">球</th>
              <th scope="col">番号</th>
              <th scope="col">リーチ</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {sample.events.map((e) => (
              <tr class={e.bingo ? 'hit' : ''}>
                <td>{fmtElapsed(e.startSec)}</td>
                <td>{e.draw}</td>
                <td>{ballLabel(e.ball)}</td>
                <td>{e.reach ? `${e.reach}人` : ''}</td>
                <td>
                  {e.bingo === 0
                    ? ''
                    : e.janken
                      ? `${e.bingo}人ビンゴ、ジャンケンで${e.awarded}人に景品`
                      : `${e.bingo}人ビンゴ`}
                </td>
              </tr>
            ))}
            <tr>
              <td>{fmtElapsed(sample.totalSec)}</td>
              <td />
              <td />
              <td />
              <td>終了</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  )
}

const App = () => {
  const [params, setParams] = useState<Params>(() => parseParams(new URLSearchParams(location.search)))
  const [seed, setSeed] = useState(20240101)
  const [sampleSeed, setSampleSeed] = useState(() => randomSeed())
  const [result, setResult] = useState<{ r: SimResult; p: Params } | null>(null)
  const [sample, setSample] = useState<SampleParty | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const running = useRef<RunHandle | null>(null)

  const error = validate(params)
  const set = (key: NumKey) => (v: number) => setParams((p) => ({ ...p, [key]: v }))

  // 入力が変わるたびに少し待ってから再計算（計算中なら打ち切る）
  useEffect(() => {
    const qs = toSearch(params).toString()
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname)
    if (error) return
    const timer = setTimeout(() => {
      running.current?.cancel()
      setBusy(true)
      setFailure(null)
      const handle = runParallel(params, TRIALS, seed, () => {})
      running.current = handle
      handle.done
        .then((r) => {
          if (running.current !== handle) return
          setResult({ r, p: params })
          setBusy(false)
        })
        .catch((e) => {
          if (running.current !== handle) return
          setFailure(String(e?.message ?? e))
          setBusy(false)
        })
    }, 250)
    return () => clearTimeout(timer)
  }, [params, seed])

  useEffect(() => {
    if (error) return
    const timer = setTimeout(() => {
      runSample(params, sampleSeed).then(setSample).catch(() => setSample(null))
    }, 250)
    return () => clearTimeout(timer)
  }, [params, sampleSeed])

  return (
    <div class="layout">
      <form class="inputs" onSubmit={(e: Event) => e.preventDefault()}>
        <Stepper id="players" label="参加人数" unit="人" value={params.players} onChange={set('players')} />
        <Stepper id="prizes" label="景品の数" unit="個" value={params.prizes} onChange={set('prizes')} />
        <Stepper
          id="drawSec"
          label="1回の抽選"
          note="回す・読み上げ・穴をあける"
          unit="秒"
          value={params.drawSec}
          onChange={set('drawSec')}
        />
        <Stepper
          id="winSec"
          label="1回の当選"
          note="「ビンゴ！」から景品を受け取って戻るまで"
          unit="秒"
          value={params.winSec}
          onChange={set('winSec')}
        />
      </form>

      <div class="outputs">
        {error ? (
          <p class="error" role="alert">
            {error}
          </p>
        ) : failure ? (
          <p class="error" role="alert">
            計算できませんでした（{failure}）
          </p>
        ) : result ? (
          <div class={busy ? 'stale' : ''}>
            <Headline r={result.r} p={result.p} />
            {sample && <Timeline sample={sample} onReroll={() => setSampleSeed(randomSeed())} />}
            <p class="fine footnote">
              {fmtNum(result.r.trials)}回ぶんのビンゴ大会をこの端末の中で試した結果です。
              <button type="button" class="text-btn" onClick={() => setSeed(randomSeed())}>
                もう一度試す
              </button>
            </p>
          </div>
        ) : (
          <p class="fine">計算しています…</p>
        )}
      </div>

      {result && !error && (
        <div class="mobile-bar" aria-hidden="true">
          <span>終了まで</span>
          <b>{fmtRange(result.r.total.lo, result.r.total.hi)}</b>
        </div>
      )}
    </div>
  )
}

const root = document.getElementById('app')
if (root) {
  root.textContent = ''
  render(<App />, root)
}
