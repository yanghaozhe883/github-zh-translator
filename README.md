# GitHub 中文翻译 (GitHub Zh Translator)

一款浏览器扩展，把 GitHub 页面上的英文正文自动翻译成简体中文。**只翻译正文和叙述，不翻译代码、变量名、URL、用户名**，翻完不留痕迹，打开即用。

## ✨ 功能

- 🔤 **自动翻译**：打开任意 GitHub 页面，正文/标题/评论自动中文化
- 🚫 **聪明跳过**：代码块、内联代码、文件路径、URL、用户名、commit SHA 一律不动
- 📜 **动态监听**：GitHub 是单页应用，滚动/切换页面新加载的内容也能自动翻
- ⚙️ **多引擎可选**：Google 翻译（免费）/ DeepSeek（质量高）/ DeepL
- 🔄 **开合自如**：工具栏一键开关，随时还原英文原文

## 🛠 安装（开发者模式加载）

1. 下载本仓库并解压（或 `git clone`）
2. 打开 Chrome 的 `chrome://extensions`
3. 右上角开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择本仓库文件夹
5. 打开任意 GitHub 页面，点工具栏图标开启翻译即可

## ⚙️ 翻译引擎

| 引擎 | 需要 Key? | 说明 |
|------|----------|------|
| Google | 否 | 默认，免费，无需配置 |
| DeepSeek | 是 | 质量最好，从 [platform.deepseek.com](https://platform.deepseek.com) 获取 |
| DeepL | 是 | 从 [deepl.com](https://www.deepl.com) 获取 |

点插件图标 → 选择引擎 → 填写对应 API Key → 保存设置。

## 🧩 项目结构

```
manifest.json     扩展清单（权限、脚本声明）
content.js        页面扫描 + 中文注入逻辑
background.js     后台 Service Worker，负责调用翻译接口
popup.html / .js  插件弹窗（开关 + 引擎设置）
```

## 📄 许可证

[MIT](LICENSE) © 2026
