import { raw } from 'hono/html'
import type { Child } from 'hono/jsx'

const GA_ID = 'G-7CVJJC12TW'
const SITE_TITLE = 'ビンゴ大会、何分かかる？'
const DESCRIPTION =
  'パーティーや宴会のビンゴ大会が何分かかるかを、参加人数・景品の数・抽選と当選にかける時間から見積もります。'

export const Layout = (props: { title?: string; url: string; nonce?: string; children: Child; script?: boolean }) => {
  const title = props.title ? `${props.title} | ${SITE_TITLE}` : SITE_TITLE
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="format-detection" content="telephone=no" />
        <title>{title}</title>
        <meta name="description" content={DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={props.url} />
        <meta name="twitter:card" content="summary" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="stylesheet" href="/style.css" />
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
        <script nonce={props.nonce}>
          {raw(
            `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`,
          )}
        </script>
        {props.script && <script type="module" src="/static/app.js" />}
      </head>
      <body>
        <div class="page">
          <header class="site-header">
            <h1>
              <a href="/">ビンゴ大会、何分かかる？</a>
            </h1>
            <p>人数と景品の数から、ビンゴ大会にかかる時間を見積もります。</p>
          </header>
          {props.children}
          <footer class="site-footer">
            <a href="/privacy">プライバシーポリシー</a>
            <a href="https://github.com/coffee-r/bingo-time-simulator-v2" target="_blank" rel="noopener">
              GitHub
            </a>
            <a href="https://twitter.com/plus_marumaru" target="_blank" rel="noopener">
              &copy; 2022 coffee-r
            </a>
          </footer>
        </div>
      </body>
    </html>
  )
}
