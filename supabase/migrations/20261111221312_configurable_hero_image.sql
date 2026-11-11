-- Additive migration generated from the site_settings declaration.
alter table public.site_settings
  add column hero_image_path text,
  add column hero_image_alt text not null default '',
  add constraint hero_image_requires_alt check (
    hero_image_path is null or (
      length(trim(hero_image_path)) > 0 and length(trim(hero_image_alt)) > 0
    )
  );
