(function () {
  "use strict";
  const SHJ = window.SHJ;
  const types = { route_order: "先后", direction: "方向", distance: "距离", origin_flow: "源流", range_extent: "范围", association: "关联" };
  const assertions = { explicit: "经文明示", ambiguous: "关系未定", conflicting: "存在冲突" };
  const resolutions = { bound: "已绑定文本候选", unresolved: "未定", ambiguous: "有歧义" };
  const reviews = { reviewed: "已审读", reviewed_with_ambiguity: "已审读，有未定", no_relation: "本块未发现关系", pending: "待处理", failed: "处理失败" };
  const roleNames = { from: "起点", to: "终点", subject: "主体", reference: "参照", origin: "源头", destination: "归向", watercourse: "水系", place: "地点", region: "区域", source: "来源", start: "起始", end: "终止", water: "水", mountain: "山" };
  const label = (dict, key) => dict[key] || key || "未提供";
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function link(target, text) {
    const node = el("a", null, text);
    node.href = SHJ.linkTo(target);
    return node;
  }
  function add(parent, title, value) {
    const p = el("p");
    p.append(el("strong", null, title + "："), document.createTextNode(value == null || value === "" ? "未提供" : String(value)));
    parent.append(p);
    return p;
  }
  function fields(parent, object, names) {
    Object.entries(names).forEach(([key, name]) => add(parent, name, object[key]));
  }
  function blockLink(ref, text) {
    return link({ type: "reader", volumeId: ref.volumeId, blockKey: `${ref.volumeId}:${ref.blockOrder}:original` }, text);
  }
  function refLine(parent, title, ref) {
    if (!ref) return add(parent, title, "未提供");
    const p = el("p");
    p.append(el("strong", null, title + "："), blockLink(ref, `${ref.volumeId} · 原文块 ${ref.blockOrder}`));
    p.append(document.createTextNode(`；源文 SHA-256 ${ref.sourceTextSha256}` + (ref.start != null ? `；字符范围 [${ref.start}, ${ref.end})` : "")));
    parent.append(p);
  }
  function relationLink(volume, id) {
    const relation = volume.p4Relations.find(item => item.relationId === id);
    return relation ? link({ type: "map", volumeId: volume.volumeId, relationId: id }, id) : document.createTextNode(id + "（本篇未找到，无法回指）");
  }
  function graph(relation) {
    const figure = el("figure", "shj-map__graph");
    figure.append(el("figcaption", null, `本条关系 · ${label(types, relation.relationType)}`));
    const nodes = el("ul");
    relation.endpoints.forEach(endpoint => {
      nodes.append(el("li", null, `${label(roleNames, endpoint.role)}：${endpoint.label}`));
    });
    figure.append(nodes);
    return figure;
  }
  function detail(volume, relation) {
    const section = el("section", "shj-map__detail route-panel");
    section.tabIndex = -1;
    section.dataset.relationId = relation.relationId;
    section.dataset.relationType = relation.relationType;
    section.dataset.assertionStatus = relation.assertionStatus;
    section.append(el("h2", null, "关系详情"));
    fields(section, relation, { relationId: "关系编号", claim: "整理的关系说明", quote: "经文引句", reason: "理由" });
    add(section, "类型", label(types, relation.relationType));
    add(section, "状态", label(assertions, relation.assertionStatus));
    section.append(el("p", "shj-map__notice", "连线表示端点共同参与本关系。"), graph(relation));
    if (relation.value) {
      fields(section, relation.value, { raw: "原说法", number: "数值", unit: "单位", direction: "方向" });
    } else add(section, "原说法", "无记录");
    refLine(section, "引句来源", relation.source);
    const context = el("section");
    context.append(el("h3", null, `相关原文块（${relation.contextRefs.length}）`));
    relation.contextRefs.forEach((ref, i) => refLine(context, `相关位置 ${i + 1}`, ref));
    section.append(context);
    const endpoints = el("section");
    endpoints.append(el("h3", null, `端点（${relation.endpoints.length}）`));
    relation.endpoints.forEach((endpoint, i) => {
      const item = el("article", "shj-map__endpoint");
      item.dataset.endpointIndex = i;
      item.dataset.resolution = endpoint.resolution;
      item.append(el("h4", null, `${i + 1}. ${endpoint.label}`));
      add(item, "角色", `${label(roleNames, endpoint.role)}${roleNames[endpoint.role] ? `（${endpoint.role}）` : ""}`);
      add(item, "状态", label(resolutions, endpoint.resolution));
      add(item, "理由", endpoint.reason);
      refLine(item, "原文位置", endpoint.anchor);
      const p = el("p");
      p.append(el("strong", null, "文本候选："));
      const id = endpoint.candidateId;
      const candidate = id && volume.p3.entityCandidates.find(c => c.entityCandidateId === id);
      if (candidate && endpoint.anchor && endpoint.anchor.volumeId === volume.volumeId) p.append(link({ type: "candidate", volumeId: volume.volumeId, id }, id));
      else p.append(document.createTextNode(id ? id + "（未能核实篇内候选，无法回指）" : "未提供"));
      item.append(p);
      endpoints.append(item);
    });
    section.append(endpoints);
    const conflicts = el("p");
    conflicts.append(el("strong", null, "冲突引用："));
    if (!relation.conflictRefs.length) conflicts.append("无记录");
    relation.conflictRefs.forEach((id, i) => { if (i) conflicts.append("；"); conflicts.append(relationLink(volume, id)); });
    section.append(conflicts);
    return section;
  }
  function renderReviews(volume) {
    const details = el("details", "shj-map__reviews route-panel");
    const counts = {};
    volume.p4BlockReviews.forEach(r => { counts[r.reviewStatus] = (counts[r.reviewStatus] || 0) + 1; });
    details.append(el("summary", null, `原文块审读 ${volume.p4BlockReviews.length} 条 · ${Object.entries(counts).map(([status, count]) => label(reviews, status) + " " + count).join(" · ")}`));
    volume.p4BlockReviews.forEach(review => {
      const item = el("article", "shj-map__review");
      item.dataset.blockOrder = review.blockOrder;
      item.dataset.reviewStatus = review.reviewStatus;
      refLine(item, "审读位置", review);
      add(item, "审读状态", label(reviews, review.reviewStatus));
      add(item, "理由", review.reason);
      const p = el("p");
      p.append(el("strong", null, "关系引用："));
      if (!review.relationIds.length) p.append("无记录");
      review.relationIds.forEach((id, i) => { if (i) p.append("；"); p.append(relationLink(volume, id)); });
      item.append(p);
      details.append(item);
    });
    return details;
  }
  SHJ.registerFeature("map", (container, context) => {
    const root = el("div", "shj-map");
    const { volume, relation } = context.target;
    root.append(el("h1", null, volume ? `${[volume.title, volume.chapterTitle].filter(Boolean).join(" · ")} · 经文空间` : "经文空间"));
    root.append(el("p", "shj-map__notice", "关系示意，不作地理定位或里程比例。"));
    if (!volume) {
      const list = el("ul", "shj-map__chapters chapter-grid");
      SHJ.bootstrap.volumes.forEach(chapter => {
        const item = el("li");
        item.append(link({ type: "map", volumeId: chapter.volumeId }, [chapter.title, chapter.chapterTitle].filter(Boolean).join(" · ")));
        list.append(item);
      });
      root.append(list);
    } else {
      root.append(link({ type: "map" }, "返回十八篇"));
      if (relation) root.append(detail(volume, relation));
      const list = el("details", "shj-map__relations route-panel");
      list.open = !relation;
      list.append(el("summary", null, `本篇全部关系（${volume.p4Relations.length}）`));
      const ol = el("ol");
      volume.p4Relations.forEach(item => {
        const li = el("li");
        li.dataset.relationId = item.relationId;
        li.dataset.relationType = item.relationType;
        li.dataset.assertionStatus = item.assertionStatus;
        const a = link({ type: "map", volumeId: volume.volumeId, relationId: item.relationId }, `${label(types, item.relationType)} · ${item.claim} · ${label(assertions, item.assertionStatus)}`);
        if (relation && relation.relationId === item.relationId) a.setAttribute("aria-current", "page");
        li.append(a);
        ol.append(li);
      });
      list.append(ol);
      root.append(list, renderReviews(volume));
    }
    container.append(root);
    if (relation) requestAnimationFrame(() => {
      if (!context.signal.aborted) root.querySelector(".shj-map__detail").focus();
    });
  });
})();
