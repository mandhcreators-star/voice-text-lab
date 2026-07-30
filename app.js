(() => {
  "use strict";

  const sourceText = document.getElementById("sourceText");
  const inputCount = document.getElementById("inputCount");
  const clearButton = document.getElementById("clearButton");
  const sampleButton = document.getElementById("sampleButton");
  const durationButtons = [...document.querySelectorAll(".duration-button")];
  const generateButton = document.getElementById("generateButton");
  const statusMessage = document.getElementById("statusMessage");
  const resultsSection = document.getElementById("resultsSection");
  const selectedDurationBadge = document.getElementById("selectedDurationBadge");
  const standardOutput = document.getElementById("standardOutput");
  const assertiveOutput = document.getElementById("assertiveOutput");
  const standardCount = document.getElementById("standardCount");
  const assertiveCount = document.getElementById("assertiveCount");
  const standardTime = document.getElementById("standardTime");
  const assertiveTime = document.getElementById("assertiveTime");

  let selectedSeconds = 60;

  const durationLabels = {
    30: "30秒",
    60: "1分",
    120: "2分",
    180: "3分",
    300: "5分"
  };

  const sampleText =
    "回答者の約87％が毎日朝食を食べ、約3％がほとんど食べると回答しており、多くの人に朝食を取る習慣が定着しています。一方で、10％は朝食を食べていません。朝食を取らない理由はさまざまであり、本人を責めるのではなく、その日の体調リスクとして現場側が把握することが必要です。朝食を取っていない場合は、通常より早めに最初の休憩を設定し、小まめな水分補給や周囲からの声かけを行うなど、管理側で補うことが重要です。熱中症対策は具合が悪くなってから始めるものではなく、食事や睡眠、水分摂取を含め、作業開始前から始まっています。";

  function formatNumber(value) {
    return new Intl.NumberFormat("ja-JP").format(value);
  }

  function updateInputCount() {
    inputCount.textContent = `${formatNumber(sourceText.value.length)}文字`;
  }

  function estimateSeconds(text) {
    // 日本語ナレーションの目安：1分約300文字
    return Math.max(0, Math.round((text.trim().length / 300) * 60));
  }

  function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return remainder ? `${minutes}分${remainder}秒` : `${minutes}分`;
  }

  function updateOutputMeta() {
    const standardLength = standardOutput.value.trim().length;
    const assertiveLength = assertiveOutput.value.trim().length;

    standardCount.textContent = `${formatNumber(standardLength)}文字`;
    assertiveCount.textContent = `${formatNumber(assertiveLength)}文字`;
    standardTime.textContent = `推定 ${formatDuration(estimateSeconds(standardOutput.value))}`;
    assertiveTime.textContent = `推定 ${formatDuration(estimateSeconds(assertiveOutput.value))}`;
  }

  function setLoading(isLoading) {
    generateButton.disabled = isLoading;
    generateButton.classList.toggle("loading", isLoading);
  }

  function setStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
  }

  durationButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedSeconds = Number(button.dataset.seconds);
      durationButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("selected", selected);
        item.setAttribute("aria-checked", String(selected));
      });
    });
  });

  sourceText.addEventListener("input", updateInputCount);
  standardOutput.addEventListener("input", updateOutputMeta);
  assertiveOutput.addEventListener("input", updateOutputMeta);

  clearButton.addEventListener("click", () => {
    sourceText.value = "";
    standardOutput.value = "";
    assertiveOutput.value = "";
    resultsSection.classList.add("hidden");
    setStatus("");
    updateInputCount();
    updateOutputMeta();
    sourceText.focus();
  });

  sampleButton.addEventListener("click", () => {
    sourceText.value = sampleText;
    updateInputCount();
    setStatus("サンプル文章を入力しました。");
    sourceText.focus();
  });

  document.querySelectorAll(".copy-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.getElementById(button.dataset.copyTarget);
      if (!target.value.trim()) return;

      try {
        await navigator.clipboard.writeText(target.value);
      } catch {
        target.select();
        document.execCommand("copy");
      }

      const original = button.textContent;
      button.textContent = "コピー済み";
      button.classList.add("copied");
      setTimeout(() => {
        button.textContent = original;
        button.classList.remove("copied");
      }, 1400);
    });
  });

  generateButton.addEventListener("click", async () => {
    const text = sourceText.value.trim();
    if (!text) {
      setStatus("元の文章を入力してください。", true);
      sourceText.focus();
      return;
    }

    const apiUrl = window.APP_CONFIG?.API_URL;
    if (!apiUrl || apiUrl.includes("YOUR_CLOUDFLARE_WORKER_URL")) {
      setStatus("config.jsにCloudflare WorkerのURLを設定してください。", true);
      return;
    }

    setLoading(true);
    setStatus("標準版とアサーティブ版を整えています…");

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceText: text,
          durationSeconds: selectedSeconds
        })
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("サーバーから正しい形式の応答を受け取れませんでした。");
      }

      if (!response.ok) {
        throw new Error(data?.error || "生成に失敗しました。");
      }

      if (!data.standard || !data.assertive) {
        throw new Error("生成結果が不足しています。もう一度お試しください。");
      }

      standardOutput.value = data.standard.trim();
      assertiveOutput.value = data.assertive.trim();
      selectedDurationBadge.textContent = durationLabels[selectedSeconds];
      resultsSection.classList.remove("hidden");
      updateOutputMeta();
      setStatus("生成が完了しました。文章はそのまま編集できます。");
      resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error(error);
      setStatus(error.message || "通信エラーが発生しました。", true);
    } finally {
      setLoading(false);
    }
  });

  updateInputCount();
  updateOutputMeta();
})();
