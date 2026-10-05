function addRow(id) {
  const box = document.getElementById(id);
  const row = box.firstElementChild.cloneNode(true);
  row.querySelectorAll('input, textarea').forEach(i => (i.value = ''));
  box.appendChild(row);
}

function removeRow(btn) {
  const row = btn.closest('.row-item');
  const box = row.parentElement;
  if (box.children.length > 1) row.remove();
  else row.querySelectorAll('input, textarea').forEach(i => (i.value = ''));
}


(function () {
  const input = document.getElementById('photo');
  if (!input) return;

  const MAX_MB = Number(input.dataset.maxMb) || 5;
  const MAX_BYTES = MAX_MB * 1024 * 1024;
  const preview = document.getElementById('photoPreview');
  const removeBtn = document.getElementById('removePhotoBtn');
  const removeFlag = document.getElementById('removePhoto');
  const msg = document.getElementById('photoMsg');

  function showPreview(src) {
    preview.src = src;
    preview.style.display = 'block';
    removeBtn.style.display = 'inline-block';
  }

  function hidePreview() {
    preview.removeAttribute('src');
    preview.style.display = 'none';
    removeBtn.style.display = 'none';
  }

  
  function shrink(file) {
    return new Promise(resolve => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  input.addEventListener('change', async () => {
    const file = input.files[0];
    msg.textContent = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      msg.textContent = 'Please choose an image file (JPG, PNG or WEBP).';
      input.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      msg.textContent = 'That photo is ' + (file.size / 1048576).toFixed(1) +
        'MB. The maximum is ' + MAX_MB + 'MB. Please choose a smaller photo.';
      input.value = '';
      return;
    }

    removeFlag.value = '0';
    let shown = file;
    const blob = await shrink(file);
    if (blob) {
      try {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
        input.files = dt.files;
        shown = blob;
      } catch (err) {  }
    }
    showPreview(URL.createObjectURL(shown));
  });

  removeBtn.addEventListener('click', () => {
    input.value = '';
    hidePreview();
    removeFlag.value = '1';
    msg.textContent = 'The photo will be removed when you save.';
  });
})();