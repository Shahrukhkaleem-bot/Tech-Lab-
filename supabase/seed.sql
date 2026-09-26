-- =============================================================================
-- DEVELOPMENT SEED DATA — DEMO ONLY. NEVER RUN AGAINST PRODUCTION.
-- `supabase db reset` applies this file locally. Production projects receive
-- migrations only (`supabase db push`), which never includes seed.sql.
--
-- Three generic demo tenants:
--   demo-electronics.<root>   Demo Electronics   (blue / Inter)
--   demo-fashion.<root>       Demo Fashion       (rose / Poppins)
--   demo-accessories.<root>   Demo Accessories   (amber / Nunito)
--
-- No users are created here. Create an account through the app, then run
--   select public.seed_grant_demo_owner('you@example.com');
-- to become owner of all three demo stores.
-- Products are seeded without images (the UI shows a branded placeholder). The hosted
-- demo stores have real CC0 photos uploaded to Storage; see docs/PHOTO_CREDITS.md.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- Helpers (session-scoped, dropped at end of session)
-- ---------------------------------------------------------------------------
create function pg_temp.cat(p_tenant uuid, p_slug text, p_name text, p_order int, p_parent_slug text default null, p_description text default null)
returns uuid language sql as $$
  insert into public.categories (tenant_id, parent_id, name, slug, description, display_order)
  values (p_tenant,
          (select id from public.categories where tenant_id = p_tenant and slug = p_parent_slug),
          p_name, p_slug, p_description, p_order)
  returning id;
$$;

create function pg_temp.brand(p_tenant uuid, p_slug text, p_name text, p_order int, p_featured boolean default true)
returns uuid language sql as $$
  insert into public.brands (tenant_id, name, slug, display_order, is_featured)
  values (p_tenant, p_name, p_slug, p_order, p_featured)
  returning id;
$$;

create function pg_temp.product(
  p_tenant uuid, p_slug text, p_name text, p_category text, p_brand text, p_sku text,
  p_price numeric, p_sale numeric, p_stock int, p_featured boolean, p_short text, p_specs jsonb,
  p_days_ago int default 0
) returns uuid language sql as $$
  insert into public.products (
    tenant_id, category_id, brand_id, name, slug, sku, original_price, sale_price,
    stock_quantity, is_featured, short_description, description, specifications, created_at
  ) values (
    p_tenant,
    (select id from public.categories where tenant_id = p_tenant and slug = p_category),
    (select id from public.brands where tenant_id = p_tenant and slug = p_brand),
    p_name, p_slug, p_sku, p_price, p_sale, p_stock, p_featured, p_short,
    p_short || E'\n\nThis is demo product copy. Replace it from the admin dashboard with your real product description, materials, warranty terms and care instructions.',
    p_specs, now() - make_interval(days => p_days_ago)
  ) returning id;
$$;

create function pg_temp.review(p_tenant uuid, p_product_slug text, p_name text, p_rating int, p_comment text, p_days_ago int, p_verified boolean default true)
returns void language sql as $$
  insert into public.reviews (tenant_id, product_id, customer_name, rating, comment, is_verified, is_approved, created_at)
  values (p_tenant, (select id from public.products where tenant_id = p_tenant and slug = p_product_slug),
          p_name, p_rating, p_comment, p_verified, true, now() - make_interval(days => p_days_ago));
$$;

