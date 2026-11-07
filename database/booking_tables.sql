CREATE TABLE IF NOT EXISTS booking (
  booking_id       INT           NOT NULL AUTO_INCREMENT,
  customer_id      INT           NOT NULL,
  event_date       DATE          NOT NULL,
  start_time       TIME          NOT NULL,
  end_time         TIME          NOT NULL,
  event_address    VARCHAR(255)  NULL DEFAULT NULL,
  voucher_code     VARCHAR(30)   NULL DEFAULT NULL,
  subtotal         DECIMAL(10,2) NOT NULL,
  discount_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount     DECIMAL(10,2) NOT NULL,
  amount_paid      DECIMAL(10,2) NOT NULL DEFAULT 0,
  status           ENUM('Pending','To Pay','Confirmed','Completed','Rejected') NOT NULL DEFAULT 'Pending',
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (booking_id),
  KEY idx_booking_event_date (event_date, status),
  KEY idx_booking_customer (customer_id),
  CONSTRAINT fk_booking_customer FOREIGN KEY (customer_id) REFERENCES customer (customer_id) ON DELETE RESTRICT,
  CONSTRAINT chk_booking_time CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS booking_service (
  booking_id  INT           NOT NULL,
  service_id  INT           NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (booking_id, service_id),
  KEY idx_booking_service_service (service_id),
  CONSTRAINT fk_booking_service_booking FOREIGN KEY (booking_id) REFERENCES booking (booking_id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_service_service FOREIGN KEY (service_id) REFERENCES service (service_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blocked_date (
  blocked_id  INT       NOT NULL AUTO_INCREMENT,
  blocked_on  DATE      NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocked_id),
  UNIQUE KEY uq_blocked_on (blocked_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
