// background.js — 负责调用翻译接口（Service Worker）
// 翻译任务从 content.js 通过 chrome.runtime.sendMessage 发到这里，
// 由这里统一发请求，避免页面 CORS 限制，也便于切换引擎。

const SEP = '\n[SEP]\n';

// ---- 各引擎实现 ----

async function engineGoogle(texts) {
  const joined = texts.map((t) => t).join(SEP);
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=' +
    encodeURIComponent(joined);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Google 接口返回 ' + res.status);
  const data = await res.json();
  // data[0] = 分段的译文数组，每段取 [0]
  const translated = (data[0] || []).map((s) => s[0]).join('');
  return splitResults(translated, texts.length);
}

async function engineDeepSeek(texts, apiKey, model) {
  const mapped = texts.map((t, i) => `[${i}] ${t}`).join('\n\n');
  const prompt =
    '把下面每条英文翻译成简体中文。规则：\n' +
    '1. 每条以 [序号] 开头，只输出翻译结果，序号和顺序必须保留；\n' +
    '2. 不翻译任何看起来是代码、变量名、函数名、URL、文件路径、GitHub 用户名(@xxx)或仓库名(name/repo)的内容；\n' +
    '3. 保留链接文字的含义，技术术语允许保留英文并用中文解释（如 README、Pull Request）。\n\n' +
    mapped;
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('DeepSeek 返回 ' + res.status + (t ? ' ' + t.slice(0, 200) : ''));
  }
  const data = await res.json();
  const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  const map = {};
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*\[(\d+)\]\s*(.*)$/);
    if (m) map[m[1]] = m[2].trim();
  });
  return texts.map((_, i) => map[i] || '');
}

async function engineDeepL(texts, apiKey) {
  const params = new URLSearchParams();
  params.set('auth_key', apiKey);
  params.set('target_lang', 'ZH');
  texts.forEach((t) => params.append('text', t));
  const res = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error('DeepL 返回 ' + res.status + (t ? ' ' + t.slice(0, 200) : ''));
  }
  const data = await res.json();
  return (data.translations || []).map((x) => x.text);
}

// ---- 结果按分隔符切回每一条 ----
function splitResults(translated, count) {
  const parts = translated.split(SEP);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(parts[i] !== undefined ? parts[i].trim() : '');
  }
  return out;
}

// ---- 消息入口 ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'translate') {
    handleTranslate(msg.texts)
      .then((translations) => sendResponse({ translations }))
      .catch((err) => sendResponse({ error: String(err && err.message ? err.message : err) }));
    return true; // 异步响应
  }
});

async function handleTranslate(texts) {
  const cfg = await chrome.storage.local.get({
    engine: 'google',
    deepseekKey: '',
    deepseekModel: 'deepseek-chat',
    deeplKey: '',
  });
  if (cfg.engine === 'deepseek') {
    if (!cfg.deepseekKey) throw new Error('请先在插件设置里填写 DeepSeek API Key');
    return engineDeepSeek(texts, cfg.deepseekKey, cfg.deepseekModel);
  }
  if (cfg.engine === 'deepl') {
    if (!cfg.deeplKey) throw new Error('请先在插件设置里填写 DeepL API Key');
    return engineDeepL(texts, cfg.deeplKey);
  }
  return engineGoogle(texts);
}
