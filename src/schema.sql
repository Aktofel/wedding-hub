CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  venue TEXT,
  address TEXT,
  map_link TEXT,
  starts_at TIMESTAMPTZ,
  gated BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coordinator', 'usher')),
  pin_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seating_tables (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  capacity INT NOT NULL DEFAULT 10,
  pos_x NUMERIC,
  pos_y NUMERIC,
  UNIQUE (event_id, label)
);

CREATE TABLE IF NOT EXISTS invitations (
  id SERIAL PRIMARY KEY,
  import_key TEXT UNIQUE NOT NULL,
  household_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  max_party_size INT NOT NULL DEFAULT 1 CHECK (max_party_size > 0),
  side TEXT,
  vip BOOLEAN NOT NULL DEFAULT FALSE,
  language TEXT NOT NULL DEFAULT 'en',
  notes TEXT,
  token TEXT UNIQUE NOT NULL,
  backup_code TEXT UNIQUE NOT NULL,
  last_sent_at TIMESTAMPTZ,
  sent_channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitation_events (
  invitation_id INT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  table_id INT REFERENCES seating_tables(id) ON DELETE SET NULL,
  rsvp_status TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp_status IN ('pending', 'yes', 'no')),
  rsvp_count INT NOT NULL DEFAULT 0,
  rsvp_note TEXT,
  responded_at TIMESTAMPTZ,
  PRIMARY KEY (invitation_id, event_id)
);

CREATE TABLE IF NOT EXISTS checkins (
  id SERIAL PRIMARY KEY,
  client_id UUID UNIQUE NOT NULL,
  invitation_id INT REFERENCES invitations(id) ON DELETE CASCADE,
  event_id INT NOT NULL REFERENCES events(id),
  people_count INT NOT NULL CHECK (people_count > 0),
  method TEXT NOT NULL CHECK (method IN ('qr', 'code', 'search', 'walkin')),
  walkin_name TEXT,
  staff_id INT REFERENCES staff(id),
  approved_by INT REFERENCES staff(id),
  checked_in_at TIMESTAMPTZ NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checkins_inv_event ON checkins (invitation_id, event_id);

CREATE TABLE IF NOT EXISTS program_items (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  start_time TIME,
  title TEXT NOT NULL,
  led_by TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'now', 'done'))
);

CREATE TABLE IF NOT EXISTS tributes (
  id SERIAL PRIMARY KEY,
  upload_token TEXT UNIQUE NOT NULL,
  author_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('groomsman', 'bridesmaid', 'other')),
  phone TEXT,
  photo_path TEXT,
  message TEXT,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ
);