const textarea = document.getElementById('editor-textarea');
const titleInput = document.getElementById('note-title-input');
const categoryInput = document.getElementById('note-category-input');
const saveStatus = document.getElementById('save-status');
const wordCountEl = document.getElementById('word-count');
const searchBar = document.getElementById('search-bar');
const noteListContainer = document.getElementById('note-list');

const newNoteBtn = document.getElementById('new-note-btn');
const saveBtn = document.getElementById('save-btn');
const saveAsBtn = document.getElementById('save-as-btn');
const openFileBtn = document.getElementById('open-file-btn');
const pinBtn = document.getElementById('pin-btn');
const fontIncBtn = document.getElementById('font-inc-btn');
const fontDecBtn = document.getElementById('font-dec-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');

let notes = [];
let activeNoteId = null;
let appSettings = { fontSize: 16, darkMode: false };
let debounceTimer = null;

let lastSavedText = '';
let lastSavedTitle = '';
let lastSavedCategory = '';

document.addEventListener('DOMContentLoaded', async () => {
  notes = await window.electronAPI.getNotes();
  appSettings = await window.electronAPI.getSettings();

  applySettingsUI();
  
  if (notes.length > 0) {
    sortNotes();
    loadNote(notes[0].id);
  } else {
    initBlankNote();
  }

  function updateWordCount() {
    const text = textarea.value.trim();
    const chars = text.length;
    const words = text === '' ? 0 : text.split(/\s+/).length;
    wordCountEl.textContent = `Words: ${words} | Characters: ${chars}`;
  }

  function hasUnsavedChanges() {
    return textarea.value !== lastSavedText || 
           titleInput.value !== lastSavedTitle ||
           categoryInput.value !== lastSavedCategory;
  }

  function updateSaveAnchors() {
    lastSavedText = textarea.value;
    lastSavedTitle = titleInput.value;
    lastSavedCategory = categoryInput.value;
  }

  function renderNoteList(filter = '') {
    noteListContainer.innerHTML = '';
    const query = filter.toLowerCase().trim();

    notes.forEach(note => {
      const matchTitle = (note.title || '').toLowerCase().includes(query);
      const matchContent = (note.content || '').toLowerCase().includes(query);
      
      if (filter && !matchTitle && !matchContent) return;

      const li = document.createElement('li');
      li.className = `note-item ${note.id === activeNoteId ? 'active' : ''}`;
      
      const catTag = note.category ? `<span class="category-badge">${note.category}</span>` : '';
      const pinIndicator = note.pinned ? `<span class="pin-badge">📌</span>` : '';

      li.innerHTML = `
        <div class="note-title-text">${note.title || 'Untitled Note'}</div>
        <div class="note-meta">${pinIndicator}${catTag} Mod: ${new Date(note.updatedAt).toLocaleTimeString()}</div>
        <button class="delete-btn" data-id="${note.id}">Delete</button>
      `;

      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) return;
        switchNoteHandle(note.id);
      });

      const deleteBtn = li.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteNoteRecord(note.id);
      });

      noteListContainer.appendChild(li);
    });
  }

  function sortNotes() {
    notes.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  }

  function loadNote(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;

    activeNoteId = id;
    titleInput.value = note.title || '';
    categoryInput.value = note.category || '';
    textarea.value = note.content || '';
    
    updateSaveAnchors();
    updateWordCount();
    saveStatus.textContent = "No changes - already saved";
    renderNoteList(searchBar.value);
  }

  function initBlankNote() {
    activeNoteId = 'note_' + Date.now();
    titleInput.value = '';
    categoryInput.value = '';
    textarea.value = '';
    updateSaveAnchors();
    updateWordCount();
    saveStatus.textContent = "New blank note created";
    renderNoteList(searchBar.value);
  }

  async function switchNoteHandle(targetId) {
    if (hasUnsavedChanges()) {
      const discardAllowed = await window.electronAPI.confirmNewNote();
      if (!discardAllowed) return;
    }
    loadNote(targetId);
  }

  async function saveCurrentNoteState() {
    if (!hasUnsavedChanges()) {
      saveStatus.textContent = "No changes - already saved";
      return;
    }

    const index = notes.findIndex(n => n.id === activeNoteId);
    const timeStamp = new Date().toISOString();
    
    const notePayload = {
      id: activeNoteId,
      title: titleInput.value.trim() || 'Untitled Note',
      content: textarea.value,
      category: categoryInput.value.trim(),
      pinned: index !== -1 ? notes[index].pinned : false,
      updatedAt: timeStamp
    };

    if (index !== -1) {
      notes[index] = notePayload;
    } else {
      notes.push(notePayload);
    }

    sortNotes();
    await window.electronAPI.saveNotes(notes);
    updateSaveAnchors();
    
    const displayTime = new Date().toLocaleTimeString();
    saveStatus.textContent = `Auto-saved at ${displayTime}`;
    renderNoteList(searchBar.value);
  }

  async function deleteNoteRecord(id) {
    notes = notes.filter(n => n.id !== id);
    await window.electronAPI.saveNotes(notes);
    
    if (activeNoteId === id) {
      if (notes.length > 0) {
        loadNote(notes[0].id);
      } else {
        initBlankNote();
      }
    } else {
      renderNoteList(searchBar.value);
    }
  }

  function triggerChangeDebounce() {
    saveStatus.textContent = "Typing...";
    updateWordCount();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(saveCurrentNoteState, 5000);
  }

  textarea.addEventListener('input', triggerChangeDebounce);
  titleInput.addEventListener('input', triggerChangeDebounce);
  categoryInput.addEventListener('input', triggerChangeDebounce);

  saveBtn.addEventListener('click', async () => {
    await saveCurrentNoteState();
    new Notification('Note Saved Successfully', {
      body: `"${titleInput.value || 'Untitled'}" written securely to storage array.`
    });
  });

  saveAsBtn.addEventListener('click', async () => {
    const rawContent = `Title: ${titleInput.value}\nCategory: ${categoryInput.value}\n\n${textarea.value}`;
    const targetExportPath = await window.electronAPI.saveAs(rawContent);
    if (targetExportPath) {
      saveStatus.textContent = `Successfully exported directly to external node path: ${targetExportPath}`;
    }
  });

  openFileBtn.addEventListener('click', async () => {
    const fileData = await window.electronAPI.openFile();
    if (fileData) {
      if (hasUnsavedChanges()) {
        const discardAllowed = await window.electronAPI.confirmNewNote();
        if (!discardAllowed) return;
      }
      activeNoteId = 'note_' + Date.now();
      titleInput.value = "Imported: " + fileData.filePath.split(/[\\/]/).pop();
      categoryInput.value = "External Drive File";
      textarea.value = fileData.content;
      updateSaveAnchors();
      updateWordCount();
      saveStatus.textContent = `Loaded file: ${fileData.filePath}`;
      await saveCurrentNoteState();
    }
  });

  newNoteBtn.addEventListener('click', async () => {
    if (hasUnsavedChanges()) {
      const discardAllowed = await window.electronAPI.confirmNewNote();
      if (!discardAllowed) return;
    }
    initBlankNote();
  });

  pinBtn.addEventListener('click', async () => {
    const index = notes.findIndex(n => n.id === activeNoteId);
    if (index !== -1) {
      notes[index].pinned = !notes[index].pinned;
      sortNotes();
      await window.electronAPI.saveNotes(notes);
      renderNoteList(searchBar.value);
    }
  });

  searchBar.addEventListener('input', () => {
    renderNoteList(searchBar.value);
  });

  fontIncBtn.addEventListener('click', () => adjustFontSize(2));
  fontDecBtn.addEventListener('click', () => adjustFontSize(-2));

  async function adjustFontSize(delta) {
    let targetSize = appSettings.fontSize + delta;
    appSettings.fontSize = Math.min(102, Math.max(10, targetSize));
    
    textarea.style.fontSize = `${appSettings.fontSize}px`;
    await window.electronAPI.saveSettings(appSettings);
  }

  darkModeToggle.addEventListener('click', async () => {
    appSettings.darkMode = !appSettings.darkMode;
    applySettingsUI();
    await window.electronAPI.saveSettings(appSettings);
  });

  function applySettingsUI() {
    textarea.style.fontSize = `${appSettings.fontSize}px`;
    if (appSettings.darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  window.electronAPI.onMenuNewNote(() => { initBlankNote(); });
  window.electronAPI.onMenuOpenFile(async () => { openFileBtn.click(); });
  window.electronAPI.onMenuSave(async () => { saveBtn.click(); });
  window.electronAPI.onMenuSaveAs(async () => { saveAsBtn.click(); });
});

