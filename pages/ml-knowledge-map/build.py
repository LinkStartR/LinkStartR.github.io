"""Render the editable teaching content into portable, server-free HTML pages."""
from pathlib import Path
import json
import html
import re

ROOT = Path(__file__).resolve().parent
NAMES = ["梯度与优化", "网络与反向传播", "训练动力学", "架构", "概率生成", "序列决策"]
SHORT = ["梯度", "网络", "训练", "架构", "生成", "决策"]
ANSWERS = ["朝梯度反方向走一步", "责任沿计算链相乘", "修优化 · 修数值 · 修泛化", "把对数据的假设写进结构", "把创造拆成已知量的预测", "试错，并处理分布漂移"]
GAPS = ["那么多参数，梯度怎么算？", "链条太长会断，太深会退化。", "参数到底该按什么结构连接？", "学会判断之后，怎样创造？", "只做一次性任务，怎样连续决策？", "决策的训练又回到梯度与反向传播。"]

def esc(value):
    return html.escape(str(value), quote=True)

def body(value):
    # Content is authored locally; explicit educational markup is preserved.
    value = str(value)
    return value if re.search(r"<(?:a|p|ul|ol|li|span|strong|math|div|br|table)\b", value) else esc(value)

def header():
    source = (ROOT.parent / "index.html").read_text(encoding="utf-8")
    return re.search(r'<header class="site-header">.*?</header>', source, re.S)[0].replace('href="../', 'href="../../')

def mini(current):
    items = [('index.html', '总地图', '00', 'home')]
    items += [(f'layer-{i}.html', SHORT[i-1], f'{i:02}', str(i)) for i in range(1,7)]
    items += [('connections.html', '横向专题', '↔', 'connections')]
    return '<div class="mini-bar"><nav class="mini-map" aria-label="六层知识迷你地图">' + ''.join(
        f'<a href="{url}" class="{"map-home" if key == "home" else ""}" {"aria-current=\"page\"" if current == key else ""} aria-label="{num} {name}"><small>{num}</small><span class="mini-name">{name}</span></a>'
        for url, name, num, key in items) + '</nav></div>'

def sidebar(current, filename):
    out = '<aside class="docs-sidebar" id="docs-sidebar" aria-label="学习指南目录"><div class="docs-sidebar-heading">学习指南<span>从梯度到决策</span></div><nav aria-label="文档目录">'
    out += f'<a class="doc-page" href="index.html" {"aria-current=\"page\"" if current=="home" else ""}>知识总地图</a>'
    out += '<p class="doc-section-label">六层主线</p>'
    for n in range(1,7):
        data = json.loads((ROOT/'content'/f'layer-{n}.json').read_text(encoding='utf-8-sig'))
        is_current = str(n)==current
        out += f'<details class="doc-folder" {"open" if is_current else ""}><summary><span class="doc-number">{n:02}</span>{esc(NAMES[n-1])}</summary><div class="doc-children">'
        out += f'<a class="doc-page" href="layer-{n}.html" {"aria-current=\"page\"" if filename==f"layer-{n}.html" else ""}>讲解 · 从这里开始</a>'
        for i,group in enumerate(data['groups']):
            out += f'<details class="doc-group" {"open" if is_current and i==0 and filename==f"layer-{n}.html" else ""}><summary>{esc(group["title"])}</summary>'
            for card in group['cards']:
                marker = f'data-card="{esc(card["id"])}"' if filename==f'layer-{n}.html' else ''
                out += f'<a class="doc-concept" href="layer-{n}.html#{esc(card["id"])}" {marker}>{esc(card["title"])}</a>'
            out += '</details>'
        out += f'<a class="doc-page" href="layer-{n}.html#terms">术语表与自查</a>'
        out += f'<a class="doc-page doc-calculation" href="calculations-{n}.html" {"aria-current=\"page\"" if filename==f"calculations-{n}.html" else ""}>计算 · 单独练习</a>'
        if filename==f'calculations-{n}.html':
            for c in data['calculations']:
                out += f'<a class="doc-concept" href="#{esc(c["id"])}">{esc(c["title"])}</a>'
        out += '</div></details>'
    cross = json.loads((ROOT/'content'/'connections.json').read_text(encoding='utf-8-sig'))
    out += f'<p class="doc-section-label">横向查阅</p><details class="doc-folder" {"open" if current=="connections" else ""}><summary>贯穿线索与易混概念</summary><div class="doc-children"><a class="doc-page" href="connections.html" {"aria-current=\"page\"" if current=="connections" else ""}>横向专题总览</a>'
    for t in cross['threads']:
        marker = f'data-card="{esc(t["id"])}"' if current=='connections' else ''
        out += f'<a class="doc-concept" href="connections.html#{esc(t["id"])}" {marker}>{esc(t["title"])}</a>'
    out += '<a class="doc-page" href="connections.html#confusions">十二组易混概念</a></div></details></nav><p class="reading-status" aria-live="polite">展开目录，按需查阅</p></aside>'
    return out

