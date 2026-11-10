SET @customer := (SELECT customer_id FROM customer ORDER BY customer_id LIMIT 1);
SET @hair     := (SELECT service_id FROM service WHERE service_name = 'Hair and Makeup');
SET @photo    := (SELECT service_id FROM service WHERE service_name = 'Photography');
SET @planning := (SELECT service_id FROM service WHERE service_name = 'Event Planning');

INSERT INTO payment (booking_id, payment_type, amount, method, reference_number, status, recorded_by, reviewed_at, receipt_sent_at)
SELECT booking_id, 'Downpayment', 1500, 'GCash', '5021 338 774291', 'Verified', 'Customer', NOW(), NOW()
  FROM booking
 WHERE customer_id = @customer AND status = 'Confirmed' AND total_amount = 3000 AND amount_paid = 1500
 ORDER BY booking_id DESC LIMIT 1;

INSERT INTO payment (booking_id, payment_type, amount, method, reference_number, proof_path, status)
SELECT booking_id, 'Downpayment', 750, 'GCash', '5021 338 774302', '/admin/AdminImages/samples/sample-proof-1.png', 'Pending'
  FROM booking
 WHERE customer_id = @customer AND status = 'To Pay' AND total_amount = 1500 AND amount_paid = 0
 ORDER BY booking_id DESC LIMIT 1;

INSERT INTO booking (customer_id, event_date, start_time, end_time, subtotal, total_amount, amount_paid, status)
VALUES (@customer, CURDATE() - INTERVAL 12 DAY, '14:00:00', '16:00:00', 8000, 8000, 8000, 'Completed');
SET @paid_in_full := LAST_INSERT_ID();
INSERT INTO booking_service (booking_id, service_id, price) VALUES (@paid_in_full, @photo, 8000);
INSERT INTO payment (booking_id, payment_type, amount, method, reference_number, status, recorded_by, reviewed_at, receipt_sent_at) VALUES
  (@paid_in_full, 'Downpayment', 4000, 'GCash', '5021 338 770115', 'Verified', 'Customer', NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 20 DAY);
INSERT INTO payment (booking_id, payment_type, amount, method, status, recorded_by, reviewed_at, note) VALUES
  (@paid_in_full, 'Balance', 4000, 'Cash', 'Verified', 'Admin', NOW() - INTERVAL 12 DAY, 'Paid in cash on the event day');

INSERT INTO booking (customer_id, event_date, start_time, end_time, subtotal, total_amount, amount_paid, status)
VALUES (@customer, CURDATE() - INTERVAL 5 DAY, '08:00:00', '09:00:00', 6000, 6000, 3000, 'Completed');
SET @with_balance := LAST_INSERT_ID();
INSERT INTO booking_service (booking_id, service_id, price) VALUES (@with_balance, @hair, 6000);
INSERT INTO payment (booking_id, payment_type, amount, method, reference_number, status, recorded_by, reviewed_at, receipt_sent_at) VALUES
  (@with_balance, 'Downpayment', 3000, 'GCash', '5021 338 771980', 'Verified', 'Customer', NOW() - INTERVAL 14 DAY, NOW() - INTERVAL 14 DAY);

INSERT INTO booking (customer_id, event_date, start_time, end_time, subtotal, total_amount, amount_paid, status)
VALUES (@customer, CURDATE() + INTERVAL 14 DAY, '09:00:00', '12:00:00', 5600, 5600, 0, 'To Pay');
SET @awaiting := LAST_INSERT_ID();
INSERT INTO booking_service (booking_id, service_id, price) VALUES (@awaiting, @photo, 5600);
INSERT INTO payment (booking_id, payment_type, amount, method, reference_number, proof_path, status) VALUES
  (@awaiting, 'Downpayment', 4500, 'GCash', '5021 338 774417', '/admin/AdminImages/samples/sample-proof-2.png', 'Pending');

INSERT INTO booking (customer_id, event_date, start_time, end_time, subtotal, total_amount, amount_paid, status)
VALUES (@customer, CURDATE() + INTERVAL 20 DAY, '13:00:00', '15:00:00', 1500, 1500, 0, 'Rejected');
INSERT INTO booking_service (booking_id, service_id, price) VALUES (LAST_INSERT_ID(), @planning, 1500);