-- Common storefront content applied to every demo tenant.
create function pg_temp.store_content(p_tenant uuid, p_tagline text, p_hero text, p_currency_symbol text)
returns void language plpgsql as $$
begin
  update public.store_settings set
    tagline = p_tagline,
    announcement = 'Free delivery on orders above ' || p_currency_symbol || ' 5,000 · Cash on delivery available',
    trust_badges = '[
      {"icon": "truck", "title": "Express Delivery", "description": "Nationwide delivery in 2–5 working days"},
      {"icon": "badge-check", "title": "Genuine Products", "description": "Sourced from authorised distributors"},
      {"icon": "rotate-ccw", "title": "Easy Returns", "description": "7-day hassle-free return policy"},
      {"icon": "wallet", "title": "Cash on Delivery", "description": "Pay in cash when your order arrives"}
    ]'::jsonb,
    homepage_sections = '[
      {"type": "featured", "title": "Featured Products", "subtitle": "Hand-picked favourites from our team", "limit": 8},
      {"type": "best_sellers", "title": "Top Sellers", "subtitle": "What everyone is buying right now", "limit": 8},
      {"type": "on_sale", "title": "On Sale", "subtitle": "Limited-time prices on popular items", "limit": 8},
      {"type": "new_arrivals", "title": "New Arrivals", "subtitle": "The latest additions to the store", "limit": 8}
    ]'::jsonb,
    price_ranges = '[
      {"label": "Under 2,000", "max": 2000},
      {"label": "2,000 – 5,000", "min": 2000, "max": 5000},
      {"label": "5,000 – 15,000", "min": 5000, "max": 15000},
      {"label": "15,000 – 50,000", "min": 15000, "max": 50000},
      {"label": "Above 50,000", "min": 50000}
    ]'::jsonb,
    store_location = '{
      "address": "Demo Plaza, Shop 12, Main Boulevard, Lahore",
      "map_url": "https://maps.google.com/?q=Lahore",
      "latitude": 31.5204, "longitude": 74.3587,
      "phone": "+92 300 0000000",
      "hours": [{"label": "Mon – Sat", "value": "11:00 am – 9:00 pm"}, {"label": "Sunday", "value": "2:00 pm – 9:00 pm"}]
    }'::jsonb,
    shipping_config = '{
      "flat_rate": 250,
      "free_shipping_threshold": 5000,
      "city_rates": [{"city": "Lahore", "rate": 150}, {"city": "Karachi", "rate": 250}, {"city": "Islamabad", "rate": 250}],
      "estimated_days": {"min": 2, "max": 5},
      "couriers": ["TCS", "Leopards", "Trax"]
    }'::jsonb,
    payment_config = '{
      "enabled_methods": ["cod"],
      "bank_accounts": [{"bank_name": "Demo Bank", "account_title": "Demo Store (Pvt) Ltd", "account_number": "0000-0000000-0", "iban": "PK00DEMO0000000000000000"}],
      "instructions": "Share the transfer receipt on WhatsApp with your order number."
    }'::jsonb,
    footer_badges = '[{"label": "Cash on Delivery"}, {"label": "TCS"}, {"label": "Leopards"}]'::jsonb,
    shipping_info = 'Orders placed before 3 pm ship the same day. Delivery takes 2–5 working days nationwide. Tracking details are shared by SMS and email once your parcel is dispatched.',
    return_info = 'Unused items in original packaging can be returned within 7 days of delivery. Warranty claims are handled according to the brand warranty policy.',
    seo = jsonb_build_object('description', p_tagline)
  where tenant_id = p_tenant;

  insert into public.banners (tenant_id, heading, description, badge, cta_label, link_url, desktop_image_url, desktop_image_width, desktop_image_height, display_order) values
    (p_tenant, 'New season, new arrivals', 'Discover the latest products picked for you — delivered to your door.', 'Just in', 'Shop new arrivals', '/products?sort=newest', p_hero, 2100, 800, 0),
    (p_tenant, 'Up to 30% off selected items', 'Limited-time prices on customer favourites. While stocks last.', 'Sale', 'Shop the sale', '/products?on_sale=1', p_hero, 2100, 800, 1);

  insert into public.store_pages (tenant_id, slug, title, content) values
    (p_tenant, 'shipping-policy', 'Shipping Policy', E'We deliver nationwide.\n\nOrders placed before 3 pm on working days are dispatched the same day. Standard delivery takes 2–5 working days.\n\nThis is demo content — edit it from Admin → Settings → Pages.'),
    (p_tenant, 'return-policy', 'Return & Refund Policy', E'Unused items in original packaging may be returned within 7 days of delivery.\n\nRefunds are issued to the original payment method or by bank transfer within 5 working days of receiving the return.'),
    (p_tenant, 'warranty-policy', 'Warranty Policy', E'Products carry the manufacturer or brand warranty stated on the product page.\n\nKeep your order number for warranty claims.'),
    (p_tenant, 'privacy-policy', 'Privacy Policy', E'We only collect the information needed to process and deliver your order.\n\nWe never sell your personal data.'),
    (p_tenant, 'terms', 'Terms & Conditions', E'By placing an order you agree to these terms.\n\nPrices and availability are subject to change without notice.'),
    (p_tenant, 'faq', 'Frequently Asked Questions', E'How long does delivery take?\n2–5 working days nationwide.\n\nDo you offer cash on delivery?\nYes, across the country.');

  insert into public.navigation_items (tenant_id, location, label, href, display_order) values
    (p_tenant, 'header', 'Brands', '/brands', 1),
    (p_tenant, 'header', 'On Sale', '/products?on_sale=1', 2),
    (p_tenant, 'header', 'Contact', '/contact', 3),
    (p_tenant, 'footer_help', 'Contact Us', '/contact', 1),
    (p_tenant, 'footer_help', 'FAQs', '/pages/faq', 2),
    (p_tenant, 'footer_help', 'Track Your Order', '/account', 3),
    (p_tenant, 'footer_policies', 'Shipping Policy', '/pages/shipping-policy', 1),
    (p_tenant, 'footer_policies', 'Return & Refund Policy', '/pages/return-policy', 2),
    (p_tenant, 'footer_policies', 'Warranty Policy', '/pages/warranty-policy', 3),
    (p_tenant, 'footer_policies', 'Privacy Policy', '/pages/privacy-policy', 4),
    (p_tenant, 'footer_policies', 'Terms & Conditions', '/pages/terms', 5),
    (p_tenant, 'footer_company', 'All Products', '/products', 1),
    (p_tenant, 'footer_company', 'Brands', '/brands', 2),
    (p_tenant, 'footer_company', 'New Arrivals', '/products?sort=newest', 3),
    (p_tenant, 'footer_company', 'Best Sellers', '/products?sort=best_selling', 4);

  insert into public.coupons (tenant_id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount)
  values (p_tenant, 'WELCOME10', '10% off your first order (demo)', 'percentage', 10, 1000, 1500);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
