
document.addEventListener('DOMContentLoaded', () => {
  
  const page = window.location.pathname.split('/').pop().toLowerCase();
  const contactCountElement = document.getElementById('contact-count');
 
  async function displayContactCount() {
    if (contactCountElement) {
        try {
            const res = await fetch('/api/contacts/count');
            if (!res.ok){
              throw new Error('Failed to get contact count');
            }
            const data = await res.json();
            contactCountElement.textContent = `Total Contacts: ${data.totalContacts}`;
        } catch (error) {
            console.error('Error getting contact count:', error);
            contactCountElement.textContent = "Error loading count";
        }
    } else {
        console.error('ID "contact-count" not found.');
    }
}
  if (page === '' || page === 'login.html') {

    initLogin();

  } else if (page === 'dashboard.html') {

    displayContactCount()
    initDashboard(displayContactCount);

  } else if (page === 'addcontact.html') {

    initAddContact();

  } else if (page === 'edit.html') {

    initEditContact();

  } else if (page === 'account.html') {

    initAccountSettings();

  }
});


// Login
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok){
        throw new Error('Login failed');
      }
      const { user_id } = await res.json();
      localStorage.setItem('user_id', user_id);
      window.location = 'dashboard.html';
    } catch (err) {

      alert(err.message);
    }
  });
}


// Dashboard
async function initDashboard(updateCountCallback) {
  const user_id = localStorage.getItem('user_id');
  if (!user_id) {
      window.location = 'login.html';
      return;
  }

  const tbody = document.querySelector('.contact-table tbody');
  const search = document.getElementById('search');
  const sort = document.getElementById('sort');

  async function load() {
      try {
          const res = await fetch(`/api/contacts?user_id=${user_id}`);
          if (!res.ok){

            throw new Error('Fetch failed');
          }
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
        <td>${c.phone_number || ''}</td>
        <td>${c.email_address || ''}</td>
      `;
              tbody.appendChild(tr);
          });
      } catch (err) {

          console.error(err);
          tbody.innerHTML = '<tr><td colspan="5">Error loading.</td></tr>';
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
          .sort((a, b) => {
              const A = a.cells[0].textContent.trim().toLowerCase();
              const B = b.cells[0].textContent.trim().toLowerCase();
              return asc ? A.localeCompare(B) : B.localeCompare(A);
          })
          .forEach(r => tbody.appendChild(r));
  });

  tbody.addEventListener('click', async e => {
      if (e.target.tagName !== 'BUTTON'){

        return;
      }
      const id = e.target.dataset.id;
      if (e.target.classList.contains('edit')) {

          window.location = `edit.html?id=${id}`;
      } else if (e.target.classList.contains('delete')) {
          if (!confirm('Delete this contact?')){

             return;
          }
          const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
          if (!res.ok){

            return alert('Delete failed');
          }
          e.target.closest('tr').remove();
          updateCountCallback?.(); 
      }
  });
}


// Add Contact
function initAddContact(updateCountCallback) {
  

  const form = document.querySelector('.edit-form');
  const user_id = localStorage.getItem('user_id');
  if (!form || !user_id) {
      window.location = 'login.html';
      return;
  }

  form.addEventListener('submit', async e => {
      e.preventDefault();
      const type = document.getElementById('contact-type').value.toLowerCase();
      let details = {};
      const address_line = form['address']?.value.trim() || null;
    const city = form['city']?.value.trim() || null;
    const state = form['state']?.value.trim() || null;
    const zip = form['zip-code']?.value.trim() || null;
    const address = { address_line, city, state, zip };

      if (type === 'person') {
          const first = form['first-name'].value.trim();
          const last = form['last-name'].value.trim();
          const byear = form['birth-year']?.value || null;
          if (!first || !last) {
              return alert('First & last required');
          }
          details = { first_name: first, last_name: last, birth_year: byear, address};
      } else {
          const orgName = form['org-name'].value.trim();
          const orgYear = form['org-year']?.value || null;
          const industry = form['industry'].value.trim();
          if (!orgName) {
              return alert('Organization name required');
          }
          details = { org_name: orgName, org_year: orgYear, industry, address};
      }

      details.phone_number = document.getElementById('phone-number').value.trim();
      details.phone_type = document.getElementById('phone-type').value;
      details.email_address = document.getElementById('email-address').value.trim();
      details.email_type = document.getElementById('email-type').value;

      try {
          const res = await fetch('/api/contacts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id, type, details })
          });
          if (!res.ok){

            throw new Error('Add failed');
          }
          alert('Contact added.');
          window.location = 'dashboard.html';
          updateCountCallback?.(); 
      } catch (err) {

          alert(err.message);
      }
  });
}


// Edit Contact
async function initEditContact() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const form = document.querySelector('.edit-form');
  const user_id = localStorage.getItem('user_id');
  if (!form || !id || !user_id) {

    window.location = 'login.html';
    return;
  }

  // Load contact details
  try {
    const res = await fetch(`/api/contacts?user_id=${user_id}`);
    if (!res.ok){
      
      throw new Error('Fetch failed');
    }
    const list = await res.json();
    const c = list.find(x => String(x.contact_id) === id);
    if (!c){

      throw new Error('Contact not found');
    }
    const [first, ...rest] = c.name.split(' ');
    form['first-name'].value = first;
    form['last-name'].value  = rest.join(' ');
    document.getElementById('contact-type').value = c.type;
    document.getElementById('phone-number').value = c.phone_number || '';
    document.getElementById('phone-type').value = c.phone_type || 'mobile';
    document.getElementById('email-address').value = c.email_address || '';
    document.getElementById('email-type').value = c.email_type || 'personal';

    form['address'].value = c.address?.address_line || '';
    form['city'].value = c.address?.city || '';
    form['state'].value = c.address?.state || '';
    form['zip-code'].value = c.address?.zip || '';
  } catch (err) {
    console.error(err);
    alert('Couldn’t load contact.');
    window.location = 'dashboard.html';
    return;
  }

  // Save updates
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const type = document.getElementById('contact-type').value.toLowerCase();
    let details = {};

    if (type === 'person') {
      const first = form['first-name'].value.trim();
      const last = form['last-name'].value.trim();
      if (!first || !last){

        return alert('First & last required');
      }

      details = { first_name: first, last_name: last, birth_year: null };
    } 
    else {

      details = { org_name: '', org_year: null, industry: '' };
    }

    details.phone_number = document.getElementById('phone-number').value.trim();
    details.phone_type = document.getElementById('phone-type').value;
    details.email_address = document.getElementById('email-address').value.trim();
    details.email_type = document.getElementById('email-type').value;

    try {

      const res = await fetch(`/api/contacts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, details })
      });
      if (!res.ok){

        throw new Error('Update failed');
      }
      alert('Contact updated.');
      window.location = 'dashboard.html';
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  });

  // Cancel button
  form.querySelectorAll('button[type="button"]').forEach(btn => {
    if (/cancel/i.test(btn.textContent)) {
      btn.addEventListener('click', () => window.location = 'dashboard.html');
    }
  });
}


// Account Settings
function initAccountSettings() {
  const form = document.querySelector('.edit-form');
  if (!form) {

    window.location = 'login.html';
    return;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const newPassword     = document.getElementById('new-password').value;
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
        window.location = 'dashboard.html';
      } else {

        alert(data.error || 'Failed to change password.');
      }
    } catch (error) {

      console.error('Error changing password:', error);
      alert('Error while changing password.');
    }
  });
}