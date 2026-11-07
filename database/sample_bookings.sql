SET @customer := (SELECT customer_id FROM customer ORDER BY customer_id LIMIT 1);
SET @hair     := (SELECT service_id FROM service WHERE service_name = 'Hair and Makeup');
SET @photo    := (SELECT service_id FROM service WHERE service_name = 'Photography');
SET @planning := (SELECT service_id FROM service WHERE service_name = 'Event Planning');

INSERT INTO booking (customer_id, event_date, start_time, end_time, subtotal, total_amount, amount_paid, status)
VALUES (@customer, CURDATE() + INTERVAL 2 DAY, '09:00:00', '12:00:00', 3000, 3000, 1500, 'Confirmed');
INSERT INTO booking_service (booking_id, service_id, price) VALUES (LAST_INSERT_ID(), @hair, 1500), (LAST_INSERT_ID(), @photo, 1500);

INSERT INTO booking (customer_id, event_date, start_time, end_time, subtotal, total_amount, status)
VALUES (@customer, CURDATE() + INTERVAL 5 DAY, '13:00:00', '16:00:00', 1500, 1500, 'Pending');
INSERT INTO booking_service (booking_id, service_id, price) VALUES (LAST_INSERT_ID(), @planning, 1500);

INSERT INTO booking (customer_id, event_date, start_time, end_time, subtotal, total_amount, status)
VALUES (@customer, CURDATE() + INTERVAL 9 DAY, '10:00:00', '14:00:00', 1500, 1500, 'To Pay');
INSERT INTO booking_service (booking_id, service_id, price) VALUES (LAST_INSERT_ID(), @photo, 1500);
