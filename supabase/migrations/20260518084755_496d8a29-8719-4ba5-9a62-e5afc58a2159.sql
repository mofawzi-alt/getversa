
-- Coke (red bottle lifestyle) sides
UPDATE polls SET image_a_url = 'https://jfpwuzifydxlbrrcofjh.supabase.co/storage/v1/object/public/poll-images/brand-battles/coke-lifestyle.png'
WHERE id IN ('9347269d-c148-44ee-9d17-1e190871472e','45b079ca-2575-40aa-8442-977fed97cc26','04297389-83cf-4588-a93a-462c45869309','c47cb7ee-9eb7-47bc-bb27-a288222528d7');

UPDATE polls SET image_b_url = 'https://jfpwuzifydxlbrrcofjh.supabase.co/storage/v1/object/public/poll-images/brand-battles/coke-lifestyle.png'
WHERE id IN ('acc7fe15-4672-4098-be5e-4d3094ceead8','7d16094a-955f-4a70-b58f-df5e34c7eeac','a3da9b78-fd34-4988-8760-a1586c6a018c','660976d1-1ac9-4a24-9eef-f3b2735f52fb','10786980-f470-4904-be7a-90cb86e58cdb','829b27bf-f6b8-4eb1-b32f-8215506d22fe','3af22efb-0140-4d24-90a7-d4e4355b1f9a','4cc7cb1a-e1f6-4c63-9a61-39865b827d2a');

-- Pepsi sides
UPDATE polls SET image_a_url = 'https://jfpwuzifydxlbrrcofjh.supabase.co/storage/v1/object/public/poll-images/brand-battles/pepsi-lifestyle.png'
WHERE id IN ('acc7fe15-4672-4098-be5e-4d3094ceead8','7d16094a-955f-4a70-b58f-df5e34c7eeac','a3da9b78-fd34-4988-8760-a1586c6a018c','660976d1-1ac9-4a24-9eef-f3b2735f52fb','10786980-f470-4904-be7a-90cb86e58cdb','829b27bf-f6b8-4eb1-b32f-8215506d22fe','3af22efb-0140-4d24-90a7-d4e4355b1f9a','4cc7cb1a-e1f6-4c63-9a61-39865b827d2a');

UPDATE polls SET image_b_url = 'https://jfpwuzifydxlbrrcofjh.supabase.co/storage/v1/object/public/poll-images/brand-battles/pepsi-lifestyle.png'
WHERE id IN ('9347269d-c148-44ee-9d17-1e190871472e','45b079ca-2575-40aa-8442-977fed97cc26','04297389-83cf-4588-a93a-462c45869309');

-- Original vs Zero poll
UPDATE polls SET 
  image_a_url = 'https://jfpwuzifydxlbrrcofjh.supabase.co/storage/v1/object/public/poll-images/brand-battles/coke-original-lifestyle.png',
  image_b_url = 'https://jfpwuzifydxlbrrcofjh.supabase.co/storage/v1/object/public/poll-images/brand-battles/coke-zero-lifestyle.png'
WHERE id = 'ec263ed7-97c0-4ae1-b242-ec0c30a21a1c';

-- Always Coca-Cola vs Whatever is Available
UPDATE polls SET 
  image_b_url = 'https://jfpwuzifydxlbrrcofjh.supabase.co/storage/v1/object/public/poll-images/brand-battles/whatever-soda-lifestyle.png'
WHERE id = 'c47cb7ee-9eb7-47bc-bb27-a288222528d7';
