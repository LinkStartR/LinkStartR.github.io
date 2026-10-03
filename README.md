# LinkStartR 的个人网站

线上地址：https://linkstartr.github.io/

以 [Brittany Chiang v4](https://github.com/bchiang7/v4) 的视觉和布局为基础，移植为 HTML、CSS 和 JavaScript 静态站点。保留深蓝背景、薄荷绿强调、编号导航和项目展示布局，以及原作者的设计署名和 MIT 许可。

## 修改主页

- `index.html`：个人介绍、项目、已发布网页和联系入口。
- `assets/styles.css`：布局、颜色变量、字体和响应式样式。
- `assets/main.js`：移动端导航行为。
- `assets/favicon.svg`：站点图标。

直接用浏览器打开 `index.html` 即可预览，不需要安装依赖或执行构建。需要通过本地服务器检查时，可在仓库目录运行 `python -m http.server 8000`，访问 http://localhost:8000/。

## 发布 Codex 生成的 HTML 或静态网站

1. 将每个网页及其资源放到独立目录，例如 `pages/my-report/index.html`。单文件 HTML 也可以放在 `pages/my-report.html`。
2. 在主页 `index.html` 的 `#pages` 区域添加这个网页的名称、简介和相对链接；首次添加时替换现有空状态。
3. 确认页面使用相对资源路径，不依赖本机路径或 localhost，再提交并推送到 `main`。
4. 等待 GitHub Pages 部署完成，并实际打开 https://linkstartr.github.io/pages/my-report/ 核验页面和资源。

GitHub Pages 已配置为从 `main` 分支根目录发布，`.nojekyll` 保证静态文件直接提供。无需另建发布流程。`pages/` 下的新网页保留自己的样式，不会覆盖主页。

以后可让 Codex：**“把这个 HTML 发布到个人站的 `pages/名称/`，更新主页入口，并验证远端链接。”**

这里托管的是静态网页；后续需要服务端功能时，再单独决定部署方式。

## 设计与字体来源

- 设计来源：[Brittany Chiang](https://brittanychiang.com/)，模板代码为 MIT 许可，见 `LICENSE`。
- 标题字体：Inter，随站点自托管。
- 英文正文字体：STIX Two Text，随站点自托管。
- 中文字体：霞鹜文楷屏幕阅读版，按需从 jsDelivr 加载；网络不可用时使用系统字体回退。
- 字体许可保存在 `assets/fonts/`。

当前未填入职业、学历、邮箱或其他社交账号；添加真实个人信息时直接修改主页。
