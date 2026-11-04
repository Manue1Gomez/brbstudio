-- BRB Studios: customer table
-- Run in phpMyAdmin (SQL tab) while the "brbstudio" database is selected.

-- A) FRESH SETUP: your database has no customer table yet.
CREATE TABLE IF NOT EXISTS customer (
  customer_id  INT          NOT NULL AUTO_INCREMENT,
  f_name       VARCHAR(50)  NOT NULL,
  l_name       VARCHAR(50)  NOT NULL,
  contact_num  VARCHAR(15)  NOT NULL,
  email        VARCHAR(100) NOT NULL,
  password     VARCHAR(255) NOT NULL,
  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customer_email (email)
);

-- B) EXISTING TABLE: run only the lines that apply to you.

-- Passwords are saved as 60-character bcrypt hashes, so the column must be long enough.
-- ALTER TABLE customer MODIFY password VARCHAR(255) NOT NULL;

-- One account per email (fails if two rows already share an email; delete the duplicate first).
-- ALTER TABLE customer ADD UNIQUE KEY uq_customer_email (email);

-- Only if customer_id does not already auto-increment.
-- ALTER TABLE customer MODIFY customer_id INT NOT NULL AUTO_INCREMENT;
