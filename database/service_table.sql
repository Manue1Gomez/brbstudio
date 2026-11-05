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

INSERT IGNORE INTO service (service_name, description, price) VALUES
  ('Hair and Makeup',          'Polished hair and makeup for your moment in the spotlight', 1500),
  ('Modeling Workshop',        'Hands-on posing, walking and confidence sessions for new talent.', 1500),
  ('Photography',              'Portrait, event and editorial sessions with professional retouching.', 1500),
  ('Event Planning',           'Thoughtful planning for an occasion that feels entirely yours', 1500),
  ('Event Coordination',       'Every detail in place. Every moment beautifully on time', 1500),
  ('Pageant Training and Styling', 'Runway, Q&A coaching and complete styling for the big stage.', 1500);