insert into public.tenants (id, name, slug, subdomain, status, brand_config, contact_email, contact_phone, whatsapp_number, address, social_links, currency, locale)
values
  ('11111111-1111-4111-8111-111111111111', 'Demo Electronics', 'demo-electronics', 'demo-electronics', 'active',
   '{"primary_color": "#1d4ed8", "secondary_color": "#0f172a", "accent_color": "#f59e0b", "font_family": "inter", "radius": "0.75rem"}',
   'hello@demo-electronics.test', '+92 300 0000001', '+923000000001', 'Demo Plaza, Main Boulevard, Lahore',
   '{"facebook": "https://facebook.com/", "instagram": "https://instagram.com/", "youtube": "https://youtube.com/"}', 'PKR', 'en-PK'),
  ('22222222-2222-4222-8222-222222222222', 'Demo Fashion', 'demo-fashion', 'demo-fashion', 'active',
   '{"primary_color": "#be123c", "secondary_color": "#1f2937", "accent_color": "#fb923c", "font_family": "poppins", "radius": "1rem"}',
   'hello@demo-fashion.test', '+92 300 0000002', '+923000000002', 'Fashion Avenue, Karachi',
   '{"instagram": "https://instagram.com/", "tiktok": "https://tiktok.com/"}', 'PKR', 'en-PK'),
  ('33333333-3333-4333-8333-333333333333', 'Demo Accessories', 'demo-accessories', 'demo-accessories', 'active',
   '{"primary_color": "#15803d", "secondary_color": "#111827", "accent_color": "#f59e0b", "font_family": "nunito", "radius": "0.5rem"}',
   'hello@demo-accessories.test', '+92 300 0000003', '+923000000003', 'Blue Area, Islamabad',
   '{"facebook": "https://facebook.com/", "instagram": "https://instagram.com/", "youtube": "https://youtube.com/"}', 'PKR', 'en-PK');