def page(filename, title, current, content):
    text = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#0a192f"><meta name="description" content="从零开始，以定义、画面和因果地图理解机器学习。">
<title>{esc(title)} · 从梯度到决策 · LinkStartR</title>
<link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://cdn.jsdelivr.net"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-screen-webfont@1.7.0/lxgwwenkaigbscreen.css">
<link rel="stylesheet" href="../../assets/styles.css"><link rel="stylesheet" href="guide.css?v=2">
<script src="../../assets/main.js" defer></script><script src="guide.js?v=2" defer></script></head>
<body><a class="skip-link" href="#main">跳到主要内容</a>{header()}<button class="docs-toggle" type="button" aria-controls="docs-sidebar" aria-expanded="false">目录</button>{mini(current)}{sidebar(current,filename)}<button class="docs-backdrop" type="button" aria-label="关闭学习目录" tabindex="-1"></button>
<main class="guide-main" id="main"><p class="disclaimer">本页讲通用教科书知识，不涉及具体论文出处。</p>{content}
<footer class="guide-footer"><a href="index.html">从梯度到决策 · 总地图</a><a href="../../pages/index.html">返回个人网站的网页目录 ↗</a></footer></main></body></html>'''
    (ROOT / filename).write_text(text, encoding="utf-8")

def table(headers, rows):
    return '<div class="table-wrap"><table><thead><tr>' + ''.join(f'<th scope="col">{body(h)}</th>' for h in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{body(c)}</td>' for c in row) + '</tr>' for row in rows) + '</tbody></table></div>'

def comparison(comp):
    heads, rows = comp['headers'], comp['rows']
    blocks = []
    for row in rows:
        blocks.append('<div class="parallel-card">' + sketch(str(row[0])) + '<h3>' + body(row[0]) + '</h3><dl>' + ''.join(f'<dt>{body(label)}</dt><dd>{body(value)}</dd>' for label,value in zip(heads[1:], row[1:])) + '</dl></div>')
    return f'<section class="compare-section"><h2>{esc(comp["title"])}</h2><div class="parallel-cards">{"".join(blocks)}</div></section>'

def sketch(label):
    if '全连接' in label:
        shape = ''.join(f'<path d="M25 {y} L155 {z}"/>' for y in [18,50,82] for z in [25,75])
        shape += ''.join(f'<circle cx="25" cy="{y}" r="5"/>' for y in [18,50,82]) + '<circle cx="155" cy="25" r="5"/><circle cx="155" cy="75" r="5"/>'
    elif '卷积' in label:
        shape = '<rect x="10" y="30" width="38" height="38"/><rect x="71" y="30" width="38" height="38"/><rect x="132" y="30" width="38" height="38"/><path d="M10 17h160M42 11l7 6-7 6M103 11l7 6-7 6"/>'
        shape += ''.join(f'<path d="M{x+8} 39h22M{x+8} 49h22M{x+8} 59h22"/>' for x in [10,71,132])
    elif '池化' in label:
        shape = '<rect x="10" y="20" width="60" height="60"/><path d="M40 20v60M10 50h60M82 50h35M108 42l10 8-10 8"/><rect x="132" y="35" width="30" height="30"/>'
    elif '扩散' in label:
        shape = '<path d="M10 80 C35 70 15 25 50 55 S85 25 110 37 S140 17 168 15"/><circle cx="10" cy="80" r="5"/><circle cx="168" cy="15" r="5"/><path d="M48 54l5-8M108 38l6-8M149 21l5-8"/>'
    elif '流匹配' in label:
        shape = '<path d="M10 80L168 15M45 66l8-10M80 51l8-10M115 36l8-10"/><circle cx="10" cy="80" r="5"/><circle cx="168" cy="15" r="5"/>'
    else:
        return ''
    return f'<svg class="mechanism-sketch" viewBox="0 0 180 100" aria-hidden="true">{shape}</svg>'

def picture(card):
    visual = card.get('visual')
    # Every card has a concrete, framed picture; optional arrows add a diagram.
    flow = ''
    if isinstance(visual, list):
        flow = '<div class="picture-flow" aria-label="机制示意">' + '<b aria-hidden="true">→</b>'.join(f'<span>{body(v)}</span>' for v in visual) + '</div>'
    elif visual:
        flow = body(visual)
    analogy = re.sub(r'^画面\s*/\s*类比\s*[:：]\s*','',card['analogy'])
    return '<div class="picture-frame"><span class="picture-caption">想象这幅画面</span>' + flow + '<p>' + body(analogy) + '</p></div>'

def card_html(card, calc_url=None, refs=''):
    need = re.sub(r'^为什么需要它\s*[:：]\s*','',card['need'])
    boundary = re.sub(r'^它不解决什么\s*[:：]\s*','',card['boundary'])
    return f'''<article class="concept-card" id="{esc(card['id'])}"><header><h3>{esc(card['title'])}</h3><span lang="en">{esc(card['en'])}</span></header>
