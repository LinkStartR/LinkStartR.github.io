(function registerSearchFeature() {
  "use strict";

  const SHJ = window.SHJ;
  const SERVICE = window.SHJSearch;
  const TYPE_LABELS = {
    occurrence: "对象出现",
    entity: "整理实体",
    original: "原文",
    translation: "原译文",
    note: "原注释"
  };
  const STATUS_LABELS = {
    supported: "分类判定支持",
    candidate: "分类候选",
    unresolved: "尚未确定",
    none: "尚未确定类别",
    no_category: "尚未确定类别",
    unmerged_candidate: "尚未归入整理实体",
    same_entity: "身份复核为同一指称",
    distinct_entities: "身份复核为不同指称",
    canonical: "已整理为实体",
    non_physical: "记录为非个体或地点实体",
    unknown: "状态未提供"
  };
  const RAW_STATUS_LABELS = { unmerged_candidate: "尚未归并的原始候选" };
  const uiState = { q: "", filters: {}, sort: "source", pageSize: 30, page: 1, submitted: false };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function labelFor(map, value) {
    return map[value] || String(value || "状态未提供");
  }

  function selected(select) {
    return [...select.selectedOptions].map(option => option.value);
  }

  function updateOptions(select, values, labels) {
    const chosen = new Set(selected(select));
    select.replaceChildren();
    for (const value of values) {
      const option = el("option", null, labelFor(labels, value));
      option.value = value;
      option.selected = chosen.has(value);
      select.append(option);
    }
  }

  function makeMultiSelect(id, title, options, chosen = []) {
    const wrapper = el("div", "shj-search__field");
    const label = el("label", null, title);
    const select = el("select", "shj-search__multi");
    select.id = id;
    select.multiple = true;
    select.size = Math.min(5, Math.max(3, options.length));
    for (const optionData of options) {
      const option = el("option", null, optionData.label);
      option.value = optionData.value;
      option.selected = chosen.includes(option.value);
      select.append(option);
    }
    label.htmlFor = id;
    wrapper.append(label, select);
    return { wrapper, select };
  }

  function volumeOptions() {
    return SHJ.bootstrap.volumes.map(row => ({ value: row.volumeId, label: [row.title, row.chapterTitle].filter(Boolean).join(" · ") }));
  }

  function categoryOptions() {
    return [{ value: "none", label: "尚未确定类别" }, ...SHJ.bootstrap.categories.map(row => ({ value: row.categoryId, label: row.label }))];
  }

  function addStatusTags(parent, values) {
    for (const value of values) parent.append(el("span", "shj-search__tag", labelFor(STATUS_LABELS, value)));
  }

  function addFacetAssertions(parent, label, assertions, field) {
    if (!assertions.length) return;
    const details = el("details", "shj-search__assertions");
    details.append(el("summary", null, `${label}依据 ${assertions.length} 项`));
    for (const assertion of assertions) {
      const volume = volumeOptions().find(row => row.value === assertion.volumeId);
      const line = el("p", null, (volume ? volume.label : assertion.volumeId) + " · ");
      if (field === "category") {
        const names = (assertion.categoryIds || []).map(id => id === "none" ? "尚未确定类别" : (SHJ.bootstrap.categories.find(row => row.categoryId === id)?.label || id));
        line.append(document.createTextNode((names.length ? names.join("、") : "尚未确定类别") + " · " + labelFor(STATUS_LABELS, assertion.categoryStatus)));
      } else {
        addStatusTags(line, assertion.statuses || assertion.identityStatuses || []);
      }
      details.append(line);
    }
    parent.append(details);
  }

  function renderResult(row) {
    const article = el("article", "shj-search__result");
    article.dataset.resultId = row.id;
    article.dataset.resultType = row.type;
    const heading = el("h2", "shj-search__result-title");
    const main = el("a");
    main.href = SHJ.linkTo(row.target);
    main.textContent = row.title || row.id;
    heading.append(main);
    article.append(heading);
    article.append(el("p", "shj-search__result-kind", TYPE_LABELS[row.type] || row.type));
    const sourceVolumes = row.type === "entity" ? row.volumeIds : [row.volumeId];
    if (sourceVolumes && sourceVolumes.length) {
      const titles = sourceVolumes.map(id => volumeOptions().find(item => item.value === id)?.label || id);
      article.append(el("p", "shj-search__source", [...new Set(titles)].join("、")));
    }
    if (row.type === "occurrence") article.append(el("p", "shj-search__surface", "原文出现：" + (row.surface || row.text || "")));
    if (row.rawIdentityStatus) article.append(el("p", "shj-search__raw-status", "原始候选状态：" + labelFor(RAW_STATUS_LABELS, row.rawIdentityStatus)));
    if (row.rawIdentityStatuses && row.rawIdentityStatuses.length) {
      const raw = el("p", "shj-search__raw-status", "成员原始候选状态：");
      addStatusTags(raw, row.rawIdentityStatuses);
      article.append(raw);
    }
    if (row.type !== "entity" && (row.categoryIds.length || row.categoryStatuses.length)) {
      const states = el("div", "shj-search__states");
      for (const id of row.categoryIds) states.append(el("span", "shj-search__tag", id === "none" ? "尚未确定类别" : (SHJ.bootstrap.categories.find(item => item.categoryId === id)?.label || id)));
      addStatusTags(states, row.categoryStatuses);
      article.append(states);
    }
    if (row.identityStatuses.length) {
      const states = el("div", "shj-search__states");
      addStatusTags(states, row.identityStatuses);
      article.append(states);
    }
    if (row.sourceExcerpt) article.append(el("blockquote", "shj-search__excerpt", row.sourceExcerpt));
    if (row.type === "entity") {
      addFacetAssertions(article, "成员分类", row.categoryAssertions || [], "category");
      addFacetAssertions(article, "成员身份", row.identityAssertions || [], "identity");
    }
    if (row.links && row.links.length) {
      const links = el("div", "shj-search__links");
      for (const item of row.links) {
        const anchor = el("a", null, item.label);
        anchor.href = SHJ.linkTo(item.target);
        links.append(anchor);
      }
      article.append(links);
    }
    return article;
  }

  async function mountSearch(container, context) {
    if (!SERVICE) throw new Error("检索服务尚未接入。");
    const root = el("section", "shj-search");
    root.dataset.state = "idle";
    const title = el("h1", "shj-search__title", "检索与浏览");
    root.append(title);
    root.append(el("p", "shj-search__intro", "按原文、译文、注释、文本出现与已有整理实体检索。匹配使用原始出现词形与原文块文字；身份理由和分类理由不作为经文内容。多个已记录状态会并列保留；正文块没有推定的类别或身份。整理实体名称只取已有成员词形，不代表新增别名。"));

    const form = el("form", "shj-search__form");
    const queryField = el("div", "shj-search__field");
    const queryLabel = el("label", null, "检索文字");
    const queryInput = el("input", "shj-search__query");
    queryInput.type = "search";
    queryInput.id = "shj-search-query";
    queryInput.autocomplete = "off";
    queryInput.value = uiState.q;
    queryLabel.htmlFor = queryInput.id;
    queryField.append(queryLabel, queryInput);
    form.append(queryField);

    const volumeSelect = makeMultiSelect("shj-search-volumes", "篇章（可多选）", volumeOptions(), uiState.filters.volumeIds || []);
    const categorySelect = makeMultiSelect("shj-search-categories", "类别（可多选）", categoryOptions(), uiState.filters.categories || []);
    const typeSelect = makeMultiSelect("shj-search-types", "记录类型（可多选）", [
      ["occurrence", "对象出现"], ["entity", "整理实体"], ["original", "原文"], ["translation", "原译文"], ["note", "原注释"]
    ].map(([value, label]) => ({ value, label })), uiState.filters.types || []);
    const categoryStatusSelect = makeMultiSelect("shj-search-category-status", "分类状态（可多选）", [
      ["supported", "分类判定支持"], ["candidate", "分类候选"], ["unresolved", "尚未确定"]
    ].map(([value, label]) => ({ value, label })), uiState.filters.categoryStatuses || []);
    const identityStatusSelect = makeMultiSelect("shj-search-identity-status", "身份状态（可多选）", [
      ["canonical", "已整理为实体"], ["same_entity", "身份复核为同一指称"], ["distinct_entities", "身份复核为不同指称"],
      ["unresolved", "身份尚未确定"], ["unmerged_candidate", "尚未归入整理实体"], ["non_physical", "记录为非个体或地点实体"]
    ].map(([value, label]) => ({ value, label })), uiState.filters.identityStatuses || []);
    for (const item of [volumeSelect, categorySelect, typeSelect, categoryStatusSelect, identityStatusSelect]) form.append(item.wrapper);

    const sorting = el("div", "shj-search__field");
    const sortLabel = el("label", null, "排序");
    const sortSelect = el("select", "shj-search__sort");
    sortSelect.id = "shj-search-sort";
    for (const [value, label] of [["source", "按经文顺序"], ["name", "按名称"]]) {
      const option = el("option", null, label); option.value = value; option.selected = uiState.sort === value; sortSelect.append(option);
    }
    sortLabel.htmlFor = sortSelect.id;
    sorting.append(sortLabel, sortSelect);
    form.append(sorting);

    const pageSizeField = el("div", "shj-search__field");
    const pageSizeLabel = el("label", null, "每页结果");
    const pageSize = el("select", "shj-search__page-size");
    pageSize.id = "shj-search-page-size";
    for (const value of [30, 50]) {
      const option = el("option", null, String(value)); option.value = String(value); option.selected = uiState.pageSize === value; pageSize.append(option);
    }
    pageSizeLabel.htmlFor = pageSize.id;
    pageSizeField.append(pageSizeLabel, pageSize);
    form.append(pageSizeField);

    const actions = el("div", "shj-search__actions");
    const submit = el("button", "shj-search__submit", "检索 / 浏览"); submit.type = "submit";
    const clear = el("button", "shj-search__clear", "清空"); clear.type = "button";
    actions.append(submit, clear);
    form.append(actions);
    root.append(form);
    const status = el("p", "shj-search__status", "提交后开始读取十八篇索引；空表单可浏览全部记录。");
    status.setAttribute("aria-live", "polite");
    root.append(status);
    const resultsHost = el("div", "shj-search__results");
    root.append(resultsHost);
    container.replaceChildren(root);

    const readForm = () => {
      uiState.q = queryInput.value;
      uiState.filters = {
        volumeIds: selected(volumeSelect.select),
        categories: selected(categorySelect.select),
        types: selected(typeSelect.select),
        categoryStatuses: selected(categoryStatusSelect.select),
        identityStatuses: selected(identityStatusSelect.select)
      };
      uiState.sort = sortSelect.value;
      uiState.pageSize = Number(pageSize.value);
    };
    let activeController = null;
    let requestGeneration = 0;
    async function runSearch(page = 1, captureForm = false) {
      if (context.signal.aborted) return;
      if (captureForm) readForm();
      uiState.page = page;
      uiState.submitted = true;
      submit.disabled = true;
      if (activeController) activeController.abort();
      const controller = new AbortController();
      activeController = controller;
      const generation = ++requestGeneration;
      const isCurrent = () => generation === requestGeneration && activeController === controller && !context.signal.aborted && !controller.signal.aborted;
      const abortSearch = () => controller.abort();
      context.signal.addEventListener("abort", abortSearch, { once: true });
      root.dataset.state = "loading";
      resultsHost.replaceChildren();
      status.textContent = "正在准备检索…";
      try {
        const loaded = await SERVICE.loadIndex({
          signal: controller.signal,
          onProgress: event => {
            if (!isCurrent()) return;
            status.textContent = event.phase === "ready" ? "索引已就绪，正在查找…" : `正在读取篇章 ${event.completed}/${event.total}…`;
          }
        });
        if (!isCurrent()) return;
        updateOptions(categoryStatusSelect.select, loaded.facets.categoryStatuses, STATUS_LABELS);
        updateOptions(identityStatusSelect.select, loaded.facets.identityStatuses, STATUS_LABELS);
        const found = await SERVICE.query({
          q: uiState.q,
          filters: uiState.filters,
          sort: uiState.sort,
          page: uiState.page,
          pageSize: uiState.pageSize
        }, { signal: controller.signal });
        if (!isCurrent()) return;
        root.dataset.state = "ready";
        status.textContent = `找到 ${found.total} 项 · 第 ${found.page}/${found.totalPages} 页 · 索引覆盖 ${found.indexCounts.volumes} 篇、${found.indexCounts.records} 条记录。`;
        if (found.metadataFiltersApplied) status.append(document.createTextNode(" 类别/状态筛选仅作用于对象出现和整理实体；正文块不推定类别或身份。"));
        if (!found.total) resultsHost.append(el("p", "shj-search__empty", "没有符合条件的结果。可清空部分筛选后再试。"));
        else {
          const list = el("div", "shj-search__list");
          for (const row of found.results) list.append(renderResult(row));
          resultsHost.append(list);
          const pager = el("nav", "shj-search__pager"); pager.setAttribute("aria-label", "检索结果分页");
          const previous = el("button", null, "上一页"); previous.type = "button"; previous.disabled = found.page <= 1;
          const next = el("button", null, "下一页"); next.type = "button"; next.disabled = found.page >= found.totalPages;
          const pageLabel = el("span", null, `第 ${found.page}/${found.totalPages} 页`);
          previous.addEventListener("click", () => runSearch(found.page - 1, false));
          next.addEventListener("click", () => runSearch(found.page + 1, false));
          pager.append(previous, pageLabel, next);
          resultsHost.append(pager);
        }
      } catch (error) {
        if (!isCurrent() || error.name === "AbortError") return;
        root.dataset.state = "error";
        status.textContent = "检索未能完成：" + (error.message || "未知错误");
        const retry = el("button", "shj-search__retry", "重试"); retry.type = "button";
        retry.addEventListener("click", () => runSearch(uiState.page, false));
        resultsHost.replaceChildren(retry);
      } finally {
        context.signal.removeEventListener("abort", abortSearch);
        if (generation === requestGeneration && activeController === controller) {
          activeController = null;
          if (!context.signal.aborted) submit.disabled = false;
        }
      }
    }
    const onSubmit = event => { event.preventDefault(); void runSearch(1, true); };
    const onClear = () => {
      requestGeneration += 1;
      if (activeController) activeController.abort();
      activeController = null;
      submit.disabled = false;
      form.reset();
      queryInput.value = "";
      for (const select of [volumeSelect.select, categorySelect.select, typeSelect.select, categoryStatusSelect.select, identityStatusSelect.select]) {
        for (const option of select.options) option.selected = false;
      }
      uiState.q = ""; uiState.filters = {}; uiState.sort = "source"; uiState.pageSize = 30; uiState.page = 1; uiState.submitted = false;
      sortSelect.value = "source"; pageSize.value = "30";
      resultsHost.replaceChildren();
      root.dataset.state = "idle";
      status.textContent = "表单已清空；提交后开始检索，空表单可浏览全部记录。";
    };
    form.addEventListener("submit", onSubmit);
    clear.addEventListener("click", onClear);
    if (uiState.submitted) void runSearch(uiState.page, false);
    document.title = "检索与浏览 · 山海经";
    return () => {
      if (activeController) activeController.abort();
      form.removeEventListener("submit", onSubmit);
      clear.removeEventListener("click", onClear);
      container.replaceChildren();
    };
  }

  SHJ.registerFeature("search", mountSearch);
})();
