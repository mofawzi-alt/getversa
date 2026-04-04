-- Set weight scores for core index top 10 in exact order
-- 1. iPhone or Samsung = 100
UPDATE polls SET weight_score = 100 WHERE id = '9ef06df0-d367-4a59-9256-4ec383ab1f34';
-- 2. Careem or Uber = 99
UPDATE polls SET weight_score = 99 WHERE id = '18ba8097-66bf-471c-bf85-c839f0ebd820';
-- 3. Eat out or cook at home = 98
UPDATE polls SET weight_score = 98 WHERE id = 'c89ec68b-ed5c-499e-9e0b-efc09a50211a';
-- 4. Cairo or Dubai = 97
UPDATE polls SET weight_score = 97 WHERE id = 'c427250f-1e5c-4b78-9d15-b8787a2e55aa';
-- 5. Nike or Adidas = 96
UPDATE polls SET weight_score = 96 WHERE id = '25508893-585d-4a68-8143-f73fa91dba81';
-- 7. Starbucks or local cafe = 94
UPDATE polls SET weight_score = 94 WHERE id = '1733c33f-aae3-4126-85bc-ead669b0393b';
-- 8. Startup or corporate job = 93
UPDATE polls SET weight_score = 93 WHERE id = 'a6087556-adaa-40a7-a435-dd4fcb8b9d23';
-- 9. Netflix or cinema = 92
UPDATE polls SET weight_score = 92 WHERE id = 'c8babb24-85c1-4d83-b9b7-a6f965973174';
-- 10. Big wedding or intimate wedding = 91
UPDATE polls SET weight_score = 91 WHERE id = 'a2469267-a638-4cc1-a8a8-439f6dfa7092';

-- 6. Save or spend now (new poll, weight 95)
INSERT INTO polls (question, option_a, option_b, category, poll_type, weight_score, is_active)
VALUES ('Save or spend now?', 'Save', 'Spend Now', 'Money', 'core_index', 95, true);