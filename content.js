// content.js — 在 GitHub 页面上扫描英文文本并翻译成中文
// 核心原则：
//   * 只翻译正文/标题/评论等英文叙述，绝不翻译代码块
//   * 跳过 <code>/<pre>、代码高亮容器、变量名、URL、用户名
//   * 监听动态内容（GitHub 是 SPA，滚动/切页会不断插入新节点）

(() => {
  if (window.__githubZhTransInjected) return;
  window.__githubZhTransInjected = true;

  // 永远不翻译的元素选择器
  const SKIP =
    'code, pre, script, style, textarea, input, select, option, noscript, ' +
    '.highlight, .blob-code, .blob-wrapper, .CodeMirror, .hljs, .cm-line, ' +
    '[aria-hidden="true"], .clipboard-copy, .reaction-summary, .label, ' +
    '.sha, .commit-sha, .commit-oid, .octicon, svg, math, kbd, samp';

  let enabled = false;
  let translateUi = false; // 是否翻译顶部导航等界面文案
  let busy = false;
  let scanTimer = null;

  // ---------- 判定 ----------

  function isSkipElement(el) {
    if (!el) return true;
    if (el.closest(SKIP)) return true;
    // 不翻译界面外壳（默认）
    if (!translateUi && el.closest('header, footer, nav, [role="navigation"], .Header, .footer, .js-header-wrapper')) {
      return true;
    }
    // 不翻译纯链接形式的用户名/仓库引用（<a href="/user" 或 /user/repo>），保留原样
    const anchor = el.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href') || '';
      // 短链接文案（通常是用户名或标签）不翻译
      if (el.textContent && el.textContent.trim().length < 3) return true;
      // URL/文件路径链接不翻译其 href，但文字可翻——这里保守：路径型链接跳过
      if (/\.(com|org|io|dev|net|html|md|txt|py|js|go|ts|rs|java|c|h|cpp|json|yaml|yml|xml)$/i.test(href)) {
        return true;
      }
    }
    return false;
  }

  function countCJK(t) {
    const m = t.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]/g);
    return m ? m.length : 0;
  }

  function isEnglish(t) {
    t = t.trim();
    if (t.length < 3) return false;
    if (countCJK(t) > 0) return false; // 已经含中文，跳过
    const letters = t.match(/[a-zA-Z]/g);
    if (!letters || letters.length < 3) return false;
    // 过滤掉"看起来是纯符号/纯数字/纯路径"的
    if (!/[a-zA-Z]{2}/.test(t)) return false;
    // 过滤只含一个词的常见词，避免误翻用户名
    if (!/\s/.test(t) && letters.length <= 5) return false;
    return true;
  }

  // ---------- 收集待翻译文本节点 ----------

  function collectTextNodes(root) {
    const results = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.nodeValue;
      if (!text || !text.trim()) continue;
      if (!isEnglish(text)) continue;
      const el = node.parentElement;
      if (isSkipElement(el)) continue;
      if (el.dataset.ghz) continue; // 已处理过的容器
      results.push(node);
    }
    return results;
  }

  // ---------- 翻译流程 ----------

  function normalize(t) {
    return t.replace(/\s*\n\s*/g, ' ').trim();
  }

  async function translateNodes(nodes) {
    const BATCH = 12; // 每批 12 条，避免请求过大
    for (let i = 0; i < nodes.length; i += BATCH) {
      const batch = nodes.slice(i, i + BATCH);
      const texts = batch.map((n) => normalize(n.nodeValue));
      let resp;
      try {
        resp = await chrome.runtime.sendMessage({ type: 'translate', texts });
      } catch (e) {
        console.warn('[GitHubZh] 后台无响应：', e);
        return;
      }
      if (!resp) return;
      if (resp.error) {
        console.warn('[GitHubZh] 翻译失败：', resp.error);
        // 一次性错误（如没配 Key / 网络）就停止本轮，避免疯狂重试
        return;
      }
      batch.forEach((n, idx) => {
        const t = resp.translations && resp.translations[idx];
        if (t && n.parentElement) {
          n.nodeValue = t;
          n.parentElement.dataset.ghz = '1';
        }
      });
      // 轻微节流
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  async function scan() {
    if (busy || !enabled) return;
    if (!document.body) return;
    busy = true;
    try {
      const nodes = collectTextNodes(document.body);
      if (nodes.length) await translateNodes(nodes);
    } finally {
      busy = false;
    }
  }

  function scheduleScan() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 250);
  }

  // ---------- 动态监听 ----------

  const observer = new MutationObserver((muts) => {
    if (!enabled) return;
    for (const m of muts) {
      if (m.type === 'childList' && m.addedNodes.length) {
        scheduleScan();
        return;
      }
    }
  });

  // ---------- 启动 ----------

  function startObserving() {
    if (document.body && !observer.__started) {
      observer.observe(document.body, { childList: true, subtree: true });
      observer.__started = true;
    }
  }

  chrome.storage.local.get({ enabled: false, translateUi: false }, (r) => {
    enabled = !!r.enabled;
    translateUi = !!r.translateUi;
    if (enabled) {
      startObserving();
      scheduleScan();
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled !== undefined) {
      enabled = !!changes.enabled.newValue;
      if (enabled) {
        startObserving();
        scheduleScan();
      }
    }
    if (changes.translateUi !== undefined) {
      translateUi = !!changes.translateUi.newValue;
      if (enabled) scheduleScan();
    }
  });

  // GitHub 是 SPA，页面内容整体替换时也要能感知（借助 history 变化重新扫描）
  if (document.body) startObserving();
})();
