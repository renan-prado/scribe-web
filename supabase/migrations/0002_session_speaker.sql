-- Speaker identity (author + location) captured on the session header.
-- Optional in the DB — the app defaults to "Autor desconhecido" / "Local
-- desconhecido" in state, so rows always land with something readable even
-- when the user doesn't edit the fields.

alter table public.sessions
  add column if not exists speaker_name text,
  add column if not exists speaker_location text;
