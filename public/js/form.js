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