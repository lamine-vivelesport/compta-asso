-- Table des pièces justificatives
create table if not exists documents (
  id uuid default gen_random_uuid() primary key,
  ecriture_id uuid references ecritures(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  content_type text,
  uploaded_at timestamptz default now()
);

create index if not exists documents_ecriture_id_idx on documents(ecriture_id);

alter table documents enable row level security;

drop policy if exists "Allow all" on documents;
create policy "Allow all"
  on documents for all
  to anon, authenticated
  using (true)
  with check (true);

-- Bucket Storage : créer manuellement dans le dashboard Supabase
-- Nom : documents  |  Type : Public
