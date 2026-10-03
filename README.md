# LinkStartR 的个人网站

线上地址：https://linkstartr.github.io/

以 [Brittany Chiang v4](https://github.com/bchiang7/v4) 为起点，移植为 HTML、CSS 和 JavaScript 静态站点。保留深蓝背景、薄荷绿强调与编号导航，加入中文首屏、原创 L 字形轨道线稿和个人创作索引布局；保留原作者的设计署名和 MIT 许可。

## 修改页面

- `index.html`：主页索引和动态 L 轨道图。
- `about/index.html`：关于这个空间。
- `projects/index.html`：项目内容。
- `pages/index.html`：已发布独立网页的目录。
- `contact/index.html`：联系入口。
- `assets/styles.css`：布局、颜色变量、字体和响应式样式。
- `assets/main.js`：悬停、点击与键盘侧边导航，以及动画暂停行为。
- `assets/favicon.svg`：站点图标。

直接用浏览器打开 `index.html` 即可预览，不需要安装依赖或执行构建。需要通过本地服务器检查时，可在仓库目录运行 `python -m http.server 8000`，访问 http://localhost:8000/。

各页左上角保留名字与动态图标。鼠标悬停图标打开浮动导航，移开后收起；也可以点击图标、用 Enter 或方向下键打开，再用 Esc、关闭按钮或点击页面空白处关闭。名字链接返回首页。首页图形下方和各页导航菜单中均可暂停或继续图标动画；系统启用“减少动态效果”时自动停止动画。

## 发布 Codex 生成的 HTML 或静态网站

1. 将每个网页及其资源放到独立目录，例如 `pages/my-report/index.html`。单文件 HTML 也可以放在 `pages/my-report.html`。
2. 在 `pages/index.html` 添加这个网页的名称、简介和相对链接；首次添加时替换现有空状态。主页保留目录入口。
3. 新子页面沿用现有页面的静态页头，保留名字、图标与站点菜单。根据目录层级调整相对链接，例如 `pages/my-report/index.html` 使用 `../../assets/styles.css` 和 `../../assets/main.js`。
4. 确认页面使用相对资源路径，不依赖本机路径或 localhost，再提交并推送到 `main`。
5. 等待 GitHub Pages 部署完成，并实际打开 https://linkstartr.github.io/pages/my-report/ 核验页面和资源。

GitHub Pages 已配置为从 `main` 分支根目录发布，`.nojekyll` 保证静态文件直接提供。无需另建发布流程。`pages/` 下的新网页保留自己的样式，不会覆盖主页。

以后可让 Codex：**“把这个 HTML 发布到个人站的 `pages/名称/`，保留站点导航、更新网页目录，并验证远端链接。”**

这里托管的是静态网页；后续需要服务端功能时，再单独决定部署方式。

## 设计与字体来源

- 设计来源：[Brittany Chiang](https://brittanychiang.com/)，模板代码为 MIT 许可，见 `LICENSE`。
- 标题字体：Inter，随站点自托管。
- 英文正文字体：STIX Two Text，随站点自托管。
- 中文字体：霞鹜文楷屏幕阅读版，按需从 jsDelivr 加载；网络不可用时使用系统字体回退。
- 字体许可保存在 `assets/fonts/`。

当前未填入职业、学历、邮箱或其他社交账号；添加真实个人信息时直接修改主页。
