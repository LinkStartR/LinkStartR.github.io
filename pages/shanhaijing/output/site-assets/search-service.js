(function installSearchService() {
  "use strict";

  const SHJ = window.SHJ;
  const VERSION = "p5-search-1";
  const VOLUME_BY_ID = new Map(SHJ.bootstrap.volumes.map((row, index) => [row.volumeId, { ...row, order: index }]));
  const ALLOWED_BLOCK_KINDS = new Set(["original", "translation", "note"]);
  const indexedVolumes = new Map();
  let globalData = null;
  let index = null;

  function problem(path, id, message) {
    return new Error(`${path}${id ? ` · ${id}` : ""}：${message}`);
  }

  function addToSetMap(map, key, value) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  }

  function safeProgress(callback, event) {
    if (typeof callback !== "function") return;
    try { callback(event); } catch (_) { /* progress consumers cannot invalidate indexing */ }
  }

  function buildVolumeIndex(volume, taxonomyIds) {
    const path = `volumes/${volume.volumeId}.json`;
    if (!volume || typeof volume.volumeId !== "string" || !VOLUME_BY_ID.has(volume.volumeId)) {
      throw problem(path, volume && volume.volumeId, "卷 ID 不在站点清单中");
    }
    const blocks = new Map();
    const records = [];
    const blockCounts = { original: 0, translation: 0, note: 0 };
    for (const block of volume.p1.sourceBlocks || []) {
      const id = block.blockId;
      if (!id || id.volumeId !== volume.volumeId || !Number.isInteger(id.blockOrder) || typeof id.kind !== "string") {
        throw problem(path, id && `${id.volumeId}:${id.blockOrder}:${id.kind}`, "P1 块稳定 ID 无效");
      }
      const key = `${id.volumeId}:${id.blockOrder}:${id.kind}`;
      if (blocks.has(key)) throw problem(path, key, "P1 块稳定 ID 重复");
      blocks.set(key, block);
      if (!ALLOWED_BLOCK_KINDS.has(id.kind)) continue;
      if (typeof block.text !== "string") throw problem(path, key, "P1 块缺少文本");
      blockCounts[id.kind] += 1;
      records.push({
        type: id.kind,
        id: key,
        stableId: key,
        volumeId: volume.volumeId,
        volumeOrder: VOLUME_BY_ID.get(volume.volumeId).order,
        blockOrder: id.blockOrder,
        start: 0,
        title: id.kind === "original" ? "原文" : id.kind === "translation" ? "原译文" : "原注释",
        text: block.text,
        searchText: block.text,
        categoryIds: [],
        categoryStatuses: [],
        identityStatuses: [],
        categoryAssertions: [],
        identityAssertions: [],
        metadataAssertions: [],
        sourceRefs: [{ volumeId: volume.volumeId, blockOrder: id.blockOrder, kind: id.kind }],
        target: { type: "reader", volumeId: volume.volumeId, blockKey: key },
        links: []
      });
    }

    const entries = new Map();
    for (const entry of volume.p3.entries || []) {
      if (!entry.entryId || entries.has(entry.entryId) || !Array.isArray(entry.occurrenceRefs)) {
        throw problem(path, entry.entryId, "整理条目 ID 重复或引用结构无效");
      }
      entries.set(entry.entryId, entry);
    }
    const candidates = new Map();
    for (const candidate of volume.p3.entityCandidates || []) {
      if (!candidate.entityCandidateId || candidates.has(candidate.entityCandidateId) || !Array.isArray(candidate.entryRefs)) {
        throw problem(path, candidate.entityCandidateId, "候选 ID 重复或引用结构无效");
      }
      candidates.set(candidate.entityCandidateId, candidate);
    }
    const overlays = new Map();
    for (const overlay of volume.p3.categoryOverlay || []) {
      if (!overlay.occurrenceId || overlays.has(overlay.occurrenceId) || !Array.isArray(overlay.categoryIds)) {
        throw problem(path, overlay.occurrenceId, "分类判定重复或引用结构无效");
      }
      for (const categoryId of overlay.categoryIds) {
        if (!taxonomyIds.has(categoryId)) throw problem(path, overlay.occurrenceId, `未知类别 ${categoryId}`);
      }
      overlays.set(overlay.occurrenceId, overlay);
    }
    const occurrences = new Map();
    const candidateOccurrences = new Map();
    for (const occurrence of volume.p3.occurrences || []) {
      const id = occurrence.occurrenceId;
      if (!id || occurrences.has(id) || occurrence.volumeId !== volume.volumeId) throw problem(path, id, "文本出现 ID 重复或卷 ID 错误");
      const entry = entries.get(occurrence.entryId);
      if (!entry || !entry.occurrenceRefs.includes(id)) throw problem(path, id, `整理条目引用无效：${occurrence.entryId}`);
      const candidate = candidates.get(occurrence.entityCandidateId);
      if (!candidate || !candidate.entryRefs.includes(entry.entryId)) throw problem(path, id, `实体候选引用无效：${occurrence.entityCandidateId}`);
      const blockKey = `${occurrence.volumeId}:${occurrence.blockOrder}:${occurrence.sourceLayer}`;
      const block = blocks.get(blockKey);
      if (!block || !ALLOWED_BLOCK_KINDS.has(occurrence.sourceLayer)) throw problem(path, id, `原文块引用无效：${blockKey}`);
      if (!Number.isInteger(occurrence.start) || !Number.isInteger(occurrence.end) || occurrence.start < 0 || occurrence.end < occurrence.start) {
        throw problem(path, id, "字符跨度不是有效整数区间");
      }
      const codepoints = Array.from(block.text || "");
      if (occurrence.end > codepoints.length) throw problem(path, id, `字符跨度超出原文块 ${blockKey}`);
      const surface = codepoints.slice(occurrence.start, occurrence.end).join("");
      if (surface !== occurrence.surface) throw problem(path, id, `稳定跨度与出现词形不一致：${blockKey}`);
      const overlay = overlays.get(id);
      if (!overlay) throw problem(path, id, "缺少对应分类判定");
      const categoryStatuses = [overlay.categoryStatus || "unknown"];
      const effectiveCategoryIds = overlay.categoryIds.length ? [...new Set(overlay.categoryIds)] : ["none"];
      const item = {
        type: "occurrence",
        id,
        stableId: id,
        volumeId: volume.volumeId,
        volumeOrder: VOLUME_BY_ID.get(volume.volumeId).order,
        blockOrder: occurrence.blockOrder,
        start: occurrence.start,
        end: occurrence.end,
        title: entry.displayText || occurrence.surface,
        surface: occurrence.surface,
        text: occurrence.surface,
        sourceExcerpt: block.text,
        contextStart: occurrence.start,
        contextEnd: occurrence.end,
        searchText: `${entry.displayText || ""} ${occurrence.surface}`,
        categoryIds: effectiveCategoryIds,
        categoryStatuses,
        identityStatuses: [],
        rawIdentityStatus: candidate.identityStatus || "unknown",
        categoryAssertions: [{
          occurrenceId: id,
          candidateId: candidate.entityCandidateId,
          volumeId: volume.volumeId,
          categoryIds: effectiveCategoryIds,
          categoryStatus: overlay.categoryStatus || "unknown"
        }],
        identityAssertions: [{
          occurrenceId: id,
          candidateId: candidate.entityCandidateId,
          volumeId: volume.volumeId,
          statuses: []
        }],
        metadataAssertions: [{
          occurrenceId: id,
          candidateId: candidate.entityCandidateId,
          volumeId: volume.volumeId,
          categoryIds: effectiveCategoryIds,
          categoryStatus: overlay.categoryStatus || "unknown",
          identityStatuses: []
        }],
        sourceRefs: [{ volumeId: volume.volumeId, blockOrder: occurrence.blockOrder, kind: occurrence.sourceLayer, start: occurrence.start, end: occurrence.end, sourceTextSha256: occurrence.sourceTextSha256 }],
        links: [
          { label: "整理条目", target: { type: "entry", volumeId: volume.volumeId, id: entry.entryId } },
          { label: "实体候选", target: { type: "candidate", volumeId: volume.volumeId, id: candidate.entityCandidateId } },
          { label: "打开原文", target: { type: "reader", volumeId: volume.volumeId, blockKey } }
        ],
        entryId: entry.entryId,
        candidateId: candidate.entityCandidateId,
        target: { type: "occurrence", volumeId: volume.volumeId, id }
      };
      occurrences.set(id, item);
      if (!candidateOccurrences.has(candidate.entityCandidateId)) candidateOccurrences.set(candidate.entityCandidateId, []);
      candidateOccurrences.get(candidate.entityCandidateId).push(item);
    }
    for (const entry of entries.values()) {
      for (const id of entry.occurrenceRefs) if (!occurrences.has(id)) throw problem(path, entry.entryId, `悬空文本出现引用：${id}`);
    }
    for (const candidate of candidates.values()) {
      for (const entryId of candidate.entryRefs) if (!entries.has(entryId)) throw problem(path, candidate.entityCandidateId, `悬空整理条目引用：${entryId}`);
    }
    if (overlays.size !== occurrences.size) throw problem(path, "p3.categoryOverlay", `数量不匹配：${overlays.size} 判定 / ${occurrences.size} 出现`);
    return { candidates, occurrences, candidateOccurrences, records, blockCounts };
  }

  function candidateVolumeId(candidateId) {
    const match = SHJ.bootstrap.volumes.find(row => candidateId.startsWith(row.volumeId + "-"));
    return match ? match.volumeId : null;
  }

  function occurrenceVolumeId(occurrenceId) {
    const match = SHJ.bootstrap.volumes.find(row => occurrenceId.startsWith(row.volumeId + "-"));
    return match ? match.volumeId : null;
  }

  function applyIdentityReview(volumeIndexes, data) {
    const candidateStatuses = new Map();
    const candidateIds = new Set();
    for (const volumeIndex of volumeIndexes.values()) {
      for (const candidateId of volumeIndex.candidates.keys()) candidateIds.add(candidateId);
    }
    const addCandidateStatus = (id, status) => {
      if (!candidateIds.has(id)) throw problem("global.json", id, "身份复核引用了不存在的实体候选");
      addToSetMap(candidateStatuses, id, status);
    };
    for (const decision of data.identityOverlay.decisions || []) {
      for (const partition of decision.partitions || []) {
        for (const id of partition.memberCandidateIds || []) addCandidateStatus(id, partition.status || "unknown");
        if (decision.betweenPartitionsStatus) {
          for (const partition of decision.partitions || []) {
            for (const id of partition.memberCandidateIds || []) addCandidateStatus(id, decision.betweenPartitionsStatus);
          }
        }
      }
    }
    for (const finding of data.identityOverlay.nonPhysicalFindings || []) {
      for (const id of finding.memberCandidateIds || []) {
        addCandidateStatus(id, "non_physical");
        if (finding.status) addCandidateStatus(id, finding.status);
      }
      for (const id of finding.evidenceOccurrenceIds || []) {
        const volumeId = occurrenceVolumeId(id);
        if (!volumeId || !volumeIndexes.get(volumeId).occurrences.has(id)) throw problem("global.json", id, "非实体身份依据引用无法回指文本出现");
      }
    }
    const canonicalCandidates = new Set();
    for (const entity of data.identityOverlay.canonicalEntities || []) {
      for (const id of entity.candidateIds || []) {
        canonicalCandidates.add(id);
        addCandidateStatus(id, "canonical");
      }
    }
    for (const candidateId of candidateIds) {
      if (!canonicalCandidates.has(candidateId)) addCandidateStatus(candidateId, "unmerged_candidate");
    }
    for (const [candidateId, itemRows] of candidateOccurrencesFor(volumeIndexes)) {
      const statuses = candidateStatuses.get(candidateId) || new Set();
      for (const item of itemRows) {
        item.identityStatuses = [...statuses];
        for (const assertion of item.identityAssertions) assertion.statuses = [...statuses];
        for (const assertion of item.metadataAssertions) assertion.identityStatuses = [...statuses];
      }
    }
    return candidateStatuses;
  }

  function candidateOccurrencesFor(volumeIndexes) {
    const result = new Map();
    for (const volumeIndex of volumeIndexes.values()) {
      for (const [id, rows] of volumeIndex.candidateOccurrences) result.set(id, rows);
    }
    return result;
  }

  function buildEntityRecords(volumeIndexes, data, candidateStatuses) {
    const records = [];
    const seen = new Set();
    for (const entity of data.identityOverlay.canonicalEntities || []) {
      if (!entity.entityId || seen.has(entity.entityId)) throw problem("global.json", entity.entityId, "整理实体 ID 重复或缺失");
      seen.add(entity.entityId);
      const members = [];
      const occurrences = [];
      const categoryIds = new Set();
      const categoryStatuses = new Set();
      const identityStatuses = new Set();
      const rawIdentityStatuses = new Set();
      const categoryAssertions = [];
      const identityAssertions = [];
      const sourceRefs = [];
      const links = [];
      const searchNames = new Set();
      for (const candidateId of entity.candidateIds || []) {
        const volumeId = candidateVolumeId(candidateId);
        const volumeIndex = volumeId && volumeIndexes.get(volumeId);
        const candidate = volumeIndex && volumeIndex.candidates.get(candidateId);
        if (!candidate) throw problem("global.json", entity.entityId, `整理实体候选无法回指：${candidateId}`);
        members.push(candidateId);
        rawIdentityStatuses.add(candidate.identityStatus || "unknown");
        for (const item of volumeIndex.candidateOccurrences.get(candidateId) || []) {
          occurrences.push(item);
          for (const categoryId of item.categoryIds) categoryIds.add(categoryId);
          for (const status of item.categoryStatuses) categoryStatuses.add(status);
          searchNames.add(item.title);
          searchNames.add(item.surface);
          categoryAssertions.push(...item.categoryAssertions);
          identityAssertions.push(...item.identityAssertions.map(assertion => ({ ...assertion, statuses: [...new Set([...assertion.statuses, "canonical"])] })));
          for (const status of item.identityStatuses) identityStatuses.add(status);
          sourceRefs.push(...item.sourceRefs);
          links.push({ label: "查看文本出现", target: item.target });
        }
      }
      for (const id of entity.evidenceOccurrenceIds || []) {
        const volumeId = occurrenceVolumeId(id);
        const volumeIndex = volumeId && volumeIndexes.get(volumeId);
        if (!volumeIndex || !volumeIndex.occurrences.has(id)) throw problem("global.json", entity.entityId, `整理实体证据出现无法回指：${id}`);
        const evidence = volumeIndex.occurrences.get(id);
        sourceRefs.push(...evidence.sourceRefs);
        links.push({ label: "身份依据出现", target: evidence.target });
      }
      const memberAssertionByOccurrence = new Map();
      for (const item of occurrences) {
        for (const assertion of item.metadataAssertions) memberAssertionByOccurrence.set(assertion.occurrenceId, assertion);
      }
      const metadataAssertions = [...memberAssertionByOccurrence.values()].map(assertion => ({
        ...assertion,
        identityStatuses: [...new Set([...assertion.identityStatuses, "canonical"])]
      }));
      const names = [...searchNames].filter(Boolean).sort(compareText);
      if (!names.length) throw problem("global.json", entity.entityId, "没有可用于检索的成员词形");
      identityStatuses.add("canonical");
      const first = occurrences.slice().sort(compareSource)[0];
      records.push({
        type: "entity",
        id: entity.entityId,
        stableId: entity.entityId,
        title: names.join("、"),
        names,
        text: names.join("、"),
        sourceExcerpt: names.join("、"),
        searchText: names.join(" "),
        volumeIds: [...new Set(occurrences.map(row => row.volumeId))],
        volumeOrder: first ? first.volumeOrder : Number.MAX_SAFE_INTEGER,
        blockOrder: first ? first.blockOrder : Number.MAX_SAFE_INTEGER,
        start: first ? first.start : 0,
        categoryIds: [...categoryIds],
        categoryStatuses: [...categoryStatuses],
        identityStatuses: [...identityStatuses],
        rawIdentityStatuses: [...rawIdentityStatuses],
        categoryAssertions,
        identityAssertions,
        metadataAssertions,
        sourceRefs,
        candidateIds: members,
        evidenceOccurrenceIds: [...new Set(entity.evidenceOccurrenceIds || [])],
        reason: entity.reason || "",
        referentLevel: entity.referentLevel || "",
        target: { type: "entity", id: entity.entityId },
        links: [...new Map(links.map(row => [row.target.id || row.target.blockKey, row])).values()]
      });
    }
    return records;
  }

  function compareText(a, b) {
    const left = String(a).normalize("NFC").toLowerCase();
    const right = String(b).normalize("NFC").toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
  }

  function compareSource(a, b) {
    return (a.volumeOrder - b.volumeOrder) || (a.blockOrder - b.blockOrder) || ((a.start || 0) - (b.start || 0)) || compareText(a.stableId, b.stableId);
  }

  function normalizeQuery(value) {
    return String(value || "").normalize("NFC").toLowerCase().trim().split(/\s+/).filter(Boolean);
  }

  function matchesAllTerms(row, terms) {
    if (!terms.length) return true;
    const text = String(row.searchText || "").normalize("NFC").toLowerCase();
    return terms.every(term => text.includes(term));
  }

  function selectedSet(value, name, allowed) {
    if (value === undefined) return new Set();
    const result = new Set(value);
    for (const item of result) if (!allowed.has(item)) throw new Error(`不支持的 ${name} 筛选值：${item}`);
    return result;
  }

  function excerpt(text, terms, start, end) {
    const points = Array.from(String(text || ""));
    if (points.length <= 180) return points.join("");
    let from = Number.isInteger(start) ? Math.max(0, start - 55) : 0;
    let to = Number.isInteger(end) ? Math.min(points.length, end + 85) : Math.min(points.length, 180);
    if (!Number.isInteger(start) && terms.length) {
      const raw = String(text || "");
      const found = raw.normalize("NFC").toLowerCase().indexOf(terms[0]);
      if (found >= 0) {
        from = Math.max(0, Array.from(raw.slice(0, found)).length - 55);
        to = Math.min(points.length, from + 180);
      }
    }
    return (from > 0 ? "…" : "") + points.slice(from, to).join("") + (to < points.length ? "…" : "");
  }

  function makeSnapshot() {
    if (!index) throw new Error("检索索引尚未加载。");
    return index;
  }

  async function loadIndex({ signal, onProgress } = {}) {
    if (signal && signal.aborted) throw new DOMException("检索已取消。", "AbortError");
    if (index) {
      safeProgress(onProgress, { phase: "ready", completed: index.volumes.length, total: index.volumes.length, counts: index.counts });
      return { version: index.version, counts: index.counts, volumes: index.volumes.length, facets: index.facets };
    }
    const volumes = SHJ.bootstrap.volumes;
    const total = volumes.length;
    safeProgress(onProgress, { phase: "loading", completed: indexedVolumes.size, total });
    if (!globalData) globalData = await SHJ.data.getGlobal({ signal });
    const taxonomyIds = new Set((globalData.taxonomy.categories || []).map(row => row.categoryId));
    if (taxonomyIds.has("none")) throw problem("global.json", "taxonomy.categories", "保留筛选值 none 与正式类别 ID 冲突");
    for (let i = 0; i < volumes.length; i += 3) {
      if (signal && signal.aborted) throw new DOMException("检索已取消。", "AbortError");
      const batch = volumes.slice(i, i + 3).filter(row => !indexedVolumes.has(row.volumeId));
      const loaded = await Promise.all(batch.map(async ref => {
        const volume = await SHJ.data.getVolume(ref.volumeId, { signal });
        const volumeIndex = buildVolumeIndex(volume, taxonomyIds);
        indexedVolumes.set(ref.volumeId, volumeIndex);
        return ref.volumeId;
      }));
      safeProgress(onProgress, { phase: "loading", completed: indexedVolumes.size, total, volumeIds: loaded });
    }
    if (signal && signal.aborted) throw new DOMException("检索已取消。", "AbortError");
    const candidateStatuses = applyIdentityReview(indexedVolumes, globalData);
    const objectRecords = [];
    const blockCounts = { original: 0, translation: 0, note: 0 };
    for (const volumeIndex of indexedVolumes.values()) {
      objectRecords.push(...volumeIndex.occurrences.values());
      objectRecords.push(...volumeIndex.records);
      for (const kind of Object.keys(blockCounts)) blockCounts[kind] += volumeIndex.blockCounts[kind];
    }
    const entities = buildEntityRecords(indexedVolumes, globalData, candidateStatuses);
    const all = [...objectRecords, ...entities];
    all.sort((a, b) => compareSource(a, b) || compareText(a.title, b.title) || compareText(a.stableId, b.stableId));
    const completedVolumes = indexedVolumes.size;
    index = {
      version: VERSION,
      records: all,
      volumes: [...VOLUME_BY_ID.values()],
      categories: globalData.taxonomy.categories || [],
      facets: {
        volumeIds: [...VOLUME_BY_ID.keys()],
        categories: [{ categoryId: "none", label: "尚未确定类别" }, ...(globalData.taxonomy.categories || []).map(row => ({ categoryId: row.categoryId, label: row.label }))],
        types: ["occurrence", "entity", "original", "translation", "note"],
        categoryStatuses: [...new Set(all.flatMap(row => row.categoryStatuses))].sort(compareText),
        identityStatuses: [...new Set(all.flatMap(row => row.identityStatuses))].sort(compareText)
      },
      counts: {
        volumes: completedVolumes,
        occurrences: objectRecords.filter(row => row.type === "occurrence").length,
        entities: entities.length,
        blocks: blockCounts.original + blockCounts.translation + blockCounts.note,
        blocksByKind: blockCounts,
        records: all.length
      }
    };
    safeProgress(onProgress, { phase: "ready", completed: completedVolumes, total, counts: index.counts });
    indexedVolumes.clear();
    globalData = null;
    return { version: index.version, counts: index.counts, volumes: index.volumes.length, facets: index.facets };
  }

  function query(options = {}, { signal } = {}) {
    if (!options || typeof options !== "object" || Array.isArray(options)) return Promise.reject(new TypeError("检索参数必须是对象。"));
    if (options.q !== undefined && typeof options.q !== "string") return Promise.reject(new TypeError("q 必须是字符串。"));
    if (options.sort !== undefined && !["source", "name"].includes(options.sort)) return Promise.reject(new Error(`不支持的排序方式：${options.sort}`));
    for (const name of ["page", "pageSize"]) {
      if (options[name] !== undefined && (!Number.isInteger(options[name]) || options[name] < 1)) return Promise.reject(new TypeError(`${name} 必须是正整数。`));
    }
    if (options.pageSize !== undefined && ![30, 50].includes(options.pageSize)) return Promise.reject(new Error("pageSize 只支持 30 或 50。"));
    const suppliedFilters = options.filters;
    if (suppliedFilters !== undefined && (!suppliedFilters || typeof suppliedFilters !== "object" || Array.isArray(suppliedFilters))) return Promise.reject(new TypeError("filters 必须是对象。"));
    if (suppliedFilters) {
      const allowed = new Set(["volumeIds", "categories", "types", "categoryStatuses", "identityStatuses"]);
      for (const key of Object.keys(suppliedFilters)) if (!allowed.has(key)) return Promise.reject(new Error(`不支持的筛选字段：${key}`));
      for (const key of allowed) {
        if (suppliedFilters[key] !== undefined && (!Array.isArray(suppliedFilters[key]) || suppliedFilters[key].some(value => typeof value !== "string"))) {
          return Promise.reject(new TypeError(`filters.${key} 必须是字符串数组。`));
        }
      }
    }
    return loadIndex({ signal, onProgress: options.onProgress }).then(() => {
      if (signal && signal.aborted) throw new DOMException("检索已取消。", "AbortError");
      const snapshot = makeSnapshot();
      const terms = normalizeQuery(options.q);
      const filters = options.filters === undefined ? {} : options.filters;
      const sort = options.sort || "source";
      const volumeIds = selectedSet(filters.volumeIds, "volumeIds", new Set(snapshot.volumes.map(row => row.volumeId)));
      const categoryIds = selectedSet(filters.categories, "categories", new Set(snapshot.facets.categories.map(row => row.categoryId)));
      const types = selectedSet(filters.types, "types", new Set(snapshot.facets.types));
      const categoryStatuses = selectedSet(filters.categoryStatuses, "categoryStatuses", new Set(snapshot.facets.categoryStatuses));
      const identityStatuses = selectedSet(filters.identityStatuses, "identityStatuses", new Set(snapshot.facets.identityStatuses));
      const metadataFilters = categoryIds.size || categoryStatuses.size || identityStatuses.size;
      let results = snapshot.records.filter(row => {
        if (!matchesAllTerms(row, terms)) return false;
        if (types.size && !types.has(row.type)) return false;
        if (metadataFilters && row.type !== "occurrence" && row.type !== "entity") return false;
        const assertions = row.metadataAssertions || [];
        if (metadataFilters) {
          const scoped = assertions.some(assertion => {
            if (volumeIds.size && !volumeIds.has(assertion.volumeId)) return false;
            if (categoryIds.size && !assertion.categoryIds.some(id => categoryIds.has(id))) return false;
            if (categoryStatuses.size && !categoryStatuses.has(assertion.categoryStatus)) return false;
            if (identityStatuses.size && !assertion.identityStatuses.some(status => identityStatuses.has(status))) return false;
            return true;
          });
          if (!scoped) return false;
        } else if (volumeIds.size) {
          const rowVolumes = row.type === "entity" ? row.volumeIds : [row.volumeId];
          if (!rowVolumes.some(id => volumeIds.has(id))) return false;
        }
        return true;
      });
      results.sort((a, b) => sort === "name"
        ? compareText(a.title, b.title) || compareText(a.stableId, b.stableId)
        : compareSource(a, b) || compareText(a.title, b.title) || compareText(a.stableId, b.stableId));
      const total = results.length;
      const pageSize = options.pageSize || 30;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const page = options.page || 1;
      if (page > totalPages) throw new RangeError(`页码 ${page} 超出结果范围（共 ${totalPages} 页）。`);
      results = results.slice((page - 1) * pageSize, page * pageSize).map(row => ({
        ...row,
        sourceExcerpt: excerpt(row.sourceExcerpt || row.text, terms, row.contextStart, row.contextEnd)
      }));
      return { results, total, page, pageSize, totalPages, version: snapshot.version, indexCounts: snapshot.counts, metadataFiltersApplied: Boolean(metadataFilters) };
    });
  }

  window.SHJSearch = Object.freeze({ version: VERSION, loadIndex, query });
})();
