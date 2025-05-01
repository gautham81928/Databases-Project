DROP TABLE IF EXISTS note;
DROP TABLE IF EXISTS address;
DROP TABLE IF EXISTS email;
DROP TABLE IF EXISTS phone;
DROP TABLE IF EXISTS person;
DROP TABLE IF EXISTS organization;
DROP TABLE IF EXISTS contact;
DROP TABLE IF EXISTS users;

-- 2) Users Table
CREATE TABLE users (
  user_id int,
  username varchar(80) NOT NULL UNIQUE,
  password varchar(255) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_contacts INTEGER NOT NULL DEFAULT 0,
  Primary Key(user_id)
);

-- 3) Contact Table
CREATE TABLE contact (
  contact_id int,
  user_id int NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Primary Key(contact_id),
  Foreign Key(user_id) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 4) Person Table
CREATE TABLE person (
  person_id int,
  contact_id int NOT NULL UNIQUE,
  first_name varchar(80) NOT NULL,
  last_name  varchar(80) NOT NULL,
  birth_date  date,
  Primary Key(person_id),
  Foreign Key(contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 5) Organization Table
CREATE TABLE organization (
  org_id int,
  contact_id int NOT NULL UNIQUE,
  org_name varchar(80) NOT NULL,
  org_date date,
  industry varchar(80),
  Primary Key(org_id),
  Foreign Key(contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 6) Phone Table
CREATE TABLE phone (
  phone_id int,
  contact_id int NOT NULL,
  phone_number varchar(20) NOT NULL,
  phone_type varchar(20),
  Primary Key(phone_id),
  Foreign Key(contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 7) Email Table
CREATE TABLE email (
  email_id int,
  contact_id int NOT NULL,
  email_address varchar(80) NOT NULL,
  email_type varchar(20),
  Primary Key(email_id),
  Foreign Key(contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 8) Address Table
CREATE TABLE address (
  address_id int,
  contact_id int NOT NULL,
  address_line varchar(255) NOT NULL,
  city varchar(80) NOT NULL,
  state varchar(80) NOT NULL,
  zip varchar(10),
  Primary Key(address_id),
  Foreign Key(contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 9) Note Table
CREATE TABLE note (
  note_id int,
  contact_id int NOT NULL,
  content varchar(255),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  Primary Key(note_id),
  Foreign Key(contact_id) REFERENCES contact(contact_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Example data for debugging purposes
INSERT INTO users (user_id, username, password, created_at, total_contacts) VALUES (1, 'admin', 'admin123', '2025-04-26 00:00:00', 1);

INSERT INTO contact (contact_id, user_id, created_at, updated_at) VALUES (1, 1, '2025-04-26 00:00:00', '2025-04-26 00:00:00');

INSERT INTO person (person_id, contact_id, first_name, last_name, birth_date) VALUES (1, 1, 'John', 'Doe', '1980-01-01');

INSERT INTO phone (phone_id, contact_id, phone_number, phone_type) VALUES (1, 1, '555-123-4567', 'mobile');

INSERT INTO email (email_id, contact_id, email_address, email_type) VALUES (1, 1, 'johndoe@example.com', 'personal');

INSERT INTO address (address_id, contact_id, address_line, city, state, zip) VALUES (1, 1, '123 Main St',      'Springfield', 'MO',   '65802');

INSERT INTO note (note_id, contact_id, content, created_at) VALUES (1, 1, 'Met at S&T event.', '2025-04-26 00:00:00');


-- Select Statements
SELECT * FROM users;
SELECT * FROM contact;
SELECT * FROM person;
SELECT * FROM organization;
SELECT * FROM phone;
SELECT * FROM email;
SELECT * FROM address;
SELECT * FROM note;

	
