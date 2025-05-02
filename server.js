const express    = require('express');
const bodyParser = require('body-parser');
const { Pool }   = require('pg');

const app = express();
const port = 3000;

const pool = new Pool({
    user: 'postgres',         
    password: 'firehead',
    host: 'localhost',
    database: 'ContactManagerDB',
    port: 5432
  });
  
  pool.query('SELECT NOW()')
  .then(res => console.log('Connected to PostgreSQL at', res.rows[0].now))
  .catch(err => console.error('PostgreSQL connect error:', err));

app.use(bodyParser.json());
app.use(express.static('public'));


app.get('/ping', (req, res) => res.send('pong'));


const PASSWORD = '1234'; 
let CURRENT_PASSWORD = PASSWORD;       

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

 
  if (username && password === CURRENT_PASSWORD) {
    
    res.json({ user_id: 1 }); 
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});


app.post('/api/account/change-password', async (req, res) => {
  const { newPassword, confirmPassword } = req.body;

  if (!newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'New and confirm passwords are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New and confirm passwords do not match.' });
  }

  
  CURRENT_PASSWORD = newPassword; 
  res.json({ success: true, message: 'Password changed successfully.' });
});




app.get('/api/contacts', async (req, res) => {
    const user_id = req.query.user_id;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }
    try {
      const { rows } = await pool.query(
        `SELECT
         c.contact_id,
         CASE
           WHEN p.first_name IS NOT NULL
             THEN p.first_name || ' ' || p.last_name
           WHEN o.org_name   IS NOT NULL
             THEN o.org_name
           ELSE ''
         END AS name,
         CASE
           WHEN p.contact_id IS NOT NULL THEN 'Person'
           WHEN o.contact_id IS NOT NULL THEN 'Organization'
           ELSE 'Unknown'
         END AS type,
         ph.phone_number,
         em.email_address
       FROM contact AS c
       LEFT JOIN person       AS p  ON p.contact_id = c.contact_id
       LEFT JOIN organization AS o  ON o.contact_id = c.contact_id
       LEFT JOIN phone        AS ph ON ph.contact_id = c.contact_id
       LEFT JOIN email        AS em ON em.contact_id = c.contact_id
       WHERE c.user_id = $1
       ORDER BY name;`,
        [user_id]
      );
      res.json(rows);
    } catch (err) {
      console.error('Error fetching contacts:', err);
      res.status(500).json({ error: 'Fetch failed' });
    }
  });


  app.post('/api/contacts', async (req, res) => {
    console.log('POST /api/contacts - req.body:', req.body);
    const { user_id, type, details } = req.body;
    const client = await pool.connect();
  
    try {
      await client.query('BEGIN');
  
      // 1) Compute next contact_id 
      const cRes = await client.query(
        `SELECT MAX(contact_id) AS max_id FROM contact;`
      );
      const maxContactId = cRes.rows[0].max_id;                  // may be null
      const nextContactId = (maxContactId === null ? 0 : maxContactId) + 1;
  
      // 2) Insert base contact row
      await client.query(
        `INSERT INTO contact (contact_id, user_id)
           VALUES ($1, $2);`,
        [nextContactId, user_id]
      );
      console.log('Inserted contact_id =', nextContactId);
  
      // 3) Person vs. Organization
      if (type === 'person') {
        const pRes = await client.query(
          `SELECT MAX(person_id) AS max_id FROM person;`
        );
        const maxPersonId = pRes.rows[0].max_id;
        const nextPersonId = (maxPersonId === null ? 0 : maxPersonId) + 1;
  
        await client.query(
          `INSERT INTO person
             (person_id, contact_id, first_name, last_name, birth_year)
           VALUES
             ($1,         $2,         $3,         $4,        $5);`,
          [
            nextPersonId,
            nextContactId,
            details.first_name,
            details.last_name,
            details.birth_year
          ]
        );
        console.log('Inserted person_id =', nextPersonId);
  
      } else {
        const oRes = await client.query(
          `SELECT MAX(org_id) AS max_id FROM organization;`
        );
        const maxOrgId = oRes.rows[0].max_id;
        const nextOrgId = (maxOrgId === null ? 0 : maxOrgId) + 1;
  
        await client.query(
          `INSERT INTO organization
             (org_id, contact_id, org_name, industry)
           VALUES
             ($1,     $2,         $3,       $4);`,
          [
            nextOrgId,
            nextContactId,
            details.org_name,
            details.industry
          ]
        );
        console.log('Inserted org_id =', nextOrgId);
      }
  
      // 4) Phone
      if (details.phone_number) {
        const phRes = await client.query(
          `SELECT MAX(phone_id) AS max_id FROM phone;`
        );
        const maxPhoneId = phRes.rows[0].max_id;
        const nextPhoneId = (maxPhoneId === null ? 0 : maxPhoneId) + 1;
  
        await client.query(
          `INSERT INTO phone
             (phone_id, contact_id, phone_number, phone_type)
           VALUES
             ($1,       $2,         $3,           $4);`,
          [
            nextPhoneId,
            nextContactId,
            details.phone_number,
            details.phone_type
          ]
        );
        console.log('Inserted phone_id =', nextPhoneId);
      }
  
      // 5) Email
      if (details.email_address) {
        const eRes = await client.query(
          `SELECT MAX(email_id) AS max_id FROM email;`
        );
        const maxEmailId = eRes.rows[0].max_id;
        const nextEmailId = (maxEmailId === null ? 0 : maxEmailId) + 1;
  
        await client.query(
          `INSERT INTO email
             (email_id, contact_id, email_address, email_type)
           VALUES
             ($1,       $2,         $3,            $4);`,
          [
            nextEmailId,
            nextContactId,
            details.email_address,
            details.email_type
          ]
        );
        console.log('Inserted email_id =', nextEmailId);
      }
  
      // (repeat pattern for address/note if needed)...
  
      // 6) Commit
      console.log('Attempting to COMMIT transaction');
      await client.query('COMMIT');
      console.log('Transaction COMMIT successful');
  
      res.status(201).json({ contact_id: nextContactId });
  
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error adding contact:', err);
      res.status(500).json({ error: 'Add failed' });
    } finally {
      client.release();
    }
  });
  
  