select pg_temp.store_content('11111111-1111-4111-8111-111111111111', 'Premium tech & gadgets, delivered', '/demo/hero-electronics.svg', 'Rs.');
select pg_temp.store_content('22222222-2222-4222-8222-222222222222', 'Everyday style for everyone', '/demo/hero-fashion.svg', 'Rs.');
select pg_temp.store_content('33333333-3333-4333-8333-333333333333', 'Accessories that just work', '/demo/hero-accessories.svg', 'Rs.');

-- ---------------------------------------------------------------------------
-- Demo Electronics
-- ---------------------------------------------------------------------------
do $$
declare t uuid := '11111111-1111-4111-8111-111111111111';
begin
  perform pg_temp.cat(t, 'smartphones', 'Smartphones', 1, null, 'Latest Android and iOS phones');
  perform pg_temp.cat(t, 'audio', 'Audio', 2, null, 'Earbuds, headphones and speakers');
  perform pg_temp.cat(t, 'earbuds', 'Earbuds', 1, 'audio');
  perform pg_temp.cat(t, 'headphones', 'Headphones', 2, 'audio');
  perform pg_temp.cat(t, 'speakers', 'Speakers', 3, 'audio');
  perform pg_temp.cat(t, 'wearables', 'Smart Watches', 3, null, 'Fitness bands and smart watches');
  perform pg_temp.cat(t, 'power', 'Power', 4, null, 'Power banks, chargers and cables');
  perform pg_temp.cat(t, 'power-banks', 'Power Banks', 1, 'power');
  perform pg_temp.cat(t, 'chargers', 'Chargers', 2, 'power');
  perform pg_temp.cat(t, 'cables', 'Data Cables', 3, 'power');
  perform pg_temp.cat(t, 'tablets', 'Tablets', 5);
  perform pg_temp.cat(t, 'car-accessories', 'Car Accessories', 6);

  perform pg_temp.brand(t, 'voltix', 'Voltix', 1);
  perform pg_temp.brand(t, 'sonora', 'Sonora', 2);
  perform pg_temp.brand(t, 'nimbus', 'Nimbus', 3);
  perform pg_temp.brand(t, 'pulse', 'Pulse', 4);
  perform pg_temp.brand(t, 'arcwave', 'Arcwave', 5);
  perform pg_temp.brand(t, 'kinetic', 'Kinetic', 6);

  perform pg_temp.product(t, 'nimbus-x12-5g', 'Nimbus X12 5G (8GB / 256GB)', 'smartphones', 'nimbus', 'NMB-X12-256', 89999, 84999, 14, true,
    '6.7" AMOLED 120Hz display, 50MP triple camera and 5000 mAh battery.',
    '[{"name":"Display","value":"6.7\" AMOLED, 120Hz"},{"name":"Memory","value":"8GB RAM / 256GB"},{"name":"Battery","value":"5000 mAh, 45W"},{"name":"Warranty","value":"1 year"}]', 3);
  perform pg_temp.product(t, 'nimbus-a5', 'Nimbus A5 (6GB / 128GB)', 'smartphones', 'nimbus', 'NMB-A5-128', 42999, null, 22, false,
    'Everyday smartphone with a 90Hz display and two-day battery life.',
    '[{"name":"Display","value":"6.5\" LCD, 90Hz"},{"name":"Memory","value":"6GB RAM / 128GB"},{"name":"Battery","value":"6000 mAh"}]', 20);
  perform pg_temp.product(t, 'sonora-buds-pro', 'Sonora Buds Pro ANC Earbuds', 'earbuds', 'sonora', 'SON-BUDS-PRO', 14999, 11999, 40, true,
    'Hybrid active noise cancellation with 32-hour total playback.',
    '[{"name":"ANC","value":"Hybrid, up to 42dB"},{"name":"Playback","value":"8h + 24h case"},{"name":"Bluetooth","value":"5.3"},{"name":"Water resistance","value":"IPX5"}]', 5);
  perform pg_temp.product(t, 'sonora-buds-lite', 'Sonora Buds Lite', 'earbuds', 'sonora', 'SON-BUDS-LITE', 4999, 3999, 65, false,
    'Lightweight true wireless earbuds with low-latency game mode.',
    '[{"name":"Playback","value":"6h + 18h case"},{"name":"Latency","value":"60ms game mode"}]', 40);
  perform pg_temp.product(t, 'arcwave-studio-h1', 'Arcwave Studio H1 Headphones', 'headphones', 'arcwave', 'ARC-H1', 24999, null, 9, true,
    'Over-ear wireless headphones with 40mm drivers and 60-hour battery.',
    '[{"name":"Drivers","value":"40mm dynamic"},{"name":"Battery","value":"60 hours"},{"name":"Charging","value":"USB-C fast charge"}]', 12);
  perform pg_temp.product(t, 'arcwave-boom-mini', 'Arcwave Boom Mini Speaker', 'speakers', 'arcwave', 'ARC-BOOM-MINI', 7499, 6499, 3, false,
    'Pocket-sized waterproof speaker with punchy bass.',
    '[{"name":"Output","value":"10W"},{"name":"Water resistance","value":"IP67"},{"name":"Battery","value":"12 hours"}]', 8);
  perform pg_temp.product(t, 'pulse-fit-3', 'Pulse Fit 3 Smart Watch', 'wearables', 'pulse', 'PLS-FIT3', 12999, 9999, 25, true,
    'AMOLED smart watch with SpO2, heart-rate and 100+ sport modes.',
    '[{"name":"Display","value":"1.43\" AMOLED"},{"name":"Battery","value":"Up to 10 days"},{"name":"Sensors","value":"HR, SpO2, sleep"}]', 2);
  perform pg_temp.product(t, 'pulse-band-2', 'Pulse Band 2', 'wearables', 'pulse', 'PLS-BAND2', 5499, null, 0, false,
    'Slim fitness band with 14-day battery life.',
    '[{"name":"Battery","value":"14 days"},{"name":"Water resistance","value":"5 ATM"}]', 60);
  perform pg_temp.product(t, 'voltix-20000-pd', 'Voltix 20,000 mAh PD Power Bank', 'power-banks', 'voltix', 'VLX-PB20K', 8999, 7499, 50, true,
    '65W USB-C Power Delivery — charges laptops, tablets and phones.',
    '[{"name":"Capacity","value":"20,000 mAh"},{"name":"Output","value":"65W USB-C PD"},{"name":"Ports","value":"2x USB-C, 1x USB-A"}]', 7);
  perform pg_temp.product(t, 'voltix-10000-slim', 'Voltix 10,000 mAh Slim Power Bank', 'power-banks', 'voltix', 'VLX-PB10K', 4499, null, 80, false,
    'Pocket-friendly 22.5W fast-charging power bank.',
    '[{"name":"Capacity","value":"10,000 mAh"},{"name":"Output","value":"22.5W"}]', 30);
  perform pg_temp.product(t, 'kinetic-gan-65w', 'Kinetic 65W GaN Charger', 'chargers', 'kinetic', 'KIN-GAN65', 6999, 5999, 35, false,
    'Compact 3-port GaN charger for laptop, tablet and phone.',
    '[{"name":"Output","value":"65W max"},{"name":"Ports","value":"2x USB-C, 1x USB-A"}]', 15);
  perform pg_temp.product(t, 'kinetic-usb-c-cable-2m', 'Kinetic USB-C to USB-C Cable 100W (2m)', 'cables', 'kinetic', 'KIN-CC-2M', 1499, 1199, 200, false,
    'Braided 100W fast-charge cable with 480 Mbps data.',
    '[{"name":"Length","value":"2 m"},{"name":"Power","value":"100W"}]', 45);
  perform pg_temp.product(t, 'nimbus-tab-11', 'Nimbus Tab 11 (8GB / 128GB)', 'tablets', 'nimbus', 'NMB-TAB11', 64999, null, 6, true,
    '11" 2K display tablet with quad speakers and stylus support.',
    '[{"name":"Display","value":"11\" 2K, 90Hz"},{"name":"Memory","value":"8GB / 128GB"},{"name":"Battery","value":"8000 mAh"}]', 1);
  perform pg_temp.product(t, 'kinetic-car-charger-45w', 'Kinetic 45W Dual Car Charger', 'car-accessories', 'kinetic', 'KIN-CAR45', 2499, null, 60, false,
    'Dual-port car charger with PD fast charging.',
    '[{"name":"Output","value":"45W total"},{"name":"Ports","value":"USB-C + USB-A"}]', 25);

  update public.products set sales_count = v.sc
  from (values ('sonora-buds-pro', 320), ('voltix-20000-pd', 280), ('pulse-fit-3', 210), ('kinetic-usb-c-cable-2m', 540),
               ('nimbus-x12-5g', 95), ('sonora-buds-lite', 400), ('kinetic-gan-65w', 150), ('arcwave-boom-mini', 120)) v(slug, sc)
  where products.tenant_id = t and products.slug = v.slug;

  perform pg_temp.review(t, 'sonora-buds-pro', 'Ayesha K.', 5, 'Noise cancellation is excellent for the price. Delivery was quick too.', 2);
  perform pg_temp.review(t, 'sonora-buds-pro', 'Hamza R.', 4, 'Great sound. The case is a little bulky but battery life is superb.', 9);
  perform pg_temp.review(t, 'voltix-20000-pd', 'Bilal A.', 5, 'Charges my laptop over USB-C without any issue. Solid build.', 4);
  perform pg_temp.review(t, 'pulse-fit-3', 'Sana M.', 5, 'Beautiful screen and accurate step tracking. Very happy.', 6);
  perform pg_temp.review(t, 'nimbus-x12-5g', 'Usman T.', 4, 'Smooth display and the camera is great in daylight.', 12);
  perform pg_temp.review(t, 'kinetic-usb-c-cable-2m', 'Fatima Z.', 5, 'Good length and fast charging. Ordered two more.', 1);
