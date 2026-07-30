# VOICE TEXT LAB v1

長い文章を、指定した読み上げ時間に合わせて次の2種類へ整えるWebアプリです。

- 標準版：客観的で自然な、聞きやすい文章
- アサーティブ版：相手を尊重しながら、課題と行動を明確にする文章

## 初版の機能

- 元文章の直接入力
- 30秒・1分・2分・3分・5分
- 標準版とアサーティブ版の同時生成
- 生成結果の直接編集
- コピー
- 文字数と推定読み上げ時間の表示
- スマートフォン・タブレット対応

---

## フォルダー構成

```text
voice-text-lab-v1/
├─ index.html
├─ styles.css
├─ app.js
├─ config.js
├─ README.md
└─ worker/
   ├─ worker.js
   └─ wrangler.toml
```

---

## 1. Cloudflare Workerを公開

### Worker側のファイル

`worker` フォルダーの `worker.js` と `wrangler.toml` を使用します。

### シークレットの登録

Cloudflare Workersの設定画面で、次のシークレットを登録します。

```text
OPENAI_API_KEY
```

APIキーは `config.js` やGitHubへ絶対に書かないでください。

### 公開後

WorkerのURL例:

```text
https://voice-text-lab-api.xxxxx.workers.dev
```

---

## 2. フロント画面へWorker URLを設定

`config.js` を開いて、次の部分を書き換えます。

```javascript
window.APP_CONFIG = {
  API_URL: "https://voice-text-lab-api.xxxxx.workers.dev"
};
```

---

## 3. GitHub Pagesへ公開

`worker` フォルダー以外の次のファイルを、GitHubリポジトリのルートへ入れます。

```text
index.html
styles.css
app.js
config.js
```

GitHub Pagesを有効にすると、ブラウザーから利用できます。

---

## セキュリティ設定

初期状態では `wrangler.toml` の `ALLOWED_ORIGIN` が `*` です。
動作確認後、GitHub PagesのURLへ限定することを推奨します。

```toml
ALLOWED_ORIGIN = "https://your-name.github.io"
```

独自リポジトリのサブパスはOriginに含めません。

---

## 使用モデル

初期設定:

```toml
OPENAI_MODEL = "gpt-5.6-terra"
```

文章品質と費用のバランスを重視しています。
モデルを変更する場合は `wrangler.toml` の値を変更してください。

---

## 読み上げ時間の目安

日本語の読み上げ速度を、1分約300文字として計算しています。

| 選択時間 | 目標文字数 |
|---|---:|
| 30秒 | 約150文字 |
| 1分 | 約300文字 |
| 2分 | 約600文字 |
| 3分 | 約900文字 |
| 5分 | 約1,500文字 |

AI出力は内容を優先するため、目標から多少前後します。生成後の文字数と推定時間を画面で確認できます。
