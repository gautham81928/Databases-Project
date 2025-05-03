const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = 3000;

const pool = new Pool({
  user: 'postgres',
  password: 'firehead',
  host: 'localhost',
  database: 'ContactManagerDB',
  port: 5432
});

app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/ping', (req, res) => {
  res.send('pong');
});

const PASSWORD = '1234';
let CURRENT_PASSWORD = PASSWORD;

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {

    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }
  if (password === CURRENT_PASSWORD) {

    res.json({ user_id: 1 });
  } 
  else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

app.post('/api/account/change-password', async (req, res) => {
  const { newPassword, confirmPassword } = req.body;
  if (!newPassword || !confirmPassword) {

    res.status(400).json({ error: 'The new and confirm passwords are required.' });
    return;
  }
  if (newPassword !== confirmPassword) {

    res.status(400).json({ error: 'The new and confirm passwords do not match.' });
    return;
  }
  CURRENT_PASSWORD = newPassword;
  res.json({ success: true, message: 'Password changed successfully.' });
});

app.get('/api/contacts', async (req, res) => {
  const user_id = req.query.user_id;
  if (!user_id) {
    res.status(400).json({ error: 'Missing user_id' });
    return;
  }
  const {rows} = await pool.query(
    `SELECT
       c.contact_id,
       CASE
         WHEN p.first_name IS NOT NULL THEN p.first_name || ' ' || p.last_name
         WHEN o.org_name IS NOT NULL THEN o.org_name
         ELSE ''
       END AS name,
       CASE
         WHEN p.contact_id IS NOT NULL THEN 'Person'
         WHEN o.contact_id IS NOT NULL THEN 'Organization'
         ELSE 'Unknown'
       END AS type,
       ph.phone_number,
       em.email_address,
       a.address_line,
       a.city,
       a.state,
       a.zip
     FROM contact AS c
     LEFT JOIN person AS p ON p.contact_id = c.contact_id
     LEFT JOIN organization AS o ON o.contact_id = c.contact_id
     LEFT JOIN phone AS ph ON ph.contact_id = c.contact_id
     LEFT JOIN email AS em ON em.contact_id = c.contact_id
     LEFT JOIN address AS a ON a.contact_id = c.contact_id
     WHERE c.user_id = $1
     ORDER BY name;`,
    [user_id]
  );
  res.json(rows);
});

