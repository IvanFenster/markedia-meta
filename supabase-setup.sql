-- ============================================
-- Markedia Database Setup
-- Run this in Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ============================================

-- 1. Profiles table (extends auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  avatar_initials text default 'U',
  balance integer default 0,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert with check (auth.uid() = id);


-- 2. Ideas table
create table ideas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  heading text not null,
  idea_type text not null check (idea_type in ('startup', 'research')),
  categories text[] default '{}',
  form_data jsonb not null default '{}',
  scores jsonb,
  reasonings jsonb,
  overall_score integer,
  ai_preview text,
  price integer,
  suggested_price integer,
  buy_count integer default 0,
  status text default 'published' check (status in ('published', 'draft')),
  created_at timestamptz default now()
);

alter table ideas enable row level security;

-- Anyone can read published ideas (for the Market page)
create policy "Anyone can read published ideas"
  on ideas for select using (status = 'published');

-- Users can read their own ideas (including drafts)
create policy "Users can read own ideas"
  on ideas for select using (auth.uid() = user_id);

-- Users can insert their own ideas
create policy "Users can insert own ideas"
  on ideas for insert with check (auth.uid() = user_id);

-- Users can update their own ideas
create policy "Users can update own ideas"
  on ideas for update using (auth.uid() = user_id);


-- 3. Purchases table
create table purchases (
  id uuid default gen_random_uuid() primary key,
  buyer_id uuid references auth.users(id) on delete cascade not null,
  idea_id uuid references ideas(id) on delete cascade not null,
  seller_id uuid references auth.users(id) on delete cascade not null,
  price_paid integer not null,
  created_at timestamptz default now(),
  unique(buyer_id, idea_id)
);

alter table purchases enable row level security;

create policy "Users can read own purchases"
  on purchases for select using (auth.uid() = buyer_id);

create policy "Sellers can read purchases of their ideas"
  on purchases for select using (auth.uid() = seller_id);

create policy "Users can insert purchases"
  on purchases for insert with check (auth.uid() = buyer_id);


-- 4. Transactions table
create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('sale', 'purchase')),
  amount integer not null,
  idea_id uuid references ideas(id) on delete set null,
  counterparty_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table transactions enable row level security;

create policy "Users can read own transactions"
  on transactions for select using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on transactions for insert with check (auth.uid() = user_id);


-- 5. Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, display_name, avatar_initials)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 2))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- 6. Indexes for performance
create index ideas_user_id_idx on ideas(user_id);
create index ideas_status_idx on ideas(status);
create index ideas_created_at_idx on ideas(created_at desc);
create index purchases_buyer_id_idx on purchases(buyer_id);
create index purchases_idea_id_idx on purchases(idea_id);
create index transactions_user_id_idx on transactions(user_id);
create index transactions_created_at_idx on transactions(created_at desc);
