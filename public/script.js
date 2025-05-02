
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop().toLowerCase();
  if (page === '' || page === 'login.html')      initLogin();
  else if (page === 'dashboard.html')            initDashboard();
  else if (page === 'addcontact.html')           initAddContact();
  else if (page === 'edit.html')                 initEditContact();
  else if (page === 'account.html')              initAccountSettings();
});


// 1) LOGIN

function initLogin() {
  const form = document.querySelector('.login-container form');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    if (!username || !password) {
      return alert('Enter both username and password.');
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('Login failed');
      const { user_id } = await res.json();
      localStorage.setItem('user_id', user_id);
      window.location = 'dashboard.html';
    } catch(err) {
      alert(err.message);
    }
  });
}


// 2) DASHBOARD

async function initDashboard() {
  const user_id = localStorage.getItem('user_id');
  if (!user_id) return window.location = 'login.html';

  const tbody = document.querySelector('.contact-table tbody');
  const search = document.getElementById('search');
  const sort = document.getElementById('sort');

  async function load() {
    try {
      const res = await fetch(`/api/contacts?user_id=${user_id}`);
      if (!res.ok) throw new Error('Fetch failed');
      const list = await res.json();
      tbody.innerHTML = '';
      list.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
  <td>${c.name}</td>
  <td>${c.type}</td>
  <td class="actions">
    <button data-id="${c.contact_id}" class="edit">Edit</button>
    <button data-id="${c.contact_id}" class="delete">X</button>
  </td>
  <td>${c.phone_number  || ''}</td>
  <td>${c.email_address || ''}</td>`;
        tbody.appendChild(tr);
      });
    } catch(err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="2">Error loading.</td></tr>';
    }
  }

  await load();

  search?.addEventListener('input', () => {
    const q = search.value.toLowerCase();
    tbody.querySelectorAll('tr').forEach(r => {
      r.style.display = r.cells[0].textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  sort?.addEventListener('change', () => {
    const asc = sort.value === 'A–Z';
    Array.from(tbody.rows)
      .sort((a,b)=> {
        const A = a.cells[0].textContent.trim().toLowerCase();
        const B = b.cells[0].textContent.trim().toLowerCase();
        return asc ? A.localeCompare(B) : B.localeCompare(A);
      })
      .forEach(r=> tbody.appendChild(r));
  });

  tbody.addEventListener('click', async e => {
    if (e.target.tagName !== 'BUTTON') return;
    const id = e.target.dataset.id;
  
    if (e.target.classList.contains('edit')) {
      window.location = `edit.html?id=${id}`;
    } else if (e.target.classList.contains('delete')) {
      if (!confirm('Delete this contact?')) return;
  
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        return alert('Delete failed');
      }
      // remove just this row
      e.target.closest('tr').remove();
    }
  });
}


// 3) ADD CONTACT

function initAddContact() {
  const form = document.querySelector('.edit-form');
  const user_id = localStorage.getItem('user_id');
  if (!form || !user_id) return window.location = 'login.html';

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const type = document.getElementById('contact-type').value.toLowerCase();
    let details = {};

    if (type === 'person') {
      const first = form['first-name'].value.trim();
      const last  = form['last-name'].value.trim();
      const byear = form['birth-year']?.value || null;
      if (!first || !last) return alert('First & last required');
      details = { first_name: first, last_name: last, birth_year: byear };
    } else {
      const orgName = form['org-name'].value.trim();
      const orgYear = form['org-year']?.value || null;
      const industry= form['industry'].value.trim();
      if (!orgName) return alert('Organization name required');
      details = { org_name: orgName, org_year: orgYear, industry };
    }
    details.phone_number  = document.getElementById('phone-number').value.trim();
    details.phone_type    = document.getElementById('phone-type').value;
    details.email_address = document.getElementById('email-address').value.trim();
    details.email_type    = document.getElementById('email-type').value;
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ user_id, type, details })
      });
      if (!res.ok) throw new Error('Add failed');
      alert('Contact added.');
      window.location = 'dashboard.html';
    } catch(err) {
      alert(err.message);
    }
  });
}


// 4) EDIT CONTACT

async function initEditContact() {
  const params  = new URLSearchParams(window.location.search);
  const id      = params.get('id');
  const form    = document.querySelector('.edit-form');
  const user_id = localStorage.getItem('user_id');
  if (!form || !id || !user_id) return window.location = 'login.html';

  // prefill
  try {
    const res  = await fetch(`/api/contacts?user_id=${user_id}`);
    if (!res.ok) throw new Error('Fetch failed');
    const list = await res.json();
    const c    = list.find(x => String(x.contact_id) === id);
    if (!c) throw new Error('Contact not found');

    // name
    const [first, ...rest]     = c.name.split(' ');
    form['first-name'].value   = first;
    form['last-name'].value    = rest.join(' ');

    // contact type
    document.getElementById('contact-type').value = c.type;

    // phone
    document.getElementById('phone-number').value = c.phone_number  || '';
    document.getElementById('phone-type').value   = c.phone_type    || 'mobile';

    // email
    document.getElementById('email-address').value = c.email_address || '';
    document.getElementById('email-type').value    = c.email_type    || 'personal';

  } catch (err) {
    console.error(err);
    alert('Couldn’t load contact.');
    return window.location = 'dashboard.html';
  }

  // 2)save and PUT back
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const type = document.getElementById('contact-type').value.toLowerCase();
    let details = {};

    if (type === 'person') {
      const first = form['first-name'].value.trim();
      const last  = form['last-name'].value.trim();
      if (!first || !last) return alert('First & last required');
      details = { first_name: first, last_name: last, birth_year: null };
    } else {
      
      details = { org_name: '', org_year: null, industry: '' };
    }

    // phone & email
    details.phone_number  = document.getElementById('phone-number').value.trim();
    details.phone_type    = document.getElementById('phone-type').value;
    details.email_address = document.getElementById('email-address').value.trim();
    details.email_type    = document.getElementById('email-type').value;

    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type':'application/json' },
        body:    JSON.stringify({ type, details })
      });
      if (!res.ok) throw new Error('Update failed');
      alert('Contact updated.');
      window.location = 'dashboard.html';
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });

  // 3) Cancel button
  form.querySelectorAll('button[type="button"]').forEach(btn => {
    if (/cancel/i.test(btn.textContent)) {
      btn.addEventListener('click', () => window.location = 'dashboard.html');
    }
  });
}



// 5) ACCOUNT SETTINGS

function initAccountSettings() {
  const form = document.querySelector('.edit-form');
  if (!form) return window.location = 'login.html';

  form.addEventListener('submit', e => {
    e.preventDefault();
    alert('Account settings saved.');
    window.location = 'dashboard.html';
  });
}

function initAccountSettings() {
  const form = document.querySelector('.edit-form');
  if (!form) return window.location = 'login.html';

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    try {
      const res = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        alert(data.message);
      } else {
        alert(data.error || 'Failed to change password.');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('An error occurred while changing password.');
    }
  });
}