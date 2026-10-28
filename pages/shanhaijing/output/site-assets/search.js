(function registerSearchFeature() {
  "use strict";

  const SHJ = window.SHJ;
  const SERVICE = window.SHJSearch;
  const TYPE_LABELS = {
    occurrence: "经文中的相关条目",
    entity: "跨篇整理记录",
    original: "原文",
    translation: "已有译文",
    note: "原有注释"
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
    main.textContent = (row.title || row.id).replace(/〔字形图:[^〕]+〕/g, "（原书嵌字图）");
    heading.append(main);
    article.append(heading);
    article.append(el("p", "shj-search__result-kind", TYPE_LABELS[row.type] || "相关内容"));
    const sourceVolumes = row.type === "entity" ? row.volumeIds : [row.volumeId];
    if (sourceVolumes && sourceVolumes.length) {
      const titles = sourceVolumes.map(id => volumeOptions().find(item => item.value === id)?.label || id);
      article.append(el("p", "shj-search__source", [...new Set(titles)].join("、")));
    }
    if (row.sourceExcerpt) article.append(el("blockquote", "shj-search__excerpt", row.sourceExcerpt.replace(/〔字形图:[^〕]+〕/g, "（此处有原书嵌字图，可在读本查看）")));
    const categories = row.categoryIds || [];
    const categoryStatuses = row.categoryStatuses || [];
    const identityStatuses = row.identityStatuses || [];
    if (categories.includes("none") || categoryStatuses.some(value => ["unresolved", "pending", "rule_boundary_flag"].includes(value))) {
      article.append(el("p", "shj-search__plain-status", "这条内容的类别尚未确认。"));
    } else if (categoryStatuses.includes("candidate")) article.append(el("p", "shj-search__plain-status", "这条内容与所选类别的关系仍在判断。"));
    if (identityStatuses.some(value => ["unresolved", "pending", "ambiguous"].includes(value))) article.append(el("p", "shj-search__plain-status", "这条内容的身份仍有未确定之处。"));
    if (row.rawIdentityStatus === "unmerged_candidate") article.append(el("p", "shj-search__plain-status", "这条记录尚未与其他记录归并。"));
    if ((row.rawIdentityStatuses || []).includes("unmerged_candidate")) article.append(el("p", "shj-search__plain-status", "其中有成员尚未与其他记录归并。"));
    const sourceDetails = el("details", "shj-search__source-details");
    sourceDetails.append(el("summary", null, "来源与整理说明"));
    if (row.rawIdentityStatus) sourceDetails.append(el("p", "shj-search__raw-status", "原始候选状态：" + labelFor(RAW_STATUS_LABELS, row.rawIdentityStatus)));
    if (row.rawIdentityStatuses && row.rawIdentityStatuses.length) {
      const raw = el("p", "shj-search__raw-status", "成员原始候选状态：");
      addStatusTags(raw, row.rawIdentityStatuses);
      sourceDetails.append(raw);
    }
    if (row.type !== "entity" && (categories.length || categoryStatuses.length)) {
      const states = el("div", "shj-search__states");
      for (const id of categories) states.append(el("span", "shj-search__tag", id === "none" ? "尚未确定类别" : (SHJ.bootstrap.categories.find(item => item.categoryId === id)?.label || id)));
      addStatusTags(states, categoryStatuses);
      sourceDetails.append(states);
    }
    if (identityStatuses.length) {
      const states = el("div", "shj-search__states");
      addStatusTags(states, identityStatuses);
      sourceDetails.append(states);
    }
    if (row.type === "entity") {
      addFacetAssertions(sourceDetails, "成员分类", row.categoryAssertions || [], "category");
      addFacetAssertions(sourceDetails, "成员身份", row.identityAssertions || [], "identity");
    }
    if (row.links && row.links.length) {
      const links = el("div", "shj-search__links");
      for (const item of row.links) {
        const anchor = el("a", null, item.label);
        anchor.href = SHJ.linkTo(item.target);
        links.append(anchor);
      }
      sourceDetails.append(links);
    }
    if (sourceDetails.childElementCount > 1) article.append(sourceDetails);
    return article;
  }

  async function mountSearch(container, context) {
    if (!SERVICE) throw new Error("检索服务尚未接入。");
    const root = el("section", "shj-search");
    root.dataset.state = "idle";
    const title = el("h1", "shj-search__title", "检索与浏览");
    root.append(title);
    root.append(el("p", "shj-search__intro", "输入一个名字或词语即可查找原文、译文和相关记录。"));

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

    const examples = el("div", "shj-search__examples");
    examples.append(el("span", null, "试试："));
    for (const word of ["精卫", "青丘山", "夸父"]) {
      const button = el("button", "shj-search__example", word);
      button.type = "button";
      button.addEventListener("click", () => { queryInput.value = word; void runSearch(1, true); });
      examples.append(button);
    }
    form.append(examples);

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
    const advanced = el("details", "shj-search__advanced");
    advanced.append(el("summary", null, "更多筛选（篇章、类别与记录状态）"));
    const advancedFields = el("div", "shj-search__advanced-fields");
    for (const item of [volumeSelect, categorySelect, typeSelect, categoryStatusSelect, identityStatusSelect]) advancedFields.append(item.wrapper);

    const sorting = el("div", "shj-search__field");
    const sortLabel = el("label", null, "排序");
    const sortSelect = el("select", "shj-search__sort");
    sortSelect.id = "shj-search-sort";
    for (const [value, label] of [["source", "按经文顺序"], ["name", "按名称"]]) {
      const option = el("option", null, label); option.value = value; option.selected = uiState.sort === value; sortSelect.append(option);
    }
    sortLabel.htmlFor = sortSelect.id;
    sorting.append(sortLabel, sortSelect);
    advancedFields.append(sorting);

    const pageSizeField = el("div", "shj-search__field");
    const pageSizeLabel = el("label", null, "每页结果");
    const pageSize = el("select", "shj-search__page-size");
    pageSize.id = "shj-search-page-size";
    for (const value of [30, 50]) {
      const option = el("option", null, String(value)); option.value = String(value); option.selected = uiState.pageSize === value; pageSize.append(option);
    }
    pageSizeLabel.htmlFor = pageSize.id;
    pageSizeField.append(pageSizeLabel, pageSize);
    advancedFields.append(pageSizeField);
    advanced.append(advancedFields);
    form.append(advanced);

    const actions = el("div", "shj-search__actions");
    const submit = el("button", "shj-search__submit", "检索 / 浏览"); submit.type = "submit";
    const clear = el("button", "shj-search__clear", "清空"); clear.type = "button";
    actions.append(submit, clear);
    form.append(actions);
    root.append(form);
    const status = el("p", "shj-search__status", "输入关键词后搜索，也可以展开更多筛选。空白搜索会浏览全部记录。");
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
        status.textContent = `找到 ${found.total} 项 · 第 ${found.page}/${found.totalPages} 页。`;
        const scope = el("details", "shj-search__scope");
        scope.append(el("summary", null, "本次检索范围与整理状态"));
        scope.append(el("p", null, `索引覆盖 ${found.indexCounts.volumes} 篇、${found.indexCounts.records} 条记录。原文块不推定类别或身份；类别与身份筛选仅作用于对象记录。`));
        status.append(scope);
        if (!found.total) {
          resultsHost.append(el("p", "shj-search__empty", "没有找到相关内容。试试较短的关键词，或清除筛选。"));
          const emptyActions = el("div", "shj-search__actions");
          const clearEmpty = el("button", "shj-search__clear", "清除筛选并重试"); clearEmpty.type = "button"; clearEmpty.addEventListener("click", onClear);
          const browseCatalog = el("a", "action-link secondary", "逛分类册"); browseCatalog.href = SHJ.linkTo({ type: "catalog", categoryId: "animal.creature" });
          emptyActions.append(clearEmpty, browseCatalog);
          resultsHost.append(emptyActions);
        }
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
