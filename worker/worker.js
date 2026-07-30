const DURATION_RULES = {
  30: { label: "30秒", min: 120, target: 150, max: 180 },
  60: { label: "1分", min: 260, target: 300, max: 340 },
  120: { label: "2分", min: 540, target: 600, max: 660 },
  180: { label: "3分", min: 820, target: 900, max: 980 },
  300: { label: "5分", min: 1380, target: 1500, max: 1620 }
};

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    standard: {
      type: "string",
      description: "客観的で自然な標準版ナレーション"
    },
    assertive: {
      type: "string",
      description: "相手を尊重しながら課題と行動を明確にしたアサーティブ版ナレーション"
    }
  },
  required: ["standard", "assertive"],
  additionalProperties: false
};

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get("Origin") || "";
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  const origin =
    allowedOrigin === "*" || requestOrigin === allowedOrigin
      ? (allowedOrigin === "*" ? "*" : requestOrigin)
      : allowedOrigin;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}

function extractOutputText(apiData) {
  if (typeof apiData.output_text === "string" && apiData.output_text.trim()) {
    return apiData.output_text;
  }

  for (const item of apiData.output || []) {
    if (item.type !== "message") continue;
    for (const content of item.content || []) {
      if (content.type === "refusal") {
        throw new Error(content.refusal || "この文章は処理できませんでした。");
      }
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("AIの生成結果を読み取れませんでした。");
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "POSTリクエストのみ受け付けます。" }, 405, headers);
    }

    if (!env.OPENAI_API_KEY) {
      return jsonResponse(
        { error: "OPENAI_API_KEYが設定されていません。" },
        500,
        headers
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "入力データの形式が正しくありません。" }, 400, headers);
    }

    const sourceText = String(body.sourceText || "").trim();
    const durationSeconds = Number(body.durationSeconds);
    const duration = DURATION_RULES[durationSeconds];

    if (!sourceText) {
      return jsonResponse({ error: "元の文章を入力してください。" }, 400, headers);
    }

    if (sourceText.length > 12000) {
      return jsonResponse(
        { error: "元の文章は12,000文字以内にしてください。" },
        400,
        headers
      );
    }

    if (!duration) {
      return jsonResponse({ error: "読み上げ時間の指定が正しくありません。" }, 400, headers);
    }

    const instructions = `
あなたは、日本語の文章整理とナレーション作成を専門とする編集者です。
入力文を分析資料へ作り替えるのではなく、元の意味・主張・事実関係を守りながら、
耳で聞いて理解しやすい完成原稿へ整えてください。

必須ルール:
- 入力文にない事実、数値、原因、評価、固有名詞を追加しない。
- 数値、割合、否定表現、条件、責任の所在を勝手に変えない。
- 重複、回りくどさ、書き言葉特有の硬さを整理する。
- 箇条書き、見出し、注釈、前置き、作業説明は出力しない。
- 「標準版」と「アサーティブ版」の2本を、どちらも単独で読める完成原稿にする。
- 文章量は日本語の文字数で指定範囲へ近づける。内容不足の場合は水増しせず、
  意味を保てる範囲で自然な補足表現を用いる。
- 読点を適切に使い、一文を長くしすぎない。
- 入力が業務・安全・教育に関する内容でも、過度に威圧的、断定的、説教調にしない。
- ただし、重要な注意点や必要な行動を曖昧にしない。

標準版:
- 客観的、自然、簡潔で聞きやすい。
- 結果や状況、注意点、今後の行動が自然につながる構成にする。
- 特定の人を責める表現は避ける。

アサーティブ版:
- 相手の事情や立場を尊重する。
- 事実と解釈を混同せず、課題を明確に伝える。
- 「誰かの意識不足」で終わらせず、必要に応じて管理側・組織側の具体的な行動も示す。
- 過度に柔らかくして重要点をぼかさず、攻撃的にもならない。
`.trim();

    const input = `
読み上げ時間: ${duration.label}
目標文字数: 約${duration.target}文字
許容範囲: ${duration.min}～${duration.max}文字

以下の元文章を、標準版とアサーティブ版へ整えてください。

--- 元文章 ---
${sourceText}
--- ここまで ---
`.trim();

    try {
      const apiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-5.6-terra",
          reasoning: { effort: "low" },
          instructions,
          input,
          max_output_tokens: durationSeconds >= 300 ? 5000 : 3000,
          text: {
            format: {
              type: "json_schema",
              name: "narration_versions",
              strict: true,
              schema: OUTPUT_SCHEMA
            }
          }
        })
      });

      const apiData = await apiResponse.json();

      if (!apiResponse.ok) {
        const detail = apiData?.error?.message || "OpenAI APIでエラーが発生しました。";
        console.error("OpenAI API error:", detail);
        return jsonResponse(
          { error: "AI生成に失敗しました。API設定または利用状況を確認してください。" },
          502,
          headers
        );
      }

      const rawText = extractOutputText(apiData);
      const result = JSON.parse(rawText);

      return jsonResponse(
        {
          standard: result.standard,
          assertive: result.assertive,
          durationSeconds,
          model: env.OPENAI_MODEL || "gpt-5.6-terra"
        },
        200,
        headers
      );
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse(
        { error: "生成処理中にエラーが発生しました。もう一度お試しください。" },
        500,
        headers
      );
    }
  }
};
