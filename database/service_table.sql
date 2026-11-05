-- BRB Studios: service table
-- Run in phpMyAdmin (SQL tab) while the "brbstudio" database is selected.

-- A) FRESH SETUP: your database has no service table yet.
CREATE TABLE IF NOT EXISTS service (
  service_id    INT           NOT NULL AUTO_INCREMENT,
  service_name  VARCHAR(100)  NOT NULL,
  description   VARCHAR(500)  NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  image_path    VARCHAR(255)  NULL DEFAULT NULL,   -- e.g. /uploads/services/3f2a....jpg
  availability  TINYINT(1)    NOT NULL DEFAULT 1,  -- 1 = offered to customers, 0 = hidden
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (service_id),
  UNIQUE KEY uq_service_name (service_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- B) EXISTING TABLE: run only the lines that apply to you.

-- Column for the service picture (stores the file's URL path, not the image itself).
-- ALTER TABLE service ADD COLUMN image_path VARCHAR(255) NULL DEFAULT NULL;

-- If the table was created from the ERD with Admin_ID in the primary key, simplify it:
--   a service does not need an owner, and a single service_id is easier to reference from booking.
-- ALTER TABLE service DROP PRIMARY KEY, ADD PRIMARY KEY (service_id);
-- ALTER TABLE service DROP COLUMN admin_id;

-- C) OPTIONAL: link bookings to services so a service with bookings can never be deleted.
--    Run this only after the booking table exists.
-- ALTER TABLE booking
--   ADD CONSTRAINT fk_booking_service FOREIGN KEY (service_id)
--   REFERENCES service (service_id) ON DELETE RESTRICT;

-- D) SAMPLE DATA from the TDD mockup (safe to re-run; skipped if the name already exists).
--    Prices are placeholders: edit them on the admin Services page, and add pictures there too.
INSERT IGNORE INTO service (service_name, description, price) VALUES
  ('Hair and Makeup',          'Polished hair and makeup for your moment in the spotlight', 1500),
  ('Modeling Workshop',        'Hands-on posing, walking and confidence sessions for new talent.', 1500),
  ('Photography',              'Portrait, event and editorial sessions with professional retouching.', 1500),
  ('Event Planning',           'Thoughtful planning for an occasion that feels entirely yours', 1500),
  ('Event Coordination',       'Every detail in place. Every moment beautifully on time', 1500),
  ('Pageant Training and Styling', 'Runway, Q&A coaching and complete styling for the big stage.', 1500);
