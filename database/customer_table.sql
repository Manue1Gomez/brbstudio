CREATE TABLE IF NOT EXISTS customer (
  customer_id  INT          NOT NULL AUTO_INCREMENT,
  f_name       VARCHAR(50)  NOT NULL,
  l_name       VARCHAR(50)  NOT NULL,
  contact_num  VARCHAR(15)  NOT NULL,
  email        VARCHAR(100) NOT NULL,
  password     VARCHAR(255) NOT NULL,
  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customer_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
