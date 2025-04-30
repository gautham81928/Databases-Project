const express    = require('express');
const bodyParser = require('body-parser');
const { Pool }   = require('pg');

const app = express();
const port = 3000;

const pool = new Pool({
    user: 'postgres',         // or your Postgres username
    password: 'firehead',
    host: 'localhost',
    database: 'ContactManagerDB',
    port: 5432
  });
  
  pool.query('SELECT NOW()')
  .then(res => console.log('Connected to Postgres at', res.rows[0].now))
  .catch(err => console.error('Postgres connect error:', err));

app.use(bodyParser.json());
app.use(express.static('public'));

// Simple health‐check endpoint
app.get('/ping', (req, res) => res.send('pong'));

// Your other /api routes go here…
app.get('/api/contacts', async (req, res) => {
    const user_id = req.query.user_id;
    if (!user_id) {
      return res.status(400).json({ error: 'Missing user_id' });
    }
    try {
      const { rows } = await pool.query(
        `SELECT
     c.contact_id,
     COALESCE(p.first_name || ' ' || p.last_name, o.org_name) AS name,
     CASE
       WHEN p.contact_id IS NOT NULL THEN 'Person'
       WHEN o.contact_id IS NOT NULL THEN 'Organization'
       ELSE 'Unknown'
     END AS type,
     (SELECT phone_number FROM phone WHERE contact_id = c.contact_id LIMIT 1)   AS phone_number,
     (SELECT email_address FROM email WHERE contact_id = c.contact_id LIMIT 1) AS email_address
   FROM contact c
   LEFT JOIN person p       ON p.contact_id       = c.contact_id
   LEFT JOIN organization o ON o.contact_id       = c.contact_id
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
    const { user_id, type, details } = req.body;
    try {
      await pool.query('BEGIN');
  
      // 1) Insert base contact
      const contactRes = await pool.query(
        'INSERT INTO contact (user_id) VALUES ($1) RETURNING contact_id',
        [user_id]
      );
      const contact_id = contactRes.rows[0].contact_id;
  
      // 2) Insert into person or organization
      if (type === 'person') {
        await pool.query(
          `INSERT INTO person (contact_id, first_name, last_name, birth_date)
           VALUES ($1,$2,$3,$4)`,
          [contact_id, details.first_name, details.last_name, details.birth_date]
        );
      } else {
        await pool.query(
          `INSERT INTO organization (contact_id, org_name, industry)
           VALUES ($1,$2,$3)`,
          [contact_id, details.org_name, details.industry]
        );
      }
  
      // ← INSERT PHONE & EMAIL HERE
      if (details.phone_number) {
        await pool.query(
          `INSERT INTO phone (contact_id, phone_number, phone_type)
           VALUES ($1,$2,$3)`,
          [contact_id, details.phone_number, details.phone_type]
        );
      }
      if (details.email_address) {
        await pool.query(
          `INSERT INTO email (contact_id, email_address, email_type)
           VALUES ($1,$2,$3)`,
          [contact_id, details.email_address, details.email_type]
        );
      }
  
      // 3) Commit only after all inserts
      await pool.query('COMMIT');
      res.status(201).json({ success: true });
  
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Error adding contact:', err);
      res.status(500).json({ error: 'Add failed' });
    }
  });
  

// Update Contact - PUT
app.put('/api/contacts/:id', async (req, res) => {
    const contact_id = req.params.id;
    const { type, details } = req.body;
  
    try {
      await pool.query('BEGIN');
  
      // 1) Update the name in the correct subclass table
      if (type === 'person') {
        await pool.query(
          `UPDATE person
             SET first_name = $2,
                 last_name  = $3,
                 birth_date = $4
           WHERE contact_id = $1`,
          [
            contact_id,
            details.first_name,
            details.last_name,
            details.birth_date    // null if you aren’t editing birth_date
          ]
        );
      } else {
        await pool.query(
          `UPDATE organization
             SET org_name = $2,
                 industry = $3,
                 org_date = $4
           WHERE contact_id = $1`,
          [
            contact_id,
            details.org_name,
            details.industry,
            details.org_date     // null if you aren’t editing org_date
          ]
        );
      }
  
      // 2) Replace phone records
      await pool.query(
        'DELETE FROM phone WHERE contact_id = $1',
        [contact_id]
      );
      if (details.phone_number) {
        await pool.query(
          `INSERT INTO phone (contact_id, phone_number, phone_type)
           VALUES ($1,$2,$3)`,
          [
            contact_id,
            details.phone_number,
            details.phone_type
          ]
        );
      }
  
      // 3) Replace email records
      await pool.query(
        'DELETE FROM email WHERE contact_id = $1',
        [contact_id]
      );
      if (details.email_address) {
        await pool.query(
          `INSERT INTO email (contact_id, email_address, email_type)
           VALUES ($1,$2,$3)`,
          [
            contact_id,
            details.email_address,
            details.email_type
          ]
        );
      }
  
      await pool.query('COMMIT');
      res.json({ success: true });
  
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Update error:', err);
      res.status(500).json({ error: 'Update failed' });
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