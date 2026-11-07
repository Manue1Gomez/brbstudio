CREATE TABLE IF NOT EXISTS service (
  service_id    INT           NOT NULL AUTO_INCREMENT,
  service_name  VARCHAR(100)  NOT NULL,
  description   VARCHAR(500)  NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  image_path    VARCHAR(255)  NULL DEFAULT NULL,
  availability  TINYINT(1)    NOT NULL DEFAULT 1,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (service_id),
  UNIQUE KEY uq_service_name (service_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
