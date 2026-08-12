// popup.js — 开关 + 引擎设置
const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  enabled: false,
  engine: 'google',
  deepseekKey: '',
  deepseekModel: 'deepseek-chat',
  deeplKey: '',
  translateUi: false,
};

function load() {
  chrome.storage.local.get(DEFAULTS, (cfg) => {
    $('toggle').checked = !!cfg.enabled;
    $('engine').value = cfg.engine;
    $('deepseekKey').value = cfg.deepseekKey || '';
    $('deeplKey').value = cfg.deeplKey || '';
    $('translateUi').checked = !!cfg.translateUi;
    syncBlocks();
  });
}

function syncBlocks() {
  const e = $('engine').value;
  $('deepseek-block').style.display = e === 'deepseek' ? 'block' : 'none';
  $('deepl-block').style.display = e === 'deepl' ? 'block' : 'none';
}

function save() {
  const cfg = {
    enabled: $('toggle').checked,
    engine: $('engine').value,
    deepseekKey: $('deepseekKey').value.trim(),
    deepseekModel: 'deepseek-chat',
    deeplKey: $('deeplKey').value.trim(),
    translateUi: $('translateUi').checked,
  };
  chrome.storage.local.set(cfg, () => {
    const st = $('status');
    st.textContent = '已保存 ✓';
    st.className = 'status ok';
    setTimeout(() => { st.textContent = ''; }, 1800);
  });
}

// 切换开关即时生效
$('toggle').addEventListener('change', () => {
  chrome.storage.local.set({ enabled: $('toggle').checked });
});
$('translateUi').addEventListener('change', () => {
  chrome.storage.local.set({ translateUi: $('translateUi').checked });
});

$('engine').addEventListener('change', syncBlocks);
$('save').addEventListener('click', save);

load();
