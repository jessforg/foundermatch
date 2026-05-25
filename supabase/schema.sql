-- ============================================
-- FOUNDERMATCH - Schéma Base de Données
-- À copier-coller dans Supabase SQL Editor
-- ============================================

-- 1. TABLE PROFILS
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  age int,
  title text,
  sector text,
  idea text,
  looking_for text,
  skills text[], -- tableau de compétences
  location text,
  stage text,
  avatar text,
  accent text default '#4ECDC4',
  created_at timestamp with time zone default now()
);

-- 2. TABLE SWIPES (qui a swipé qui)
create table swipes (
  id uuid default gen_random_uuid() primary key,
  swiper_id uuid references profiles(id) on delete cascade,
  swiped_id uuid references profiles(id) on delete cascade,
  direction text check (direction in ('match', 'pass')),
  created_at timestamp with time zone default now(),
  unique(swiper_id, swiped_id)
);

-- 3. TABLE MATCHES (match mutuel)
create table matches (
  id uuid default gen_random_uuid() primary key,
  user1_id uuid references profiles(id) on delete cascade,
  user2_id uuid references profiles(id) on delete cascade,
  created_at timestamp with time zone default now(),
  unique(user1_id, user2_id)
);

-- 4. TABLE MESSAGES
create table messages (
  id uuid default gen_random_uuid() primary key,
  match_id uuid references matches(id) on delete cascade,
  sender_id uuid references profiles(id) on delete cascade,
  text text not null,
  created_at timestamp with time zone default now()
);

-- ============================================
-- SÉCURITÉ (Row Level Security)
-- ============================================

alter table profiles enable row level security;
alter table swipes enable row level security;
alter table matches enable row level security;
alter table messages enable row level security;

-- Profils : tout le monde peut lire, seul l'owner peut modifier
create policy "Profils lisibles par tous" on profiles for select using (true);
create policy "Modifier son propre profil" on profiles for all using (auth.uid() = id);

-- Swipes : privés par utilisateur
create policy "Voir ses propres swipes" on swipes for select using (auth.uid() = swiper_id);
create policy "Créer ses swipes" on swipes for insert with check (auth.uid() = swiper_id);

-- Matches : visibles par les deux participants
create policy "Voir ses matches" on matches for select
  using (auth.uid() = user1_id or auth.uid() = user2_id);
create policy "Créer un match" on matches for insert with check (true);

-- Messages : visibles dans le match concerné
create policy "Voir messages du match" on messages for select
  using (
    exists (
      select 1 from matches
      where matches.id = messages.match_id
      and (matches.user1_id = auth.uid() or matches.user2_id = auth.uid())
    )
  );
create policy "Envoyer un message" on messages for insert
  with check (auth.uid() = sender_id);

-- ============================================
-- REALTIME (messages en temps réel)
-- ============================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table matches;