app.post('/api/contacts', async (req, res) => {
  console.log('POST /api/contacts - req.body:', req.body);
  const { user_id, type, details } = req.body;
  const client = await pool.connect();
  await client.query('BEGIN');
  const cRes = await client.query(`SELECT MAX(contact_id) AS max_id FROM contact;`);
  const nextContactId = (cRes.rows[0].max_id === null ? 1 : cRes.rows[0].max_id + 1);
  await client.query(
    `INSERT INTO contact (contact_id, user_id)
     VALUES ($1, $2);`,
    [nextContactId, user_id]
  );

  if (type === 'person') {
    const pRes = await client.query(`SELECT MAX(person_id) AS max_id FROM person;`);
    const nextPersonId = (pRes.rows[0].max_id === null ? 1 : pRes.rows[0].max_id + 1);
    await client.query(
      `INSERT INTO person (person_id, contact_id, first_name, last_name, birth_year)
       VALUES ($1,$2,$3,$4,$5);`,
      [
        nextPersonId,
        nextContactId,
        details.first_name,
        details.last_name,
        details.birth_year
      ]
    );
  } else {
    const oRes = await client.query(`SELECT MAX(org_id) AS max_id FROM organization;`);
    const nextOrgId = (oRes.rows[0].max_id === null ? 1 : oRes.rows[0].max_id + 1);
    await client.query(
      `INSERT INTO organization (org_id, contact_id, org_name, industry)
       VALUES ($1,$2,$3,$4);`,
      [
        nextOrgId,
        nextContactId,
        details.org_name,
        details.industry
      ]
    );
  }

  if (details.phone_number) {
    const phRes = await client.query(`SELECT MAX(phone_id) AS max_id FROM phone;`);
    const nextPhoneId = (phRes.rows[0].max_id === null ? 1 : phRes.rows[0].max_id + 1);
    await client.query(
      `INSERT INTO phone (phone_id, contact_id, phone_number, phone_type)
       VALUES ($1,$2,$3,$4);`,
      [
        nextPhoneId,
        nextContactId,
        details.phone_number,
        details.phone_type
      ]
    );
  }

  if (details.email_address) {
    const eRes = await client.query(`SELECT MAX(email_id) AS max_id FROM email;`);
    const nextEmailId = (eRes.rows[0].max_id === null ? 1 : eRes.rows[0].max_id + 1);
    await client.query(
      `INSERT INTO email (email_id, contact_id, email_address, email_type)
       VALUES ($1,$2,$3,$4);`,
      [
        nextEmailId,
        nextContactId,
        details.email_address,
        details.email_type
      ]
    );
  }
  if (details.address_line) {
    const aRes = await client.query(`SELECT MAX(address_id) AS max_id FROM address;`);
    const nextAddressId = (aRes.rows[0].max_id === null ? 1 : aRes.rows[0].max_id + 1);
    await client.query(
      `INSERT INTO address (address_id, contact_id, address_line, city, state, zip)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        nextAddressId,
        nextContactId,
        details.address_line,
        details.city,
        details.state,
        details.zip
      ]
    );
  }

  await client.query('COMMIT');
  client.release();

  res.status(201).json({ contact_id: nextContactId });
});

app.put('/api/contacts/:id', async (req, res) => {
  const contact_id = parseInt(req.params.id, 10);
  const { type, details } = req.body;
  const client = await pool.connect();

  await client.query('BEGIN');

  await client.query(
    `UPDATE contact
       SET updated_at = CURRENT_TIMESTAMP
     WHERE contact_id = $1;`,
    [contact_id]
  );

  if (type === 'person') {
    await client.query(
      `UPDATE person
         SET first_name = $2,
             last_name = $3,
             birth_year = $4
       WHERE contact_id = $1;`,
      [
        contact_id,
        details.first_name,
        details.last_name,
        details.birth_year
      ]
    );
  } else {
    await client.query(
      `UPDATE organization
         SET org_name = $2,
             industry = $3,
             org_year = $4
       WHERE contact_id = $1;`,
      [
        contact_id,
        details.org_name,
        details.industry,
        details.org_year
      ]
    );
  }

  await client.query(`DELETE FROM phone WHERE contact_id = $1;`, [contact_id]);
  if (details.phone_number) {
    const phRes = await client.query(`SELECT MAX(phone_id) AS max_id FROM phone;`);
    const nextPhoneId = (phRes.rows[0].max_id === null ? 1 : phRes.rows[0].max_id + 1);
    await client.query(
      `INSERT INTO phone (phone_id, contact_id, phone_number, phone_type)
       VALUES ($1,$2,$3,$4);`,
      [
        nextPhoneId,
        contact_id,
        details.phone_number,
        details.phone_type
      ]
    );
  }

  await client.query(`DELETE FROM email WHERE contact_id = $1;`, [contact_id]);
  if (details.email_address) {
    const eRes = await client.query(`SELECT MAX(email_id) AS max_id FROM email;`);
    const nextEmailId = (eRes.rows[0].max_id === null ? 1 : eRes.rows[0].max_id + 1);
    await client.query(
      `INSERT INTO email (email_id, contact_id, email_address, email_type)
       VALUES ($1,$2,$3,$4);`,
      [
        nextEmailId,
        contact_id,
        details.email_address,
        details.email_type
      ]
    );
  }
  await client.query(`DELETE FROM address WHERE contact_id = $1;`, [contact_id]);
    if (details.address_line) {
      const aRes = await client.query(`SELECT MAX(address_id) AS max_id FROM address;`);
      const nextAddressId = (aRes.rows[0].max_id === null ? 1 : aRes.rows[0].max_id + 1);
      await client.query(
        `INSERT INTO address (address_id, contact_id, address_line, city, state, zip)
         VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          nextAddressId,
          contact_id,
          details.address_line,
          details.city,
          details.state,
          details.zip
        ]
      );
    }
  await client.query('COMMIT');
  client.release();

  res.json({ success: true });

});

app.delete('/api/contacts/:id', async (req, res) => {
  const contact_id = req.params.id;

  await pool.query('BEGIN');
  await pool.query('DELETE FROM phone WHERE contact_id = $1', [contact_id]);
  await pool.query('DELETE FROM email WHERE contact_id = $1', [contact_id]);
  await pool.query('DELETE FROM address WHERE contact_id = $1', [contact_id]);
  await pool.query('DELETE FROM note WHERE contact_id = $1', [contact_id]);
  await pool.query('DELETE FROM person WHERE contact_id = $1', [contact_id]);
  await pool.query('DELETE FROM organization WHERE contact_id = $1', [contact_id]);
  await pool.query('DELETE FROM contact WHERE contact_id = $1', [contact_id]);
  await pool.query('COMMIT');

  res.json({success: true});
});

app.get('/api/contacts/count', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query(
         'SELECT COUNT(*) AS total_contacts FROM contact'
        );
        const count = result.rows[0].total_contacts;
        client.release();
        res.json({ totalContacts: count });
    } catch (err) {
        console.error('Error getting contact count:', err);
        res.status(500).json({ error: 'Failed to retrieve contact count' });
    }
});


app.listen(port, () => {

  console.log(`http://localhost:${port}/login.html`);
});
