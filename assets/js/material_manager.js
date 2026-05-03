/* RENDERit V1.0.5 · Material, PBR metadata and environment manager */
(function () {
  'use strict';

  const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  const makeId = (prefix, name) => `${prefix}-${String(name || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'custom'}-${Date.now().toString(36).slice(-5)}`;

  const hexToRgb = (hex) => {
    const clean = String(hex || '#ffffff').replace('#', '').trim();
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, 'f').slice(0, 6);
    const num = parseInt(full, 16);
    return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
  };

  const rgbToHex = (rgb) => {
    const safe = Array.isArray(rgb) ? rgb : [1, 1, 1];
    const toByte = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
    return `#${toByte(safe[0])}${toByte(safe[1])}${toByte(safe[2])}`;
  };

  function downloadJson(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  }

  const materials = {
    lunarClay: { id: 'lunarClay', name: 'Lunar Clay', color: [0.82, 0.82, 0.80], roughness: 0.72, metalness: 0.02, clearcoat: 0.04, transmission: 0.0, emission: 0.0, maps: {}, preview: 'linear-gradient(135deg,#cfcfcf,#777)' },
    studioChrome: { id: 'studioChrome', name: 'Studio Chrome', color: [0.92, 0.94, 0.96], roughness: 0.18, metalness: 1.0, clearcoat: 0.2, transmission: 0.0, emission: 0.0, maps: {}, preview: 'linear-gradient(135deg,#ffffff,#4d5666 45%,#f6f6f6)' },
    obsidianGlass: { id: 'obsidianGlass', name: 'Obsidian Glass', color: [0.04, 0.045, 0.055], roughness: 0.04, metalness: 0.0, clearcoat: 1.0, transmission: 0.55, emission: 0.0, maps: {}, preview: 'linear-gradient(135deg,#1b1e28,#000,#cfd6ff)' },
    pearlCoat: { id: 'pearlCoat', name: 'Pearl Clearcoat', color: [0.92, 0.9, 0.86], roughness: 0.26, metalness: 0.0, clearcoat: 0.88, transmission: 0.0, emission: 0.0, maps: {}, preview: 'linear-gradient(135deg,#fff,#c8c3b7,#fff)' },
    blackAnodized: { id: 'blackAnodized', name: 'Black Anodized', color: [0.015, 0.016, 0.018], roughness: 0.38, metalness: 0.76, clearcoat: 0.15, transmission: 0.0, emission: 0.0, maps: {}, preview: 'linear-gradient(135deg,#0b0c10,#20242b,#050505)' },
    warmTitanium: { id: 'warmTitanium', name: 'Warm Titanium', color: [0.78, 0.70, 0.58], roughness: 0.31, metalness: 0.92, clearcoat: 0.12, transmission: 0.0, emission: 0.0, maps: {}, preview: 'linear-gradient(135deg,#d8c4a2,#6d6254,#fff0d2)' },
    emissionWhite: { id: 'emissionWhite', name: 'Neon White', color: [1.0, 1.0, 1.0], roughness: 0.12, metalness: 0.0, clearcoat: 1.0, transmission: 0.0, emission: 0.75, maps: {}, preview: 'linear-gradient(135deg,#fff,#d8d8d8,#fff)' },
    frostedPolymer: { id: 'frostedPolymer', name: 'Frosted Polymer', color: [0.58, 0.62, 0.68], roughness: 0.86, metalness: 0.0, clearcoat: 0.18, transmission: 0.16, emission: 0.0, maps: {}, preview: 'linear-gradient(135deg,#acb3c0,#595f6a)' }
  };

  const environments = {
    lunarLab: { id: 'lunarLab', name: 'Lunar Lab', subtitle: 'neutral high-key reflections', top: [0.74, 0.76, 0.82], horizon: [0.08, 0.085, 0.10], ground: [0.006, 0.006, 0.008], strength: 0.75 },
    blackVoid: { id: 'blackVoid', name: 'Black Void', subtitle: 'deep product contrast', top: [0.08, 0.09, 0.11], horizon: [0.012, 0.012, 0.014], ground: [0.0, 0.0, 0.0], strength: 0.55 },
    softbox: { id: 'softbox', name: 'Softbox Strip', subtitle: 'long studio reflections', top: [0.88, 0.89, 0.92], horizon: [0.12, 0.13, 0.15], ground: [0.015, 0.015, 0.018], strength: 0.95 },
    moonDawn: { id: 'moonDawn', name: 'Moon Dawn', subtitle: 'cool cinematic gradient', top: [0.48, 0.56, 0.78], horizon: [0.11, 0.12, 0.18], ground: [0.01, 0.012, 0.018], strength: 0.7 }
  };

  const baseMaterials = JSON.parse(JSON.stringify(materials));
  const baseEnvironments = JSON.parse(JSON.stringify(environments));

  function normalizeMaterial(material) {
    const fallback = materials.lunarClay || baseMaterials.lunarClay;
    const merged = Object.assign({}, fallback, material || {});
    merged.id = merged.id || makeId('mat', merged.name);
    merged.name = String(merged.name || 'Material').trim() || 'Material';
    merged.color = Array.isArray(merged.color) ? merged.color.map(clamp01) : fallback.color.slice();
    merged.roughness = Math.max(0.03, clamp01(merged.roughness));
    merged.metalness = clamp01(merged.metalness);
    merged.clearcoat = clamp01(merged.clearcoat);
    merged.transmission = clamp01(merged.transmission);
    merged.emission = clamp01(merged.emission || 0);
    merged.maps = Object.assign({}, merged.maps || {});
    merged.preview = merged.preview || `linear-gradient(135deg,${rgbToHex(merged.color)},#222)`;
    return merged;
  }

  function normalizeEnvironment(environment) {
    const fallback = environments.lunarLab || baseEnvironments.lunarLab;
    const merged = Object.assign({}, fallback, environment || {});
    merged.id = merged.id || makeId('env', merged.name);
    merged.name = String(merged.name || 'Environment').trim() || 'Environment';
    merged.subtitle = String(merged.subtitle || 'custom environment').trim();
    merged.top = Array.isArray(merged.top) ? merged.top.map(clamp01) : fallback.top.slice();
    merged.horizon = Array.isArray(merged.horizon) ? merged.horizon.map(clamp01) : fallback.horizon.slice();
    merged.ground = Array.isArray(merged.ground) ? merged.ground.map(clamp01) : fallback.ground.slice();
    merged.strength = Math.max(0, Math.min(2, Number(merged.strength ?? fallback.strength)));
    return merged;
  }

  function cloneMaterial(id) {
    return JSON.parse(JSON.stringify(normalizeMaterial(materials[id] || materials.lunarClay)));
  }

  function upsertMaterial(material) {
    const normalized = normalizeMaterial(material);
    materials[normalized.id] = normalized;
    return normalized;
  }

  function deleteMaterial(id) {
    if (!id || id === 'lunarClay' || !materials[id]) return false;
    delete materials[id];
    return true;
  }

  function upsertEnvironment(environment) {
    const normalized = normalizeEnvironment(environment);
    environments[normalized.id] = normalized;
    return normalized;
  }

  function deleteEnvironment(id) {
    if (!id || id === 'lunarLab' || !environments[id]) return false;
    delete environments[id];
    return true;
  }

  function resetMaterialLibrary(items) {
    const source = Array.isArray(items) && items.length ? items : Object.values(baseMaterials);
    Object.keys(materials).forEach((id) => { delete materials[id]; });
    source.forEach((material) => {
      const normalized = normalizeMaterial(material);
      materials[normalized.id] = normalized;
    });
    if (!materials.lunarClay) materials.lunarClay = normalizeMaterial(baseMaterials.lunarClay);
  }

  function resetEnvironmentLibrary(items) {
    const source = Array.isArray(items) && items.length ? items : Object.values(baseEnvironments);
    Object.keys(environments).forEach((id) => { delete environments[id]; });
    source.forEach((environment) => {
      const normalized = normalizeEnvironment(environment);
      environments[normalized.id] = normalized;
    });
    if (!environments.lunarLab) environments.lunarLab = normalizeEnvironment(baseEnvironments.lunarLab);
  }

  function createMaterialCard(material, activeId) {
    const card = document.createElement('button');
    const normalized = normalizeMaterial(material);
    card.className = `material-card ${normalized.id === activeId ? 'active' : ''}`;
    card.type = 'button';
    card.draggable = true;
    card.dataset.materialId = normalized.id;
    const mapCount = Object.values(normalized.maps || {}).filter(Boolean).length;
    card.innerHTML = `<span class="material-swatch" style="background:${normalized.preview || rgbToHex(normalized.color)}"></span><span><span class="material-title">${normalized.name}</span><span class="material-sub">R ${normalized.roughness.toFixed(2)} · M ${normalized.metalness.toFixed(2)}${mapCount ? ` · ${mapCount} maps` : ''}</span></span>`;
    card.addEventListener('dragstart', (event) => {
      event.dataTransfer.setData('text/renderit-material', normalized.id);
      event.dataTransfer.setData('text/plain', normalized.id);
    });
    return card;
  }

  function createEnvironmentCard(environment, activeId) {
    const normalized = normalizeEnvironment(environment);
    const card = document.createElement('button');
    card.className = `env-card ${normalized.id === activeId ? 'active' : ''}`;
    card.type = 'button';
    card.dataset.environmentId = normalized.id;
    card.innerHTML = `<span>${normalized.name}</span><small>${normalized.subtitle}</small>`;
    return card;
  }

  function exportMaterialLibrary() {
    downloadJson(`RENDERit_materials_${new Date().toISOString().slice(0, 10)}.json`, {
      app: 'RENDERit', version: '1.0.5', type: 'materials', materials: Object.values(materials).map(normalizeMaterial)
    });
  }

  function exportEnvironmentLibrary() {
    downloadJson(`RENDERit_environments_${new Date().toISOString().slice(0, 10)}.json`, {
      app: 'RENDERit', version: '1.0.5', type: 'environments', environments: Object.values(environments).map(normalizeEnvironment)
    });
  }

  window.RENDERitMaterials = {
    version: '1.0.5',
    materials,
    environments,
    cloneMaterial,
    hexToRgb,
    rgbToHex,
    createMaterialCard,
    createEnvironmentCard,
    normalizeMaterial,
    normalizeEnvironment,
    upsertMaterial,
    deleteMaterial,
    resetMaterialLibrary,
    upsertEnvironment,
    deleteEnvironment,
    resetEnvironmentLibrary,
    exportMaterialLibrary,
    exportEnvironmentLibrary,
    makeId
  };
}());
