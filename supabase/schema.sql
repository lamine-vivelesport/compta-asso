create table if not exists ecritures (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  numero_piece text not null default '',
  libelle text not null,
  compte_debit text not null,
  compte_credit text not null,
  montant decimal(15,2) not null check (montant > 0),
  journal_code text not null check (journal_code in ('AC','VE','BQ','CA','OD')),
  created_at timestamptz default now()
);

create index if not exists ecritures_date_idx on ecritures(date);
create index if not exists ecritures_journal_code_idx on ecritures(journal_code);
create index if not exists ecritures_compte_debit_idx on ecritures(compte_debit);
create index if not exists ecritures_compte_credit_idx on ecritures(compte_credit);

alter table ecritures enable row level security;
create policy "Allow all" on ecritures for all using (true) with check (true);