end $$;

-- ---------------------------------------------------------------------------
-- Demo Fashion
-- ---------------------------------------------------------------------------
do $$
declare t uuid := '22222222-2222-4222-8222-222222222222';
begin
  perform pg_temp.cat(t, 'women', 'Women', 1);
  perform pg_temp.cat(t, 'women-tops', 'Tops', 1, 'women');
  perform pg_temp.cat(t, 'women-dresses', 'Dresses', 2, 'women');
  perform pg_temp.cat(t, 'men', 'Men', 2);
  perform pg_temp.cat(t, 'men-shirts', 'Shirts', 1, 'men');
  perform pg_temp.cat(t, 'men-trousers', 'Trousers', 2, 'men');
  perform pg_temp.cat(t, 'footwear', 'Footwear', 3);
  perform pg_temp.cat(t, 'bags', 'Bags', 4);

  perform pg_temp.brand(t, 'linea', 'Linea', 1);
  perform pg_temp.brand(t, 'mode-studio', 'Mode Studio', 2);
  perform pg_temp.brand(t, 'stride', 'Stride', 3);
  perform pg_temp.brand(t, 'carryall', 'Carryall', 4);

  perform pg_temp.product(t, 'linen-relaxed-shirt', 'Linen Relaxed Shirt', 'men-shirts', 'linea', 'LIN-SHIRT-01', 5499, 4499, 30, true, 'Breathable linen-blend shirt with a relaxed fit.', '[{"name":"Fabric","value":"55% linen, 45% cotton"},{"name":"Fit","value":"Relaxed"}]', 2);
  perform pg_temp.product(t, 'tapered-chino', 'Tapered Chino Trousers', 'men-trousers', 'linea', 'LIN-CHINO-01', 4999, null, 24, false, 'Stretch cotton chinos with a tapered leg.', '[{"name":"Fabric","value":"98% cotton, 2% elastane"}]', 10);
  perform pg_temp.product(t, 'printed-lawn-kurta', 'Printed Lawn Kurta', 'women-tops', 'mode-studio', 'MOD-KURTA-01', 3999, 2999, 45, true, 'Lightweight printed lawn kurta for everyday wear.', '[{"name":"Fabric","value":"Lawn"},{"name":"Length","value":"42 inches"}]', 1);
  perform pg_temp.product(t, 'wrap-midi-dress', 'Wrap Midi Dress', 'women-dresses', 'mode-studio', 'MOD-DRESS-01', 7999, null, 12, true, 'Flowing wrap dress with a tie waist.', '[{"name":"Fabric","value":"Viscose"}]', 5);
  perform pg_temp.product(t, 'everyday-sneakers', 'Everyday Sneakers', 'footwear', 'stride', 'STR-SNK-01', 8999, 7499, 18, true, 'Cushioned everyday sneakers with a knit upper.', '[{"name":"Upper","value":"Knit"},{"name":"Sole","value":"EVA"}]', 3);
  perform pg_temp.product(t, 'leather-loafers', 'Leather Loafers', 'footwear', 'stride', 'STR-LOAF-01', 11999, null, 7, false, 'Hand-finished leather penny loafers.', '[{"name":"Upper","value":"Genuine leather"}]', 20);
  perform pg_temp.product(t, 'canvas-tote', 'Canvas Tote Bag', 'bags', 'carryall', 'CAR-TOTE-01', 2499, 1999, 60, false, 'Heavy canvas tote with an inner zip pocket.', '[{"name":"Material","value":"12oz canvas"}]', 8);
  perform pg_temp.product(t, 'crossbody-bag', 'Mini Crossbody Bag', 'bags', 'carryall', 'CAR-XBODY-01', 4499, null, 0, false, 'Compact crossbody bag with adjustable strap.', '[{"name":"Material","value":"Vegan leather"}]', 30);

  update public.products set sales_count = v.sc
  from (values ('printed-lawn-kurta', 410), ('everyday-sneakers', 230), ('linen-relaxed-shirt', 180), ('canvas-tote', 150)) v(slug, sc)
  where products.tenant_id = t and products.slug = v.slug;

  perform pg_temp.review(t, 'printed-lawn-kurta', 'Mehwish S.', 5, 'Lovely print and the fabric is soft. True to size.', 3);
  perform pg_temp.review(t, 'everyday-sneakers', 'Ali H.', 4, 'Very comfortable for daily walks.', 7);
  perform pg_temp.review(t, 'wrap-midi-dress', 'Hina F.', 5, 'Beautiful drape, got many compliments!', 5);
