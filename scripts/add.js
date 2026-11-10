// Shared expense storage and page behaviour. All values stay in this browser.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const categories = ['Food', 'Transport', 'Books', 'Rent', 'Fun', 'Other'];
  const money = value => `${Number(value).toLocaleString()} Lek`;
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  let toastTimer;
  function notify(message) {
    $('toast').textContent = message;
    $('toast').setAttribute('role', 'status');
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4000);
  }
  function readExpenses() {
    const raw = localStorage.getItem('expenses');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Support the single object stored by the original week05 exercise.
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((expense, index) => ({ ...expense, id: String(expense.id ?? `legacy-${index}`), amount: Number(expense.amount) }));
  }
  function saveExpenses(list) {
    try {
      localStorage.setItem('expenses', JSON.stringify(list));
      expenses = list;
      return true;
    } catch {
      notify('Unable to save. Check that browser storage is enabled and has free space.');
      return false;
    }
  }
  let expenses;
  try { expenses = readExpenses(); }
  catch { notify('Saved expenses could not be read. Existing data has been kept.'); return; }
  function validate(form, prefix = '') {
    const fields = ['title', 'amount', 'category', 'date'];
    const value = Object.fromEntries(fields.map(key => [key, $(prefix + key).value.trim()]));
    const errors = {
      title: value.title ? '' : 'Enter a title.',
      amount: Number.isFinite(Number(value.amount)) && Number(value.amount) >= 1 && Number.isInteger(Number(value.amount)) ? '' : 'Enter a whole amount of at least 1 Lek.',
      category: categories.includes(value.category) ? '' : 'Choose a category.',
      date: value.date && $(prefix + 'date').validity.valid ? '' : 'Choose a valid date.'
    };
    let firstInvalid;
    for (const key of fields) {
      const input = $(prefix + key);
      input.classList.toggle('is-invalid', Boolean(errors[key]));
      input.setAttribute('aria-invalid', String(Boolean(errors[key])));
      form.querySelector(`[data-for="${key}"]`).textContent = errors[key];
      if (errors[key] && !firstInvalid) firstInvalid = input;
    }
    if (firstInvalid) { firstInvalid.focus(); return null; }
    return { ...value, amount: Number(value.amount) };
  }
  const clock = () => { if ($('clock')) $('clock').textContent = new Date().toLocaleTimeString(); };
  clock(); setInterval(clock, 1000);
  if ($('expense-form')) {
    $('date').value = today();
    $('expense-form').addEventListener('submit', event => {
      event.preventDefault();
      const value = validate(event.currentTarget);
      if (!value) return;
      const expense = { ...value, id: crypto.randomUUID() };
      if (!saveExpenses([...expenses, expense])) return;
      const item = document.createElement('li');
      item.className = 'list-group-item';
      item.textContent = `${expense.title} — ${money(expense.amount)} · ${expense.category} · ${expense.date}`;
      $('recent-list').prepend(item);
      $('recent').classList.remove('d-none');
      event.currentTarget.reset(); $('date').value = today(); $('title').focus();
      notify('Expense added.');
    });
  }
  function setText(id, value) { if ($(id)) $(id).textContent = value; }
  function render() {
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    setText('stat-count', expenses.length); setText('stat-total', money(total));
    setText('stat-average', money(expenses.length ? Math.round(total / expenses.length) : 0));
    const biggest = expenses.reduce((best, expense) => !best || expense.amount > best.amount ? expense : best, null);
    setText('stat-biggest', biggest ? `${biggest.title} (${money(biggest.amount)})` : 'none');
    setText('stat-latest', expenses.length ? expenses[expenses.length - 1].title : 'none yet');
    if (!$('expense-list')) return;
    const search = $('search').value.trim().toLowerCase();
    const category = $('filter-category').value;
    const visible = expenses.filter(expense => expense.title.toLowerCase().includes(search) && (!category || category === expense.category));
    $('expense-list').replaceChildren();
    for (const expense of visible) {
      const row = document.createElement('tr');
      for (const value of [expense.date, expense.title, expense.category, money(expense.amount)]) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      row.children[3].className = 'text-end';
      const actions = document.createElement('td'); actions.className = 'text-end text-nowrap';
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn btn-sm btn-outline-primary me-2'; edit.textContent = 'Edit'; edit.setAttribute('aria-label', `Edit ${expense.title}`);
      edit.addEventListener('click', () => {
        $('edit-form').reset();
        $('edit-form').querySelectorAll('.is-invalid').forEach(input => input.classList.remove('is-invalid'));
        $('edit-form').querySelectorAll('[aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
        $('edit-id').value = expense.id;
        for (const key of ['title', 'amount', 'category', 'date']) $('edit-' + key).value = expense[key];
        bootstrap.Modal.getOrCreateInstance($('edit-modal')).show();
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn btn-sm btn-outline-danger'; remove.textContent = 'Delete'; remove.setAttribute('aria-label', `Delete ${expense.title}`);
      remove.addEventListener('click', () => {
        if (confirm(`Delete ${expense.title}?`) && saveExpenses(expenses.filter(item => item.id !== expense.id))) { render(); notify('Expense deleted.'); }
      });
      actions.append(edit, remove); row.append(actions); $('expense-list').append(row);
    }
    setText('count', `${visible.length} / ${expenses.length}`);
    $('empty-message').hidden = visible.length > 0;
    if (expenses.length && !visible.length) $('empty-message').textContent = 'No expenses match your search or category.';
    else if (!expenses.length) {
      $('empty-message').replaceChildren(document.createTextNode('No expenses yet. '));
      const link = document.createElement('a'); link.href = 'add.html'; link.textContent = 'Add one'; $('empty-message').append(link);
    }
    $('clear-all').disabled = !expenses.length;
  }
  if ($('expense-list')) {
    $('search').addEventListener('input', render);
    $('filter-category').addEventListener('change', render);
    $('edit-modal').addEventListener('shown.bs.modal', () => $('edit-title').focus());
    $('edit-form').addEventListener('submit', event => {
      event.preventDefault();
      const value = validate(event.currentTarget, 'edit-');
      if (!value) return;
      const id = $('edit-id').value;
      if (!expenses.some(expense => expense.id === id)) { notify('This expense no longer exists.'); return; }
      if (!saveExpenses(expenses.map(expense => expense.id === id ? { ...value, id } : expense))) return;
      bootstrap.Modal.getOrCreateInstance($('edit-modal')).hide(); render(); notify('Expense updated.');
    });
    $('clear-all').addEventListener('click', () => {
      if (confirm('Delete all saved expenses?') && saveExpenses([])) { render(); notify('All expenses deleted.'); }
    });
  }
  window.addEventListener('storage', event => {
    if (event.key === 'expenses' || event.key === null) {
      try { expenses = readExpenses(); render(); } catch { notify('Saved expenses could not be read.'); }
    }
  });
  render();
})();
