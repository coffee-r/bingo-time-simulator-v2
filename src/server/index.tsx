/**
 * Cloudflare Workers で動くサーバー（Hono）
 *
 * - ページの HTML を SSR する（計算はしない。重い処理はブラウザの Web Worker で行う）
 * - ビルド済みの JS / CSS / favicon は Workers の静的アセットとして配信される
 */
import { Hono } from 'hono'
import { NONCE, secureHeaders } from 'hono/secure-headers'
import { Layout } from './layout'
import { HomePage, PrivacyPage } from './pages'

type Env = { Bindings: { ASSETS: Fetcher }; Variables: { secureHeadersNonce?: string } }

const app = new Hono<Env>()

const GA_HOSTS = ['https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://*.googletagmanager.com']

app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", NONCE, 'https://www.googletagmanager.com'],
      workerSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', ...GA_HOSTS],
      connectSrc: ["'self'", ...GA_HOSTS],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
    referrerPolicy: 'strict-origin-when-cross-origin',
  }),
)

app.get('/', (c) =>
  c.html(
    <Layout url={new URL('/', c.req.url).href} nonce={c.get('secureHeadersNonce')} script>
      <HomePage />
    </Layout>,
  ),
)

app.get('/privacy', (c) =>
  c.html(
    <Layout title="プライバシーポリシー" url={new URL('/privacy', c.req.url).href} nonce={c.get('secureHeadersNonce')}>
      <PrivacyPage />
    </Layout>,
  ),
)

app.notFound((c) =>
  c.html(
    <Layout title="ページが見つかりません" url={c.req.url} nonce={c.get('secureHeadersNonce')}>
      <main>
        <h1>ページが見つかりません</h1>
        <p>
          <a href="/">トップへ戻る</a>
        </p>
      </main>
    </Layout>,
    404,
  ),
)

export default app