<section class="concept-part"><h4>① 定义</h4><p>{body(card['definition'])}</p></section>
<section class="concept-part"><h4>② 为什么需要它</h4><p>{body(need)}</p>{'<div class="detail">'+body(card['detail'])+'</div>' if card.get('detail') else ''}{refs}</section>
<section class="concept-part"><h4>③ 画面 / 类比</h4>{picture(card)}</section>
<section class="concept-part"><h4>④ 它不解决什么</h4><p>{body(boundary)}</p></section>
<details class="minimal-example"><summary>一个最小例子 · 点击展开</summary><div class="example-body">{body(card['example'])}</div></details>
{f'<a class="calculation-link" href="{calc_url}">去单独的计算页，慢慢算 →</a>' if calc_url else ''}</article>'''

def home():
    nodes = ''.join(f'<a class="map-node" href="layer-{i}.html"><span class="node-number">LEVEL {i:02} / 06</span><h3>{NAMES[i-1]}</h3><p class="node-answer">{ANSWERS[i-1]}</p><p class="node-gap">留下的缺口<br>{GAPS[i-1]}</p></a>' for i in range(1,7))
    content = f'''<section class="overview-intro"><div><p class="guide-label">一份给零基础成年读者的学习地图</p><h1 class="guide-title">从梯度到决策<br><em>机器学习的六层知识地图</em></h1></div><div>