// Update Contact - PUT
app.put('/api/contacts/:id', async (req, res) => {
    const contact_id = parseInt(req.params.id, 10);
    const { type, details } = req.body;
    const client = await pool.connect();
  
    try {
      await client.query('BEGIN');
  
      // 0) Bump the contact updated_at timestamp
      await client.query(
        `UPDATE contact
           SET updated_at = CURRENT_TIMESTAMP
         WHERE contact_id = $1`,
        [contact_id]
      );
  
      // 1) Update person or organization
      if (type === 'person') {
        await client.query(
          `UPDATE person
             SET first_name = $2,
                 last_name  = $3,
                 birth_year = $4
           WHERE contact_id = $1`,
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
           WHERE contact_id = $1`,
          [
            contact_id,
            details.org_name,
            details.industry,
            details.org_year
          ]
        );
      }
  
      // 2) Replace phone
      await client.query(
        `DELETE FROM phone WHERE contact_id = $1`,
        [contact_id]
      );
      if (details.phone_number) {
        // generate a new phone_id
        const phRes = await client.query(
          `SELECT MAX(phone_id) AS max_id FROM phone`
        );
        const maxPhone = phRes.rows[0].max_id;
        const nextPhoneId = (maxPhone === null ? 1 : maxPhone + 1);
  
        await client.query(
          `INSERT INTO phone
             (phone_id, contact_id, phone_number, phone_type)
           VALUES ($1,       $2,         $3,           $4)`,
          [
            nextPhoneId,
            contact_id,
            details.phone_number,
            details.phone_type
          ]
        );
      }
  
      // 3) Replace email
      await client.query(
        `DELETE FROM email WHERE contact_id = $1`,
        [contact_id]
      );
      if (details.email_address) {
        // generate a new email_id
        const eRes = await client.query(
          `SELECT MAX(email_id) AS max_id FROM email`
        );
        const maxEmail = eRes.rows[0].max_id;
        const nextEmailId = (maxEmail === null ? 1 : maxEmail + 1);
  
        await client.query(
          `INSERT INTO email
             (email_id, contact_id, email_address, email_type)
           VALUES ($1,       $2,         $3,            $4)`,
          [
            nextEmailId,
            contact_id,
            details.email_address,
            details.email_type
          ]
        );
      }
  
      // 4) Commit
      await client.query('COMMIT');
      res.json({ success: true });
  
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Update error:', err);
      res.status(500).json({ error: 'Update failed' });
    } finally {
      client.release();
    }
  });
  
  

// DELETE /api/contacts/:id  — Delete a contact
app.delete('/api/contacts/:id', async (req, res) => {
    const contact_id = req.params.id;
    try {
      await pool.query('BEGIN');
  
      // 1) delete all associated child records
      await pool.query('DELETE FROM phone        WHERE contact_id = $1', [contact_id]);
      await pool.query('DELETE FROM email        WHERE contact_id = $1', [contact_id]);
      await pool.query('DELETE FROM address      WHERE contact_id = $1', [contact_id]);
      await pool.query('DELETE FROM note         WHERE contact_id = $1', [contact_id]);
      await pool.query('DELETE FROM person       WHERE contact_id = $1', [contact_id]);
      await pool.query('DELETE FROM organization WHERE contact_id = $1', [contact_id]);
  
      // 2) delete the contact itself
      await pool.query('DELETE FROM contact WHERE contact_id = $1', [contact_id]);
  
      await pool.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Delete cascade error:', err);
      res.status(500).json({ error: 'Delete failed' });
    }
  });
  app.listen(port, () => {
    console.log(`🚀 Server listening on http://localhost:${port}`);
  });