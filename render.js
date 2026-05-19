window.addEventListener('DOMContentLoaded', async () => {
  const textarea = document.getElementById('note');
  const saveBtn = document.getElementById('save');
  const statusEl = document.getElementById('save_status');

  // Load saved note on startup
  const savedNote = await window.electronAPI.loadNote();
  textarea.value = savedNote;

  // Track initial saved content
  let lastSavedText = textarea.value;

  // Manual save
  saveBtn.addEventListener('click', async () => {
    try {
      await window.electronAPI.saveNote(textarea.value);
      lastSavedText = textarea.value;
      alert('Note saved successfully!');
      if (statusEl) statusEl.textContent = 'Manually saved!';
    } catch (err) {
      console.error('Manual save failed:', err);
      if (statusEl) statusEl.textContent = 'Save failed - check console';
    }
  });

  let debounceTimer;

  async function autoSave() {
    const currentText = textarea.value;
    if (currentText === lastSavedText) {
      if (statusEl) statusEl.textContent = 'No changes - already saved';
      return;
    }
    try {
      await window.electronAPI.saveNote(currentText);
      lastSavedText = currentText;
      const now = new Date().toLocaleTimeString();
      if (statusEl) statusEl.textContent = `Auto-saved at ${now}`;
    } catch (err) {
      console.error('Auto-save FAILED:', err);
      if (statusEl) statusEl.textContent = 'Auto-save error - check console';
    }
  }

  // Debounce: save 5 seconds after user stops typing
  textarea.addEventListener('input', () => {
    if (statusEl) statusEl.textContent = 'Changes detected - auto-save in 5s...';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(autoSave, 5000);
  });
});