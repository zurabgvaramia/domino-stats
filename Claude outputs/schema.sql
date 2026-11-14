-- =====================================================================
-- დომინოს სტატისტიკა — Supabase სქემა
-- გაუშვი Supabase-ის SQL Editor-ში ერთიანად.
-- =====================================================================

-- ---------- მოთამაშეები ----------
create table public.players (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  nickname    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------- უფლებები (ვისაც შეუძლია ჩაწერა) ----------
-- admin: მოთამაშეების მართვა, სხვებისთვის უფლების მიცემა
-- editor: პარტიების ჩაწერა და შესწორება
-- დანარჩენები (ავტორიზაციის გარეშეც) მხოლოდ კითხულობენ
create table public.app_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin', 'editor')),
  created_at  timestamptz not null default now()
);

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_roles where user_id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_roles where user_id = auth.uid() and role = 'admin');
$$;

-- ---------- პარტიები ----------
-- win_type: regular = ჩვეულებრივი (1 ქულა), sukhoi = სუხოი (2), koksi = კოქსი (3)
create table public.matches (
  id          bigint generated always as identity primary key,
  played_at   timestamptz not null default now(),
  a1          bigint not null references public.players(id),
  a2          bigint not null references public.players(id),
  b1          bigint not null references public.players(id),
  b2          bigint not null references public.players(id),
  winner      text   not null check (winner in ('A', 'B')),
  win_type    text   not null default 'regular' check (win_type in ('regular', 'sukhoi', 'koksi')),
  points      smallint generated always as (
                case win_type when 'koksi' then 3 when 'sukhoi' then 2 else 1 end
              ) stored,
  note        text,
  is_void     boolean not null default false,   -- წაშლის ნაცვლად "გაუქმება"
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_by  uuid,
  updated_at  timestamptz,
  constraint four_distinct_players check (
    a1 <> a2 and a1 <> b1 and a1 <> b2 and a2 <> b1 and a2 <> b2 and b1 <> b2
  )
);

create index matches_played_at_idx on public.matches (played_at desc);

-- წყვილის ნორმალიზება: "გიორგი + ნიკა" და "ნიკა + გიორგი" ერთი წყვილია
-- (ყოველთვის a1 < a2 და b1 < b2)
create or replace function public.matches_normalize()
returns trigger language plpgsql as $$
declare t bigint;
begin
  if new.a1 > new.a2 then t := new.a1; new.a1 := new.a2; new.a2 := t; end if;
  if new.b1 > new.b2 then t := new.b1; new.b1 := new.b2; new.b2 := t; end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

create trigger trg_matches_normalize
before insert or update on public.matches
for each row execute function public.matches_normalize();

-- ---------- ცვლილებების ისტორია ----------
create table public.match_audit (
  id          bigint generated always as identity primary key,
  match_id    bigint not null,
  action      text not null,
  old_row     jsonb,
  new_row     jsonb,
  changed_by  uuid default auth.uid(),
  changed_at  timestamptz not null default now()
);

