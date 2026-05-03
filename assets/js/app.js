/* RENDERit V1.0.5 · Application wiring */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const textureState = { albedo: null, normal: null, roughness: null, metalness: null, emissive: null };
  let engine = null;
  let selectedMaterialId = 'lunarClay';
  let selectedEnvironmentId = 'lunarLab';
  let refreshQueued = false;
  let lastRefreshReason = '';
  let axisDrag = null;

  function setStatus(message) {
    const clean = String(message || 'Ready.');
    if ($('statusText')) $('statusText').textContent = clean;
  }

  function formatNumber(value) { return Number(value || 0).toLocaleString(); }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || min)); }
  function openOverlay(id) { const overlay = $(id); if (overlay) { overlay.hidden = false; overlay.setAttribute('aria-hidden', 'false'); } }
  function closeOverlay(id) { const overlay = $(id); if (overlay) { overlay.hidden = true; overlay.setAttribute('aria-hidden', 'true'); } }
  function setValue(id, value) { const el = $(id); if (el) el.value = value; }
  function setDisabled(id, state) { const el = $(id); if (el) el.disabled = state; }
  function downloadJson(name, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1200);
  }

  function refreshStats() {
    if (!engine) return;
    $('statObjects').textContent = formatNumber(engine.objects.length + (engine.groundVisible ? 1 : 0));
    $('statTris').textContent = formatNumber(engine.objects.reduce((sum, object) => sum + (object.geometry.triangleCount || 0), 0));
    $('statLights').textContent = formatNumber(engine.lights.length);
  }

  function refreshHierarchy() {
    const list = $('hierarchyList');
    list.innerHTML = '';
    const items = engine.sceneItems ? engine.sceneItems() : engine.objects;
    if (!items.length) {
      list.innerHTML = '<div class="status-box">No objects in the scene.</div>';
      return;
    }
    items.forEach((object, index) => {
      if (object.id === 'ground-plane' && !engine.groundVisible) return;
      const row = document.createElement('button');
      row.className = `object-row ${object.id === engine.selectedId ? 'selected' : ''} ${object.id === 'ground-plane' ? 'selected-ground' : ''}`;
      row.type = 'button';
      const tag = object.id === 'ground-plane' ? 'Ground' : 'Mesh';
      const meta = object.id === 'ground-plane'
        ? `${engine.groundTextureName || 'procedural surface'} · ${object.material.name}`
        : `Part ${Math.max(1, index)} · ${formatNumber(object.geometry.triangleCount)} tris · ${object.material.name}`;
      row.innerHTML = `<span><span class="object-name">${object.name}</span><span class="object-meta">${meta}</span></span><span class="tag">${tag}</span>`;
      row.addEventListener('click', () => engine.selectObject(object.id));
      list.appendChild(row);
    });
  }

  function refreshLights() {
    const list = $('lightList');
    list.innerHTML = '';
    engine.lights.forEach((light) => {
      const row = document.createElement('div');
      row.className = 'light-row';
      row.innerHTML = `<span><span class="object-name">${light.name}</span><span class="object-meta">Intensity ${light.intensity.toFixed(1)} · Pos ${light.position.map((v) => v.toFixed(1)).join(', ')}</span></span><span class="tag">Light</span>`;
      list.appendChild(row);
    });
  }

  function refreshMaterialPanel() {
    const object = engine.selectedObject();
    const disabled = !object;
    ['albedoInput','roughnessInput','metalnessInput','clearcoatInput','transmissionInput','applyMaterialBtn','openMaterialEditorBtn'].forEach((id) => { if ($(id)) $(id).disabled = disabled; });
    if (!object) {
      $('matNameInput').value = 'No selection';
      return;
    }
    const mat = window.RENDERitMaterials.normalizeMaterial(object.material);
    $('matNameInput').value = `${object.name} · ${mat.name}`;
    $('albedoInput').value = window.RENDERitMaterials.rgbToHex(mat.color);
    $('roughnessInput').value = mat.roughness;
    $('metalnessInput').value = mat.metalness;
    $('clearcoatInput').value = mat.clearcoat;
    $('transmissionInput').value = mat.transmission;
    updateRangeLabels();
  }

  function updateRangeLabels() {
    const pairs = [['roughnessInput','roughnessValue'], ['metalnessInput','metalnessValue'], ['clearcoatInput','clearcoatValue'], ['transmissionInput','transmissionValue'], ['exposureInput','exposureValue'], ['envStrengthInput','envStrengthValue'], ['floorReflectionInput','floorReflectionValue']];
    pairs.forEach(([input, label]) => { if ($(input) && $(label)) $(label).textContent = Number($(input).value).toFixed(2); });
  }


  function refreshTransformPanel() {
    const object = engine?.selectedObject();
    const disabled = !object;
    ['selectedObjectNameInput','posXInput','posYInput','posZInput','rotXInput','rotYInput','rotZInput','scaleXInput','scaleYInput','scaleZInput','applyTransformBtn','resetTransformBtn'].forEach((id) => setDisabled(id, disabled));
    if (!object) {
      setValue('selectedObjectNameInput', 'No selection');
      return;
    }
    const deg = 180 / Math.PI;
    setValue('selectedObjectNameInput', object.name);
    setValue('posXInput', object.position[0].toFixed(2));
    setValue('posYInput', object.position[1].toFixed(2));
    setValue('posZInput', object.position[2].toFixed(2));
    setValue('rotXInput', (object.rotation[0] * deg).toFixed(1));
    setValue('rotYInput', (object.rotation[1] * deg).toFixed(1));
    setValue('rotZInput', (object.rotation[2] * deg).toFixed(1));
    setValue('scaleXInput', object.scale[0].toFixed(2));
    setValue('scaleYInput', object.scale[1].toFixed(2));
    setValue('scaleZInput', object.scale[2].toFixed(2));
    const isGround = object.id === 'ground-plane';
    ['posXInput','posYInput','posZInput','rotXInput','rotYInput','rotZInput'].forEach((id) => setDisabled(id, isGround));
  }

  function refreshCameraPanel() {
    if (!engine) return;
    const deg = 180 / Math.PI;
    setValue('cameraFovInput', (engine.camera.fov * deg).toFixed(0));
    setValue('cameraDistanceInput', engine.camera.distance.toFixed(2));
    setValue('cameraPitchInput', (engine.camera.pitch * deg).toFixed(1));
    setValue('cameraYawInput', (engine.camera.yaw * deg).toFixed(1));
  }

  function refreshGroundPanel() {
    if (!engine?.groundObject) return;
    const material = window.RENDERitMaterials.normalizeMaterial(engine.groundObject.material);
    setValue('groundColorEditor', window.RENDERitMaterials.rgbToHex(material.color));
    setValue('groundRepeatEditor', engine.groundTextureRepeat || 8);
    setValue('groundRoughnessEditor', material.roughness.toFixed(2));
    setValue('groundMetalnessEditor', material.metalness.toFixed(2));
    if ($('groundTextureSummary')) {
      $('groundTextureSummary').textContent = engine.groundTextureName ? `Loaded texture: ${engine.groundTextureName}` : 'No ground texture loaded.';
      $('groundTextureSummary').classList.toggle('ground-texture-loaded', Boolean(engine.groundTextureName));
    }
    if ($('groundToggle')) $('groundToggle').checked = engine.groundVisible;
    if ($('floorReflectionInput')) $('floorReflectionInput').value = engine.floorReflection;
    updateRangeLabels();
  }

  function refreshEnvironmentQuickPanel() {
    if (!engine?.environment) return;
    setValue('envTopQuick', window.RENDERitMaterials.rgbToHex(engine.environment.top));
    setValue('envHorizonQuick', window.RENDERitMaterials.rgbToHex(engine.environment.horizon));
    setValue('envGroundQuick', window.RENDERitMaterials.rgbToHex(engine.environment.ground));
  }

  function refreshMaterialGrid() {
    const grid = $('materialGrid');
    grid.innerHTML = '';
    Object.values(window.RENDERitMaterials.materials).forEach((material) => {
      const card = window.RENDERitMaterials.createMaterialCard(material, selectedMaterialId);
      card.addEventListener('click', () => {
        selectedMaterialId = material.id;
        if (engine?.selectedObject()) engine.applyMaterial(material.id);
        refreshMaterialGrid();
      });
      card.addEventListener('dblclick', () => openMaterialEditor(material.id));
      grid.appendChild(card);
    });
  }

  function refreshEnvironmentList() {
    const list = $('environmentList');
    list.innerHTML = '';
    const active = engine?.environment?.id || selectedEnvironmentId;
    Object.values(window.RENDERitMaterials.environments).forEach((environment) => {
      const card = window.RENDERitMaterials.createEnvironmentCard(environment, active);
      card.addEventListener('click', () => {
        selectedEnvironmentId = environment.id;
        engine.setEnvironment(environment.id);
        refreshEnvironmentList();
      });
      card.addEventListener('dblclick', () => openEnvironmentEditor(environment.id));
      list.appendChild(card);
    });
  }

  function refreshPipeline() {
    const badge = $('selectedBadge');
    if (!badge || !engine) return;
    const object = engine.selectedObject();
    badge.textContent = object ? object.name : 'None';
  }

  function refreshHistory() {
    if (!engine || typeof engine.getHistoryState !== 'function') return;
    const list = $('historyList');
    const undoButton = $('undoBtn');
    const redoButton = $('redoBtn');
    const state = engine.getHistoryState();
    if (undoButton) undoButton.disabled = !state.canUndo;
    if (redoButton) redoButton.disabled = !state.canRedo;
    if (!list) return;
    const entries = (state.entries || []).slice().reverse();
    if (!entries.length) {
      list.innerHTML = '<div class="history-empty">No history entries yet.</div>';
      return;
    }
    list.innerHTML = '';
    entries.forEach((entry) => {
      const row = document.createElement('button');
      row.className = `history-entry ${entry.current ? 'current' : ''}`;
      row.type = 'button';
      row.title = entry.current ? 'Current state' : 'Restore this history state';
      const time = entry.at ? new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
      row.innerHTML = `<span><strong>${String(entry.label || 'Scene Edit').replace(/[&<>]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[c]))}</strong><small>${String(entry.reason || 'edit')}</small></span><em>${time}</em>`;
      row.addEventListener('click', () => {
        if (!entry.current && typeof engine.restoreHistoryIndex === 'function') engine.restoreHistoryIndex(entry.index, `Restored: ${entry.label}.`);
      });
      list.appendChild(row);
    });
  }

  function updateViewportHud() {
    const hud = $('viewportHud');
    if (!hud || !engine || typeof engine.getSelectionGuides !== 'function') return;
    const rect = engine.canvas.getBoundingClientRect();
    hud.setAttribute('viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
    const guide = engine.getSelectionGuides();
    if (!guide || !guide.visible) { hud.innerHTML = ''; return; }
    const r = Math.max(18, Math.min(180, guide.radius || 44));
    const cx = guide.center.x.toFixed(1);
    const cy = guide.center.y.toFixed(1);
    const axes = guide.axes || {};
    function axisMarkup(key, label) {
      const axis = axes[key];
      if (!axis || !axis.visible) return '';
      return `<g class="hud-axis-group" data-axis="${key}"><line class="hud-axis hud-${key}" data-axis="${key}" x1="${cx}" y1="${cy}" x2="${axis.x.toFixed(1)}" y2="${axis.y.toFixed(1)}"/><circle class="hud-axis-dot hud-${key}" data-axis="${key}" cx="${axis.x.toFixed(1)}" cy="${axis.y.toFixed(1)}" r="5"/><text class="hud-axis-label hud-${key}" data-axis="${key}" x="${(axis.x + 9).toFixed(1)}" y="${(axis.y + 4).toFixed(1)}">${label}</text></g>`;
    }
    const safeName = String(guide.name || 'Selection').replace(/[&<>"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
    hud.innerHTML = `
      <circle class="selection-ring" cx="${cx}" cy="${cy}" r="${r.toFixed(1)}"/>
      <rect class="selection-box" x="${(guide.center.x - r).toFixed(1)}" y="${(guide.center.y - r).toFixed(1)}" width="${(r * 2).toFixed(1)}" height="${(r * 2).toFixed(1)}" rx="10"/>
      ${axisMarkup('x', 'X')}
      ${axisMarkup('y', 'Y')}
      ${axisMarkup('z', 'Z')}
      <text class="selection-label" x="${(guide.center.x + r + 8).toFixed(1)}" y="${(guide.center.y - r - 4).toFixed(1)}">${safeName}</text>
    `;
  }

  function refreshViewportOnly() {
    if (!engine) return;
    refreshCameraPanel();
    refreshPipeline();
    refreshHistory();
    updateViewportHud();
  }

  function refreshLite() {
    if (!engine) return;
    refreshStats();
    refreshHierarchy();
    refreshMaterialPanel();
    refreshTransformPanel();
    refreshCameraPanel();
    refreshPipeline();
    refreshHistory();
    updateViewportHud();
  }

  function refreshAll() {
    if (!engine) return;
    refreshStats();
    refreshHierarchy();
    refreshLights();
    refreshMaterialPanel();
    refreshTransformPanel();
    refreshCameraPanel();
    refreshGroundPanel();
    refreshEnvironmentQuickPanel();
    refreshMaterialGrid();
    refreshEnvironmentList();
    refreshPipeline();
    refreshHistory();
    updateViewportHud();
  }

  function scheduleRefresh(reason = '') {
    lastRefreshReason = reason || lastRefreshReason;
    if (refreshQueued) return;
    refreshQueued = true;
    requestAnimationFrame(() => {
      const viewportOnly = /camera|resize|viewport/.test(lastRefreshReason);
      const lite = /transform|selection|axis|nudge|frame/.test(lastRefreshReason);
      refreshQueued = false;
      if (viewportOnly) refreshViewportOnly();
      else if (lite) refreshLite();
      else refreshAll();
      lastRefreshReason = '';
    });
  }

  function resetTextureState(material) {
    ['albedo','normal','roughness','metalness','emissive'].forEach((key) => { textureState[key] = material?.maps?.[key] || null; });
    updateTextureSummary();
  }

  function updateTextureSummary() {
    const names = Object.entries(textureState).filter(([, file]) => Boolean(file)).map(([key, file]) => `${key}: ${file}`);
    $('textureSummary').textContent = names.length ? names.join(' · ') : 'No texture channels registered.';
  }

  function openMaterialEditor(id, forceNew = false) {
    const source = !forceNew && id ? window.RENDERitMaterials.materials[id] : null;
    const material = source ? window.RENDERitMaterials.normalizeMaterial(source) : window.RENDERitMaterials.normalizeMaterial({ id: '', name: 'Custom Material', color: [0.82, 0.82, 0.82], roughness: 0.45, metalness: 0, clearcoat: 0.1, transmission: 0, emission: 0, maps: {} });
    $('materialEditId').value = source ? material.id : '';
    $('materialNameEditor').value = source ? material.name : 'Custom Material';
    $('materialColorEditor').value = window.RENDERitMaterials.rgbToHex(material.color);
    $('materialRoughnessEditor').value = material.roughness.toFixed(2);
    $('materialMetalnessEditor').value = material.metalness.toFixed(2);
    $('materialClearcoatEditor').value = material.clearcoat.toFixed(2);
    $('materialTransmissionEditor').value = material.transmission.toFixed(2);
    $('materialEmissionEditor').value = (material.emission || 0).toFixed(2);
    resetTextureState(material);
    $('deleteMaterialEditorBtn').disabled = !source || material.id === 'lunarClay';
    openOverlay('materialOverlay');
  }

  function saveMaterialFromEditor() {
    const id = $('materialEditId').value || window.RENDERitMaterials.makeId('mat', $('materialNameEditor').value);
    const material = window.RENDERitMaterials.upsertMaterial({
      id,
      name: $('materialNameEditor').value,
      color: window.RENDERitMaterials.hexToRgb($('materialColorEditor').value),
      roughness: clamp($('materialRoughnessEditor').value, 0.03, 1),
      metalness: clamp($('materialMetalnessEditor').value, 0, 1),
      clearcoat: clamp($('materialClearcoatEditor').value, 0, 1),
      transmission: clamp($('materialTransmissionEditor').value, 0, 1),
      emission: clamp($('materialEmissionEditor').value, 0, 1),
      maps: Object.assign({}, textureState),
      preview: `linear-gradient(135deg,${$('materialColorEditor').value},#16181f)`
    });
    selectedMaterialId = material.id;
    refreshMaterialGrid();
    setStatus(`Saved material: ${material.name}.`);
    if (engine?.commitHistory) engine.commitHistory(`Saved material: ${material.name}`, 'material-library');
    return material;
  }

  function deleteMaterialFromEditor() {
    const id = $('materialEditId').value;
    if (!id) return;
    const name = window.RENDERitMaterials.materials[id]?.name || 'Material';
    if (window.RENDERitMaterials.deleteMaterial(id)) {
      selectedMaterialId = 'lunarClay';
      engine.objects.forEach((object) => { if (object.material?.id === id) object.material = window.RENDERitMaterials.cloneMaterial('lunarClay'); });
      closeOverlay('materialOverlay');
      refreshAll();
      setStatus(`Deleted material: ${name}.`);
      if (engine?.commitHistory) engine.commitHistory(`Deleted material: ${name}`, 'material-library');
    }
  }

  function openEnvironmentEditor(id, forceNew = false) {
    const source = !forceNew && id ? window.RENDERitMaterials.environments[id] : null;
    const env = source ? window.RENDERitMaterials.normalizeEnvironment(source) : window.RENDERitMaterials.normalizeEnvironment({ id: '', name: 'Custom Studio', subtitle: 'custom offline environment' });
    $('environmentEditId').value = source ? env.id : '';
    $('environmentNameEditor').value = source ? env.name : 'Custom Studio';
    $('environmentSubtitleEditor').value = env.subtitle;
    $('environmentTopEditor').value = window.RENDERitMaterials.rgbToHex(env.top);
    $('environmentHorizonEditor').value = window.RENDERitMaterials.rgbToHex(env.horizon);
    $('environmentGroundEditor').value = window.RENDERitMaterials.rgbToHex(env.ground);
    $('environmentStrengthEditor').value = env.strength.toFixed(2);
    $('deleteEnvironmentEditorBtn').disabled = !source || env.id === 'lunarLab';
    openOverlay('environmentOverlay');
  }

  function saveEnvironmentFromEditor() {
    const id = $('environmentEditId').value || window.RENDERitMaterials.makeId('env', $('environmentNameEditor').value);
    const environment = window.RENDERitMaterials.upsertEnvironment({
      id,
      name: $('environmentNameEditor').value,
      subtitle: $('environmentSubtitleEditor').value,
      top: window.RENDERitMaterials.hexToRgb($('environmentTopEditor').value),
      horizon: window.RENDERitMaterials.hexToRgb($('environmentHorizonEditor').value),
      ground: window.RENDERitMaterials.hexToRgb($('environmentGroundEditor').value),
      strength: clamp($('environmentStrengthEditor').value, 0, 2)
    });
    selectedEnvironmentId = environment.id;
    refreshEnvironmentList();
    setStatus(`Saved environment: ${environment.name}.`);
    if (engine?.commitHistory) engine.commitHistory(`Saved environment: ${environment.name}`, 'environment-library');
    return environment;
  }

  function applyExportPreset() {
    const preset = $('exportPreset').value;
    if (preset === 'viewport' && engine) {
      $('exportWidth').value = Math.max(320, engine.canvas.width);
      $('exportHeight').value = Math.max(240, engine.canvas.height);
      return;
    }
    if (/^\d+x\d+$/.test(preset)) {
      const [w, h] = preset.split('x').map(Number);
      $('exportWidth').value = w;
      $('exportHeight').value = h;
    }
  }

  function syncExportAspect(changed) {
    const aspect = $('exportAspect').value;
    if (aspect === 'free') return;
    const [aw, ah] = aspect.split(':').map(Number);
    if (!aw || !ah) return;
    if (changed === 'height') $('exportWidth').value = Math.round(Number($('exportHeight').value) * aw / ah);
    else $('exportHeight').value = Math.round(Number($('exportWidth').value) * ah / aw);
  }

  function initDragDrop() {
    const zone = $('viewportDropZone');
    ['dragenter','dragover'].forEach((type) => zone.addEventListener(type, (event) => { event.preventDefault(); zone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach((type) => zone.addEventListener(type, () => zone.classList.remove('dragover')));
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      const materialId = event.dataTransfer.getData('text/renderit-material') || event.dataTransfer.getData('text/plain');
      if (materialId && window.RENDERitMaterials.materials[materialId]) {
        selectedMaterialId = materialId;
        engine.applyMaterial(materialId);
        refreshMaterialGrid();
      }
    });
  }

  function initViewportHudInteractions() {
    const hud = $('viewportHud');
    if (!hud) return;
    hud.addEventListener('pointerdown', (event) => {
      const axis = event.target?.dataset?.axis;
      if (!axis) return;
      event.preventDefault();
      event.stopPropagation();
      axisDrag = { axis, x: event.clientX, y: event.clientY };
      hud.setPointerCapture?.(event.pointerId);
      engine.setTransformMode('move');
      document.querySelectorAll('.transform-mode').forEach((item) => item.classList.toggle('active', item.dataset.transformMode === 'move'));
    });
    hud.addEventListener('pointermove', (event) => {
      if (!axisDrag) return;
      event.preventDefault();
      const dx = event.clientX - axisDrag.x;
      const dy = event.clientY - axisDrag.y;
      axisDrag.x = event.clientX;
      axisDrag.y = event.clientY;
      engine.dragAxis(axisDrag.axis, dx, dy);
      scheduleRefresh('axis-drag');
    });
    ['pointerup','pointercancel','lostpointercapture'].forEach((type) => hud.addEventListener(type, () => {
      if (axisDrag && engine?.commitHistory) engine.commitHistory(`Moved ${engine.selectedObject()?.name || 'Selection'} on ${axisDrag.axis.toUpperCase()} axis`, 'axis-drag');
      axisDrag = null;
    }));
  }

  function initInputs() {
    $('loadSampleBtn').addEventListener('click', () => engine.loadSample('cube'));
    $('addLightBtn').addEventListener('click', () => engine.addLight());
    $('resetCameraBtn').addEventListener('click', () => { engine.resetCamera(); engine.emitChange('camera-reset'); });
    $('frameObjectBtn').addEventListener('click', () => { engine.frameSelected(); engine.emitChange('frame-selected'); });
    $('duplicateBtn').addEventListener('click', () => engine.duplicateSelected());
    $('deleteBtn').addEventListener('click', () => engine.deleteSelected());
    $('clearSceneBtn').addEventListener('click', () => engine.clearScene());
    $('refreshSceneBtn').addEventListener('click', refreshAll);
    $('saveProjectBtn').addEventListener('click', () => engine.saveProject());
    $('renderExportBtn').addEventListener('click', () => openOverlay('exportOverlay'));
    $('undoBtn').addEventListener('click', () => engine.undo());
    $('redoBtn').addEventListener('click', () => engine.redo());

    document.querySelectorAll('.transform-mode').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('.transform-mode').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      engine.setTransformMode(button.dataset.transformMode);
    }));
    document.querySelectorAll('.nudge-button').forEach((button) => button.addEventListener('click', () => {
      const [axis, amount] = String(button.dataset.nudge || '').split(':');
      engine.nudgeSelected(axis, Number(amount));
    }));
    $('applyTransformBtn').addEventListener('click', () => engine.setSelectedTransform({
      name: $('selectedObjectNameInput').value,
      px: $('posXInput').value, py: $('posYInput').value, pz: $('posZInput').value,
      rx: $('rotXInput').value, ry: $('rotYInput').value, rz: $('rotZInput').value,
      sx: $('scaleXInput').value, sy: $('scaleYInput').value, sz: $('scaleZInput').value
    }));
    $('resetTransformBtn').addEventListener('click', () => engine.resetSelectedTransform());
    $('centerSelectedBtn').addEventListener('click', () => engine.centerSelected());
    $('fitAllBtn').addEventListener('click', () => engine.frameAll());
    $('exportSceneManifestBtn').addEventListener('click', () => {
      const manifest = engine.serialize();
      downloadJson(`RENDERit_scene_manifest_${new Date().toISOString().slice(0,10)}.json`, manifest);
      setStatus('Exported scene manifest.');
    });

    document.querySelectorAll('.preset-card').forEach((button) => button.addEventListener('click', () => engine.loadSample(button.dataset.preset)));

    $('modelInput').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { await engine.importModel(file); }
      catch (error) { setStatus(`Import failed: ${error.message}`); }
      event.target.value = '';
    });

    $('projectInput').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try { engine.loadProject(JSON.parse(await file.text())); }
      catch (error) { setStatus(`Project load failed: ${error.message}`); }
      event.target.value = '';
    });

    $('hdriInput').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      setStatus(`Registered local environment asset: ${file.name}. V1.0.5 stores local HDRI references for offline workflow tracking.`);
      event.target.value = '';
    });

    ['roughnessInput','metalnessInput','clearcoatInput','transmissionInput','exposureInput','envStrengthInput','floorReflectionInput'].forEach((id) => $(id).addEventListener('input', () => {
      updateRangeLabels();
      engine.exposure = Number($('exposureInput').value);
      engine.environment.strength = Number($('envStrengthInput').value);
      engine.floorReflection = Number($('floorReflectionInput').value);
      engine.emitChange('viewport-params');
    }));

    $('applyMaterialBtn').addEventListener('click', () => {
      engine.updateSelectedMaterial({
        color: window.RENDERitMaterials.hexToRgb($('albedoInput').value),
        roughness: Number($('roughnessInput').value),
        metalness: Number($('metalnessInput').value),
        clearcoat: Number($('clearcoatInput').value),
        transmission: Number($('transmissionInput').value)
      });
      setStatus('Updated selected material parameters.');
    });

    $('openMaterialEditorBtn').addEventListener('click', () => openMaterialEditor(engine.selectedObject()?.material?.id || selectedMaterialId));
    $('newMaterialBtn').addEventListener('click', () => openMaterialEditor(null, true));
    $('pbrMaterialBtn').addEventListener('click', () => openMaterialEditor(null, true));
    $('editMaterialBtn').addEventListener('click', () => openMaterialEditor(selectedMaterialId));
    $('exportMaterialsBtn').addEventListener('click', () => { window.RENDERitMaterials.exportMaterialLibrary(); setStatus('Exported material library.'); });
    $('materialCloseBtn').addEventListener('click', () => closeOverlay('materialOverlay'));
    $('saveMaterialEditorBtn').addEventListener('click', () => { saveMaterialFromEditor(); closeOverlay('materialOverlay'); refreshAll(); });
    $('applyEditorMaterialBtn').addEventListener('click', () => { const material = saveMaterialFromEditor(); engine.applyMaterial(material.id); closeOverlay('materialOverlay'); refreshAll(); });
    $('deleteMaterialEditorBtn').addEventListener('click', deleteMaterialFromEditor);

    [['mapAlbedoInput','albedo'], ['mapNormalInput','normal'], ['mapRoughnessInput','roughness'], ['mapMetalnessInput','metalness'], ['mapEmissiveInput','emissive']].forEach(([id, key]) => {
      $(id).addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (file) textureState[key] = file.name;
        updateTextureSummary();
      });
    });

    $('newEnvironmentBtn').addEventListener('click', () => openEnvironmentEditor(null, true));
    $('editEnvironmentBtn').addEventListener('click', () => openEnvironmentEditor(engine.environment?.id || selectedEnvironmentId));
    $('openEnvironmentStudioBtn').addEventListener('click', () => openEnvironmentEditor(engine.environment?.id || selectedEnvironmentId));
    $('exportEnvironmentsBtn').addEventListener('click', () => { window.RENDERitMaterials.exportEnvironmentLibrary(); setStatus('Exported environment library.'); });
    $('environmentCloseBtn').addEventListener('click', () => closeOverlay('environmentOverlay'));
    $('saveEnvironmentEditorBtn').addEventListener('click', () => { saveEnvironmentFromEditor(); closeOverlay('environmentOverlay'); refreshAll(); });
    $('applyEnvironmentEditorBtn').addEventListener('click', () => { const environment = saveEnvironmentFromEditor(); engine.setEnvironment(environment.id); closeOverlay('environmentOverlay'); refreshAll(); });
    $('deleteEnvironmentEditorBtn').addEventListener('click', () => {
      const id = $('environmentEditId').value;
      const name = window.RENDERitMaterials.environments[id]?.name || 'Environment';
      if (window.RENDERitMaterials.deleteEnvironment(id)) {
        selectedEnvironmentId = 'lunarLab';
        engine.setEnvironment('lunarLab');
        closeOverlay('environmentOverlay');
        refreshAll();
        setStatus(`Deleted environment: ${name}.`);
        if (engine?.commitHistory) engine.commitHistory(`Deleted environment: ${name}`, 'environment-library');
      }
    });

    $('groundToggle').addEventListener('change', () => { engine.groundVisible = $('groundToggle').checked; engine.emitChange('ground-toggle'); });
    $('gridToggle').addEventListener('change', () => { engine.gridVisible = $('gridToggle').checked; engine.emitChange('grid-toggle'); });
    $('selectGroundBtn').addEventListener('click', () => engine.selectObject('ground-plane'));
    $('selectGroundEditorBtn').addEventListener('click', () => { engine.selectObject('ground-plane'); closeOverlay('groundOverlay'); });
    $('openGroundStudioBtn').addEventListener('click', () => { refreshGroundPanel(); openOverlay('groundOverlay'); });
    $('openGroundStudioBtnRight').addEventListener('click', () => { refreshGroundPanel(); openOverlay('groundOverlay'); });
    $('groundCloseBtn').addEventListener('click', () => closeOverlay('groundOverlay'));
    $('groundTextureInput').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) engine.setGroundTexture(file, $('groundRepeatEditor').value);
      event.target.value = '';
    });
    $('applyGroundEditorBtn').addEventListener('click', () => {
      engine.setGroundMaterial({
        color: window.RENDERitMaterials.hexToRgb($('groundColorEditor').value),
        roughness: clamp($('groundRoughnessEditor').value, 0.03, 1),
        metalness: clamp($('groundMetalnessEditor').value, 0, 1),
        clearcoat: engine.floorReflection
      });
      engine.groundTextureRepeat = clamp($('groundRepeatEditor').value, 1, 64);
      closeOverlay('groundOverlay');
      setStatus('Updated ground plane material.');
    });

    $('applyEnvironmentQuickBtn').addEventListener('click', () => {
      engine.environment.top = window.RENDERitMaterials.hexToRgb($('envTopQuick').value);
      engine.environment.horizon = window.RENDERitMaterials.hexToRgb($('envHorizonQuick').value);
      engine.environment.ground = window.RENDERitMaterials.hexToRgb($('envGroundQuick').value);
      engine.emitChange('environment-quick-colors');
      setStatus('Updated environment quick colors.');
    });

    $('applyCameraBtn').addEventListener('click', () => engine.updateCamera({
      fov: $('cameraFovInput').value, distance: $('cameraDistanceInput').value, pitch: $('cameraPitchInput').value, yaw: $('cameraYawInput').value
    }));
    $('resetCameraPanelBtn').addEventListener('click', () => { engine.resetCamera(); engine.emitChange('camera-reset'); });
    document.querySelectorAll('[data-camera-view]').forEach((button) => button.addEventListener('click', () => engine.setCameraView(button.dataset.cameraView))); 

    $('exportCloseBtn').addEventListener('click', () => closeOverlay('exportOverlay'));
    $('exportPreset').addEventListener('change', applyExportPreset);
    $('exportAspect').addEventListener('change', () => syncExportAspect('width'));
    $('exportWidth').addEventListener('input', () => syncExportAspect('width'));
    $('exportHeight').addEventListener('input', () => syncExportAspect('height'));
    $('runRenderExportBtn').addEventListener('click', () => {
      engine.exportRender({ width: $('exportWidth').value, height: $('exportHeight').value, type: $('exportFormat').value, quality: $('exportQuality').value });
      closeOverlay('exportOverlay');
    });
    $('quickScreenshotBtn').addEventListener('click', () => { engine.screenshot(); closeOverlay('exportOverlay'); });

    ['exportOverlay','materialOverlay','environmentOverlay','groundOverlay'].forEach((id) => {
      $(id).addEventListener('click', (event) => { if (event.target === $(id)) closeOverlay(id); });
    });
    document.addEventListener('keydown', (event) => {
      const key = event.key.toLowerCase();
      const editable = ['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName) || event.target?.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && !editable && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        engine.undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !editable && (key === 'y' || (key === 'z' && event.shiftKey))) {
        event.preventDefault();
        engine.redo();
        return;
      }
      if (event.key === 'Escape') ['exportOverlay','materialOverlay','environmentOverlay','groundOverlay'].forEach(closeOverlay);
    });

    updateRangeLabels();
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.RENDERitUI.initTabs();
    window.RENDERitUI.initMarkdownModals();
    try {
      engine = new window.RENDERitEngine($('renderViewport'), { status: setStatus });
      window.RENDERit = engine;
      $('rendererBadge').textContent = 'WebGL2';
      engine.addEventListener('change', (event) => scheduleRefresh(event.detail?.reason || 'change'));
      engine.addEventListener('historychange', refreshHistory);
      initViewportHudInteractions();
      initDragDrop();
      initInputs();
      refreshAll();
      setStatus('RENDERit V1.0.5 initialized. Offline viewport is ready.');
    } catch (error) {
      $('rendererBadge').textContent = 'Unavailable';
      setStatus(`Renderer initialization failed: ${error.message}`);
      console.error(error);
    }
  });
}());
