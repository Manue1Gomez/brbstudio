const REFERENCE = "CONCAT(DATE_FORMAT(b.created_at, '%y'), LPAD(b.booking_id, 3, '0'))";
const CLIENT_NAME = "CONCAT(c.f_name, ' ', c.l_name)";
const START_MINUTES = 'TIME_TO_SEC(b.start_time) DIV 60';
const END_MINUTES = 'TIME_TO_SEC(b.end_time) DIV 60';
const SERVICE_SEPARATOR = '\x1f';

const SERVICES_SUBQUERY = `(
  SELECT GROUP_CONCAT(s.service_name ORDER BY s.service_id SEPARATOR '${SERVICE_SEPARATOR}')
    FROM booking_service bs
    JOIN service s ON s.service_id = bs.service_id
   WHERE bs.booking_id = b.booking_id
)`;

const PENDING_PAYMENTS_SUBQUERY = `(
  SELECT COUNT(*) FROM payment p WHERE p.booking_id = b.booking_id AND p.status = 'Pending'
)`;

const splitServices = (text) => (text ? text.split(SERVICE_SEPARATOR) : []);

module.exports = {
  REFERENCE,
  CLIENT_NAME,
  START_MINUTES,
  END_MINUTES,
  SERVICES_SUBQUERY,
  PENDING_PAYMENTS_SUBQUERY,
  splitServices,
};