end $$;

-- ---------------------------------------------------------------------------
-- Demo Accessories
-- ---------------------------------------------------------------------------
do $$
declare t uuid := '33333333-3333-4333-8333-333333333333';
begin
  perform pg_temp.cat(t, 'phone-cases', 'Phone Cases', 1);
  perform pg_temp.cat(t, 'screen-protectors', 'Screen Protectors', 2);
  perform pg_temp.cat(t, 'chargers', 'Chargers & Cables', 3);
  perform pg_temp.cat(t, 'mounts', 'Mounts & Stands', 4);
  perform pg_temp.cat(t, 'audio', 'Audio', 5);

  perform pg_temp.brand(t, 'shieldline', 'Shieldline', 1);
  perform pg_temp.brand(t, 'gripcraft', 'Gripcraft', 2);
  perform pg_temp.brand(t, 'amp', 'Amp', 3);

  perform pg_temp.product(t, 'clear-magsafe-case', 'Clear MagSafe-Compatible Case', 'phone-cases', 'shieldline', 'SHL-CASE-MAG', 2999, 2499, 120, true, 'Anti-yellowing clear case with built-in magnets.', '[{"name":"Material","value":"TPU + polycarbonate"},{"name":"Drop protection","value":"2 m"}]', 2);
  perform pg_temp.product(t, 'rugged-armor-case', 'Rugged Armor Case', 'phone-cases', 'shieldline', 'SHL-CASE-RUG', 3499, null, 55, false, 'Military-grade drop protection with raised edges.', '[{"name":"Drop protection","value":"3 m"}]', 15);
  perform pg_temp.product(t, 'tempered-glass-2pack', 'Tempered Glass Screen Protector (2-pack)', 'screen-protectors', 'shieldline', 'SHL-GLASS-2', 1299, 999, 300, true, '9H hardness glass with installation frame.', '[{"name":"Hardness","value":"9H"},{"name":"Pack","value":"2 pieces"}]', 4);
  perform pg_temp.product(t, 'car-vent-mount', 'Magnetic Car Vent Mount', 'mounts', 'gripcraft', 'GRP-CAR-01', 1999, null, 80, false, 'Strong magnetic mount with 360° rotation.', '[{"name":"Compatibility","value":"All phones with plate or MagSafe"}]', 9);
  perform pg_temp.product(t, 'desk-stand-alu', 'Aluminium Desk Stand', 'mounts', 'gripcraft', 'GRP-DESK-01', 2999, 2499, 40, true, 'Adjustable aluminium stand for phones and tablets.', '[{"name":"Material","value":"Aluminium alloy"}]', 6);
  perform pg_temp.product(t, 'amp-20w-charger', 'Amp 20W USB-C Charger', 'chargers', 'amp', 'AMP-20W', 2299, 1899, 150, true, 'Fast charger for phones and earbuds.', '[{"name":"Output","value":"20W PD"}]', 1);
  perform pg_temp.product(t, 'amp-lightning-cable', 'Amp USB-C to Lightning Cable (1m)', 'chargers', 'amp', 'AMP-LTG-1M', 1499, null, 200, false, 'Certified fast-charge cable.', '[{"name":"Length","value":"1 m"}]', 11);
  perform pg_temp.product(t, 'amp-wired-earphones', 'Amp Wired Earphones (USB-C)', 'audio', 'amp', 'AMP-EAR-C', 1799, null, 4, false, 'USB-C earphones with inline mic.', '[{"name":"Connector","value":"USB-C"}]', 21);

  update public.products set sales_count = v.sc
  from (values ('tempered-glass-2pack', 900), ('clear-magsafe-case', 640), ('amp-20w-charger', 520), ('car-vent-mount', 210)) v(slug, sc)
  where products.tenant_id = t and products.slug = v.slug;

  perform pg_temp.review(t, 'tempered-glass-2pack', 'Kamran J.', 5, 'Bubble-free install with the frame. Excellent.', 2);
  perform pg_temp.review(t, 'clear-magsafe-case', 'Zara N.', 4, 'Magnets are strong. Still clear after a month.', 10);
  perform pg_temp.review(t, 'amp-20w-charger', 'Omer Q.', 5, 'Charges quickly and stays cool.', 5);
end $$;

-- Grant yourself owner access to all demo stores after signing up through the app.
create or replace function public.seed_grant_demo_owner(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user uuid;
begin
  select id into v_user from auth.users where email = lower(p_email);
  if v_user is null then
    raise exception 'No auth user with email %', p_email;
  end if;
  insert into public.tenant_members (tenant_id, user_id, role)
  select t.id, v_user, 'owner' from public.tenants t
  where t.id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')
  on conflict (tenant_id, user_id) do update set role = 'owner';
end;
$$;
revoke execute on function public.seed_grant_demo_owner(text) from public, anon, authenticated;

commit;
