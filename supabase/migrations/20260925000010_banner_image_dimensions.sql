-- =============================================================================
-- 0010 BANNERS: intrinsic image dimensions + "text is part of the image" flag
-- =============================================================================
-- The hero carousel sizes each slide to its image's real aspect ratio (no cropping on
-- phones). Dimensions are captured at upload time so the page can reserve the right
-- height before the image loads (no layout shift). NULL = unknown (measured in the browser).

alter table public.banners
  add column desktop_image_width  int check (desktop_image_width  is null or desktop_image_width  between 1 and 20000),
  add column desktop_image_height int check (desktop_image_height is null or desktop_image_height between 1 and 20000),
  add column mobile_image_width   int check (mobile_image_width   is null or mobile_image_width   between 1 and 20000),
  add column mobile_image_height  int check (mobile_image_height  is null or mobile_image_height  between 1 and 20000),
  -- false = the image already contains its own text/branding: render it as-is (no overlay,
  -- no heading/button); the whole slide links to link_url.
  add column show_text boolean not null default true;

-- Demo SVG banners shipped with the seed are 2100×800.
update public.banners
set desktop_image_width = 2100, desktop_image_height = 800
where desktop_image_url like '/demo/hero-%.svg' and desktop_image_width is null;