create or replace function public.matches_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.match_audit (match_id, action, old_row, new_row)
  values (
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

create trigger trg_matches_audit
after insert or update or delete on public.matches
for each row execute function public.matches_audit();

-- =====================================================================
-- RLS (row-level security): ყველა კითხულობს, წერს მხოლოდ უფლების მქონე
-- =====================================================================
alter table public.players     enable row level security;
alter table public.matches     enable row level security;
alter table public.app_roles   enable row level security;
alter table public.match_audit enable row level security;

create policy players_read   on public.players for select using (true);
create policy players_insert on public.players for insert with check (public.is_admin());
create policy players_update on public.players for update using (public.is_admin()) with check (public.is_admin());

create policy matches_read   on public.matches for select using (true);
create policy matches_insert on public.matches for insert with check (public.is_editor());
create policy matches_update on public.matches for update using (public.is_editor()) with check (public.is_editor());
create policy matches_delete on public.matches for delete using (public.is_admin());

create policy roles_read   on public.app_roles for select using (user_id = auth.uid() or public.is_admin());
create policy roles_manage on public.app_roles for all    using (public.is_admin()) with check (public.is_admin());

create policy audit_read on public.match_audit for select using (public.is_editor());

-- =====================================================================
-- საბაზო view-ები სტატისტიკისთვის
-- =====================================================================

-- თითო პარტია = 4 სტრიქონი (თითო მოთამაშეზე)
create view public.v_player_results with (security_invoker = true) as
select
  m.id          as match_id,
  m.played_at,
  x.player_id,
  x.partner_id,
  x.team,
  case when x.team = 'A' then m.b1 else m.a1 end as opp1,
  case when x.team = 'A' then m.b2 else m.a2 end as opp2,
  (m.winner = x.team) as won,
  m.win_type,
  m.points
from public.matches m
cross join lateral (values
  (m.a1, m.a2, 'A'), (m.a2, m.a1, 'A'),
  (m.b1, m.b2, 'B'), (m.b2, m.b1, 'B')
) as x(player_id, partner_id, team)
where not m.is_void;

-- თითო პარტია = 2 სტრიქონი (თითო წყვილზე)
create view public.v_pair_results with (security_invoker = true) as
select
  m.id as match_id,
  m.played_at,
  x.p1, x.p2,           -- წყვილი (p1 < p2)
  x.o1, x.o2,           -- მოწინააღმდეგე წყვილი
  x.team,
  (m.winner = x.team) as won,
  m.win_type,
  m.points
from public.matches m
cross join lateral (values
  (m.a1, m.a2, m.b1, m.b2, 'A'),
  (m.b1, m.b2, m.a1, m.a2, 'B')
) as x(p1, p2, o1, o2, team)
where not m.is_void;

-- =====================================================================
-- სტატისტიკის ფუნქციები (პერიოდის ფილტრით; null = მთელი დრო)
-- ფრონტენდიდან: supabase.rpc('player_stats', { p_from, p_to })
-- =====================================================================

-- ინდივიდუალური ცხრილი
create or replace function public.player_stats(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  player_id bigint, name text,
  games bigint, wins bigint, losses bigint, win_pct numeric,
  points_won bigint, points_lost bigint, net_points bigint,
  koksi_made bigint, koksi_taken bigint,
  sukhoi_made bigint, sukhoi_taken bigint
)
language sql stable set search_path = public as $$
  select
    p.id, p.name,
    count(r.match_id),
    count(*) filter (where r.won),
    count(*) filter (where not r.won),
    round(100.0 * count(*) filter (where r.won) / nullif(count(r.match_id), 0), 1),
    coalesce(sum(r.points) filter (where r.won), 0),
    coalesce(sum(r.points) filter (where not r.won), 0),
    coalesce(sum(case when r.won then r.points else -r.points end), 0),
    count(*) filter (where r.won     and r.win_type = 'koksi'),
    count(*) filter (where not r.won and r.win_type = 'koksi'),
    count(*) filter (where r.won     and r.win_type = 'sukhoi'),
    count(*) filter (where not r.won and r.win_type = 'sukhoi')
  from public.players p
  left join public.v_player_results r
    on r.player_id = p.id
   and (p_from is null or r.played_at >= p_from)
   and (p_to   is null or r.played_at <  p_to)
  group by p.id, p.name
  order by 7 desc, 6 desc nulls last, 3 desc;
$$;

-- წყვილების ცხრილი
create or replace function public.pair_stats(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  p1 bigint, p2 bigint, p1_name text, p2_name text,
  games bigint, wins bigint, losses bigint, win_pct numeric,
  points_won bigint, points_lost bigint, net_points bigint,
  koksi_made bigint, koksi_taken bigint,
  sukhoi_made bigint, sukhoi_taken bigint
)
language sql stable set search_path = public as $$
  select
    r.p1, r.p2, a.name, b.name,
    count(*),
    count(*) filter (where r.won),
    count(*) filter (where not r.won),
    round(100.0 * count(*) filter (where r.won) / count(*), 1),
    coalesce(sum(r.points) filter (where r.won), 0),
    coalesce(sum(r.points) filter (where not r.won), 0),
    coalesce(sum(case when r.won then r.points else -r.points end), 0),
    count(*) filter (where r.won     and r.win_type = 'koksi'),
    count(*) filter (where not r.won and r.win_type = 'koksi'),
    count(*) filter (where r.won     and r.win_type = 'sukhoi'),
    count(*) filter (where not r.won and r.win_type = 'sukhoi')
  from public.v_pair_results r
  join public.players a on a.id = r.p1
  join public.players b on b.id = r.p2
  where (p_from is null or r.played_at >= p_from)
    and (p_to   is null or r.played_at <  p_to)
  group by r.p1, r.p2, a.name, b.name
  order by 9 desc, 8 desc, 5 desc;
$$;

-- კონკრეტული მოთამაშე: ვისთან ერთად როგორ თამაშობს
create or replace function public.partner_stats(
  p_player bigint,
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  partner_id bigint, name text,
  games bigint, wins bigint, losses bigint, win_pct numeric, net_points bigint
)
language sql stable set search_path = public as $$
  select
    r.partner_id, pl.name,
    count(*),
    count(*) filter (where r.won),
    count(*) filter (where not r.won),
    round(100.0 * count(*) filter (where r.won) / count(*), 1),
    coalesce(sum(case when r.won then r.points else -r.points end), 0)
  from public.v_player_results r
  join public.players pl on pl.id = r.partner_id
  where r.player_id = p_player
    and (p_from is null or r.played_at >= p_from)
    and (p_to   is null or r.played_at <  p_to)
  group by r.partner_id, pl.name
  order by 6 desc, 3 desc;
$$;

-- კონკრეტული მოთამაშე: ვის წინააღმდეგ როგორ თამაშობს
create or replace function public.opponent_stats(
  p_player bigint,
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  opponent_id bigint, name text,
  games bigint, wins bigint, losses bigint, win_pct numeric, net_points bigint
)
language sql stable set search_path = public as $$
  select
    o.opp_id, pl.name,
    count(*),
    count(*) filter (where r.won),
    count(*) filter (where not r.won),
    round(100.0 * count(*) filter (where r.won) / count(*), 1),
    coalesce(sum(case when r.won then r.points else -r.points end), 0)
  from public.v_player_results r
  cross join lateral (values (r.opp1), (r.opp2)) as o(opp_id)
  join public.players pl on pl.id = o.opp_id
  where r.player_id = p_player
    and (p_from is null or r.played_at >= p_from)
    and (p_to   is null or r.played_at <  p_to)
  group by o.opp_id, pl.name
  order by 6 desc, 3 desc;
$$;

-- =====================================================================
-- პირველი ადმინის დანიშვნა (ერთხელ, ხელით):
-- 1) საიტზე შედი შენი email-ით (magic link), რომ auth.users-ში გაჩნდე
-- 2) გაუშვი:
--    insert into public.app_roles (user_id, role)
--    select id, 'admin' from auth.users where email = 'შენი@email.ge';
-- =====================================================================