<p class="guide-lead">先弄懂一步为什么这样走，再看懂机器怎样做决定。每一层接住上一层留下的问题，你随时都能知道自己在哪里。</p>
<div class="guide-actions"><a class="guide-button" href="layer-1.html">从第 1 层开始 →</a><a class="guide-button secondary" href="connections.html">七条贯穿线索 ↔</a></div></div></section>
<div class="map-heading"><h2>沿着问题，往下一层走</h2><span>六个关卡 · 点击进入 · 按箭头读</span></div><nav class="causal-map" aria-label="知识因果主线">{nodes}</nav>
<p class="return-path">06 → 01 / 02　无论是生成还是决策，训练仍要回到梯度与反向传播。</p>
<section class="feature-row"><div><h3>先定义，再解释</h3><p>先把一个词说清楚，再问为什么需要它。每张卡片都交代具体边界。</p></div><div><h3>先看画面，再碰数字</h3><p>类比就在眼前。每张卡片只有一个小例子，默认收起；长计算有单独的页面。</p></div><div><h3>沿主线读，也能回头查</h3><p>顶栏保留迷你地图，层内目录定位概念。页尾的自查题帮你判断是否真的懂了。</p></div></section>
<section class="compare-section"><h2>同一个意思，怎么讲才看得懂？</h2><div class="teaching-pair"><div class="bad"><h3>❌ 这样讲读者会懵</h3><p>“Adam 利用一阶矩和二阶矩，经偏差修正后自适应缩放。”<br>一口气塞进四个陌生词，你不知道它们各自补哪个洞。</p></div><div class="good"><h3>✅ 这样讲就懂了</h3><p>“先记住最近几步想往哪走，再记住每条路有多陡。”<br>到了第 3 层，我们逐个定义这些记忆，让你看清 Adam 为什么这样安排。</p></div></div></section>
<section class="compare-section"><h2>读到“层”时，想象你在换一种说法</h2><p>第 2 层会正式定义网络的层。先看一个直观画面，同一张猫的图片，可以逐步被描述为不同的信息。</p><div class="staircase"><div>▦ 像素<span>一格格亮暗</span></div><div>╱ 边缘<span>亮暗的交界</span></div><div>△ 部件<span>耳朵、眼睛</span></div><div>♧ 猫脸<span>组合后的形状</span></div></div><p>这是理解方式的示意，不意味着每个真实网络都会自动按这些名字分工。</p></section>'''
    page('index.html','知识总地图','home',content)

def layer(data):
    n = data['number']
    calcs = data.get('calculations', [])
    previous = f'<div class="gap-panel"><h2>上一层的缺口</h2><p>{body(data["previousGap"])}</p></div>'
    main = ''
    for group in data['groups']:
        main += f'<h2 class="group-title">{esc(group["title"])}</h2>'
        for card in group['cards']:
            linked = next((c for c in calcs if c['id'] == card.get('calculation',card['id'])), None)
            main += card_html(card, f'calculations-{n}.html#{linked["id"]}' if linked else None)
    for comp in data.get('comparisons', []):
        main += comparison(comp)
    main += '<section class="closing" id="terms"><h2>术语中英对照</h2>' + table(['中文','English'], data['terms'])
    main += '<h2>先问自己，再展开答案</h2><div class="questions">' + ''.join(f'<details><summary>{i}. {esc(q["q"])}</summary><p>{body(q["a"])}</p></details>' for i,q in enumerate(data['questions'],1)) + '</div>'
    main += f'<p class="one-sentence"><span>一句话总结这一层</span>{body(data["summary"])}</p></section>'
    next_num = n+1 if n < 6 else 1
    main += f'<div class="gap-panel next-gap"><h2>这一层留下的缺口</h2><p>{body(data["gap"])}</p></div><nav class="page-navigation" aria-label="层间导航"><a class="guide-button secondary" href="{f"layer-{n-1}.html" if n>1 else "index.html"}">← {"上一层" if n>1 else "总地图"}</a><a class="guide-button" href="layer-{next_num}.html">{f"进入第 {next_num} 层" if n<6 else "回到第 1 层，看清训练如何绕回来"} →</a></nav>'
    title = f'第 {n} 层 · {data["title"]}'
    content = f'<p class="guide-label">LEVEL {n:02} / 06 · {esc(ANSWERS[n-1])}</p><h1 class="guide-title">{esc(title)}</h1><p class="guide-lead">{body(data["subtitle"])}</p>{previous}<div class="reading-content">{main}</div>'
    page(f'layer-{n}.html',title,str(n),content)
    calculations(data)

def calculations(data):
    n = data['number']
    sections = []
    for c in data.get('calculations',[]):
        symbols = table(['符号','它在这里的意思'],c['symbols']) if c.get('symbols') else ''
        back = f'layer-{n}.html' + (f'#{c["cardId"]}' if c.get('cardId') else '')
        sections.append(f'<section class="calculation" id="{esc(c["id"])}"><h2>{esc(c["title"])}</h2><p>{body(c["intro"])}</p>{symbols}<ol>' + ''.join(f'<li>{body(step)}</li>' for step in c['steps']) + f'</ol><p class="takeaway">你要带走的逻辑：{body(c["takeaway"])}</p><a class="calculation-link" href="{back}">回到第 {n} 层的讲解 →</a></section>')
    toc = '<div class="cross-reference">' + ''.join(f'<a href="#{esc(c["id"])}">{esc(c["title"])}</a>' for c in data.get('calculations',[])) + '</div>'
    content = f'<p class="guide-label">第 {n} 层的计算副页 · 可跳过</p><h1 class="guide-title">慢一点，把数字看清</h1><p class="guide-lead">主页面负责解释“为什么”，这里把少量数字按先后拆开。每一步都说清意义，算完后再回到地图。</p><a class="guide-button secondary" href="layer-{n}.html">← 回到 {esc(data["title"])}</a>{toc}' + ''.join(sections)
    page(f'calculations-{n}.html',f'第 {n} 层计算副页',str(n),content)

def connections(data):
    content = '<p class="guide-label">横向专题 · 七条贯穿线索 + 十二组易混概念</p><h1 class="guide-title">原来，你又遇见了同一招</h1><p class="guide-lead">六层是向下走的路，七条线索是横着看的桥。建议先读主线，再来找不同方法之间的共同逻辑。</p>'
    content += '<div class="cross-reference">' + ''.join(f'<a href="#{t["id"]}">{esc(t["title"])}</a>' for t in data['threads']) + '<a href="#confusions">易混概念清单 ↓</a></div>'
    for t in data['threads']:
        refs = '<div class="cross-reference">' + ''.join(f'<a href="layer-{n}.html">第 {n} 层 · {esc(label)} ↗</a>' for n,label in t['refs']) + '</div>'
        content += card_html(t,refs=refs)
    rows = [[esc(pair),body(distinction),f'<a href="layer-{n}.html">回第 {n} 层 ↗</a>'] for pair,distinction,n in data['confusions']]
    # table() preserves authored anchor markup too.
    content += '<section class="compare-section" id="confusions"><h2>最容易记混的概念清单</h2>' + table(['容易混的一对','真正的区别','回到主线'],rows) + '</section><p class="one-sentence"><span>这张横向地图的一句话</span>名字越变越多，但你可以一直问：它补哪个洞，复用了什么，又付出了什么代价？</p>'
    page('connections.html','横向专题','connections',content)

if __name__ == '__main__':
    home()
    for n in range(1,7):
        path = ROOT / 'content' / f'layer-{n}.json'
        if path.exists():
            layer(json.loads(path.read_text(encoding='utf-8-sig')))
    connections(json.loads((ROOT/'content'/'connections.json').read_text(encoding='utf-8-sig')))
    print('Static guide pages generated.')
