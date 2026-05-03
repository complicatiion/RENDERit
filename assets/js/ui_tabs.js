/* RENDERit V1.0.5 · UI tabs and glass documentation modals */
(function () {
  'use strict';

  function markdownToHtml(markdown) {
    const esc = (value) => String(value).replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]));
    const lines = String(markdown || '').split(/\r?\n/);
    let html = '';
    let inList = false;
    let inCode = false;
    for (const raw of lines) {
      const line = raw.replace(/\t/g, '  ');
      if (line.trim().startsWith('```')) { html += inCode ? '</code></pre>' : '<pre><code>'; inCode = !inCode; continue; }
      if (inCode) { html += `${esc(line)}\n`; continue; }
      if (/^###\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h3>${esc(line.replace(/^###\s+/, ''))}</h3>`; continue; }
      if (/^##\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h2>${esc(line.replace(/^##\s+/, ''))}</h2>`; continue; }
      if (/^#\s+/.test(line)) { if (inList) { html += '</ul>'; inList = false; } html += `<h1>${esc(line.replace(/^#\s+/, ''))}</h1>`; continue; }
      if (/^[-*]\s+/.test(line)) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${esc(line.replace(/^[-*]\s+/, '')).replace(/`([^`]+)`/g, '<code>$1</code>')}</li>`; continue; }
      if (line.trim() === '') { if (inList) { html += '</ul>'; inList = false; } continue; }
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${esc(line).replace(/`([^`]+)`/g, '<code>$1</code>')}</p>`;
    }
    if (inList) html += '</ul>';
    if (inCode) html += '</code></pre>';
    return html;
  }

  function initTabs() {
    document.querySelectorAll('.tab-button').forEach((button) => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        document.querySelectorAll('.tab-button').forEach((b) => b.classList.toggle('active', b === button));
        document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.toggle('active', pane.id === `tab-${tab}`));
      });
    });
  }

  const controlsMarkdown = `# Controls Overview

## Viewport Navigation
- Hold \`Alt\` + left mouse button and drag to orbit around the scene.
- Hold \`Alt\` + middle mouse button and drag to pan.
- Hold \`Alt\` + right mouse button and drag to dolly in or out.
- Use the mouse wheel for quick zoom.
- Click an object in the viewport or in the Object Manager to select it.

## Transform Toolbar
- Select mode: normal object picking.
- Move mode: drag the selected mesh in screen space.
- Rotate mode: drag left/right or up/down to rotate the selected mesh.
- Scale mode: drag to scale the selected mesh.
- Use the X/Y/Z nudge buttons for small position steps.
- Use the Object Transform card for exact numeric values.

## Ground Plane
- Select the Ground Plane from the Object Manager or Ground Plane card.
- Use Ground Studio to load a local floor texture and adjust repeat, color, roughness and metalness.

## Camera
- Use the Camera tab for FOV, distance, yaw, pitch and view presets.
- Use Frame Selected or Frame All Objects to quickly re-center the view.

## Scene Workflow
- Drag a material from the Library onto the viewport to assign it to the selected object.
- Use Render Export for a clean image output with fixed resolution settings.
- Use Material Studio to create, edit, delete and export PBR-style materials.
- Use Environment Studio to edit HDRI-style lighting presets.
`;

  const docsFallback = `# RENDERit Documentation

RENDERit is running in offline mode. Start the local server and open this dialog again if the documentation file cannot be loaded from the file system.

- Import OBJ or ASCII STL models.
- Assign materials from the left Library.
- Manage objects in the Object Manager.
- Export renders from the Render Export dialog.
`;

  const notesFallback = `# RENDERit Notes

No local notes file could be loaded. Place release notes in \`assets/NOTES.md\` and start the app through the local server.`;

  function initMarkdownModals() {
    const overlay = document.getElementById('infoOverlay');
    const content = document.getElementById('modalContent');
    const title = document.getElementById('modalTitle');
    const kicker = document.getElementById('modalKicker');
    const closeBtn = document.getElementById('modalCloseBtn');

    async function openMarkdownModal(options) {
      overlay.hidden = false;
      overlay.setAttribute('aria-hidden', 'false');
      title.textContent = options.title;
      kicker.textContent = options.kicker;
      if (options.markdown) {
        content.innerHTML = markdownToHtml(options.markdown);
        return;
      }
      try {
        const response = await fetch(options.url, { cache: 'no-store' });
        if (!response.ok) throw new Error('Markdown file could not be loaded.');
        content.innerHTML = markdownToHtml(await response.text());
      } catch (error) {
        content.innerHTML = markdownToHtml(options.fallback || docsFallback);
      }
    }

    function closeModal() {
      overlay.hidden = true;
      overlay.setAttribute('aria-hidden', 'true');
    }

    document.getElementById('controlsBtn')?.addEventListener('click', () => openMarkdownModal({ title: 'Controls Overview', kicker: 'Viewport Controls', markdown: controlsMarkdown }));
    document.getElementById('docsBtn')?.addEventListener('click', () => openMarkdownModal({ title: 'RENDERit Documentation', kicker: 'Internal Documentation', url: './assets/Documentation.md', fallback: docsFallback }));
    document.getElementById('notesBtn')?.addEventListener('click', () => openMarkdownModal({ title: 'RENDERit Notes', kicker: 'Release Notes', url: './assets/NOTES.md', fallback: notesFallback }));
    closeBtn?.addEventListener('click', closeModal);
    overlay?.addEventListener('click', (event) => { if (event.target === overlay) closeModal(); });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !overlay.hidden) closeModal(); });
  }

  window.RENDERitUI = { initTabs, initMarkdownModals, markdownToHtml };
}());
