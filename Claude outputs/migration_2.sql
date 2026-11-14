-- =====================================================================
-- დომინო — მიგრაცია 2
-- გაუშვი Supabase-ის SQL Editor-ში ერთიანად (schema.sql-ის შემდეგ).
-- 1) ცვლილებების ისტორიაში ავტორის სახელი
-- 2) რეიტინგის ახალი წესი: ქულა = მოგებული − წაგებული,
--    თანაბრობისას მეტი კოქსი, შემდეგ მეტი სუხოი, შემდეგ გაზიარებული ადგილი
-- 3) ოინის (ჩვეულებრივი მოგების) დათვლა
-- 4) ორი წყვილის ურთიერთშეხვედრების ბალანსი
-- =====================================================================

-- ---------- 1. ისტორია ავტორის სახელით ----------
alter table public.app_roles add column if not exists display_name text;

create or replace function public.match_history(p_match bigint)
returns table (
  id bigint,
  action text,
  old_row jsonb,
  new_row jsonb,
  changed_at timestamptz,
  changed_by_name text
)
language sql stable security definer set search_path = public as $$
  select a.id, a.action, a.old_row, a.new_row, a.changed_at,
         coalesce(r.display_name, u.email, 'უცნობი')
  from public.match_audit a
  left join public.app_roles r on r.user_id = a.changed_by
  left join auth.users u on u.id = a.changed_by
  where a.match_id = p_match
    and public.is_editor()
  order by a.changed_at desc;
$$;

revoke execute on function public.match_history(bigint) from public;
grant execute on function public.match_history(bigint) to authenticated;

-- ---------- 2–3. ინდივიდუალური და წყვილების ცხრილი ----------
-- დასაბრუნებელი სვეტები იცვლება, ამიტომ ძველი ფუნქციები ჯერ იშლება.
drop function if exists public.player_stats(timestamptz, timestamptz);
drop function if exists public.pair_stats(timestamptz, timestamptz);

-- place: ადგილი რეიტინგის წესით (თანაბარ შედეგზე ერთი და იგივე ადგილი)
create or replace function public.player_stats(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  place bigint,
  player_id bigint, name text,
  games bigint, wins bigint, losses bigint, win_pct numeric,
  points_won bigint, points_lost bigint, net_points bigint,
  oini_made bigint, sukhoi_made bigint, koksi_made bigint,
  oini_taken bigint, sukhoi_taken bigint, koksi_taken bigint
)
language sql stable set search_path = public as $$
  with s as (
    select
      p.id as player_id, p.name,
      count(r.match_id) as games,
      count(*) filter (where r.won) as wins,
      count(*) filter (where not r.won) as losses,
      round(100.0 * count(*) filter (where r.won) / nullif(count(r.match_id), 0), 1) as win_pct,
      coalesce(sum(r.points) filter (where r.won), 0) as points_won,
      coalesce(sum(r.points) filter (where not r.won), 0) as points_lost,
      count(*) filter (where r.won     and r.win_type = 'regular') as oini_made,
      count(*) filter (where r.won     and r.win_type = 'sukhoi')  as sukhoi_made,
      count(*) filter (where r.won     and r.win_type = 'koksi')   as koksi_made,
      count(*) filter (where not r.won and r.win_type = 'regular') as oini_taken,
      count(*) filter (where not r.won and r.win_type = 'sukhoi')  as sukhoi_taken,
      count(*) filter (where not r.won and r.win_type = 'koksi')   as koksi_taken
    from public.players p
    left join public.v_player_results r
      on r.player_id = p.id
     and (p_from is null or r.played_at >= p_from)
     and (p_to   is null or r.played_at <  p_to)
    group by p.id, p.name
  )
  select
    rank() over (order by s.points_won - s.points_lost desc, s.koksi_made desc, s.sukhoi_made desc),
    s.player_id, s.name, s.games, s.wins, s.losses, s.win_pct,
    s.points_won, s.points_lost, s.points_won - s.points_lost,
    s.oini_made, s.sukhoi_made, s.koksi_made,
    s.oini_taken, s.sukhoi_taken, s.koksi_taken
  from s
  order by 1, s.name;
$$;

create or replace function public.pair_stats(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  place bigint,
  p1 bigint, p2 bigint, p1_name text, p2_name text,
  games bigint, wins bigint, losses bigint, win_pct numeric,
  points_won bigint, points_lost bigint, net_points bigint,
  oini_made bigint, sukhoi_made bigint, koksi_made bigint,
  oini_taken bigint, sukhoi_taken bigint, koksi_taken bigint
)
language sql stable set search_path = public as $$
  with s as (
    select
      r.p1, r.p2, a.name as p1_name, b.name as p2_name,
      count(*) as games,
      count(*) filter (where r.won) as wins,
      count(*) filter (where not r.won) as losses,
      round(100.0 * count(*) filter (where r.won) / count(*), 1) as win_pct,
      coalesce(sum(r.points) filter (where r.won), 0) as points_won,
      coalesce(sum(r.points) filter (where not r.won), 0) as points_lost,
      count(*) filter (where r.won     and r.win_type = 'regular') as oini_made,
      count(*) filter (where r.won     and r.win_type = 'sukhoi')  as sukhoi_made,
      count(*) filter (where r.won     and r.win_type = 'koksi')   as koksi_made,
      count(*) filter (where not r.won and r.win_type = 'regular') as oini_taken,
      count(*) filter (where not r.won and r.win_type = 'sukhoi')  as sukhoi_taken,
      count(*) filter (where not r.won and r.win_type = 'koksi')   as koksi_taken
    from public.v_pair_results r
    join public.players a on a.id = r.p1
    join public.players b on b.id = r.p2
    where (p_from is null or r.played_at >= p_from)
      and (p_to   is null or r.played_at <  p_to)
    group by r.p1, r.p2, a.name, b.name
  )
  select
    rank() over (order by s.points_won - s.points_lost desc, s.koksi_made desc, s.sukhoi_made desc),
    s.p1, s.p2, s.p1_name, s.p2_name, s.games, s.wins, s.losses, s.win_pct,
    s.points_won, s.points_lost, s.points_won - s.points_lost,
    s.oini_made, s.sukhoi_made, s.koksi_made,
    s.oini_taken, s.sukhoi_taken, s.koksi_taken
  from s
  order by 1, s.p1_name, s.p2_name;
$$;

-- ---------- 4. ორი წყვილის ურთიერთშეხვედრების ბალანსი ----------
-- წყვილი A = (p_a1, p_a2), წყვილი B = (p_b1, p_b2). თანმიმდევრობას მნიშვნელობა არ აქვს.
-- აბრუნებს ერთ სტრიქონს: ორივე მხარის მაჩვენებლები გვერდიგვერდ.
create or replace function public.pair_h2h(
  p_a1 bigint, p_a2 bigint, p_b1 bigint, p_b2 bigint,
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  games bigint,
  a_wins bigint, b_wins bigint,
  a_points bigint, b_points bigint, a_net bigint,
  a_oini bigint, a_sukhoi bigint, a_koksi bigint,
  b_oini bigint, b_sukhoi bigint, b_koksi bigint,
  first_played timestamptz, last_played timestamptz
)
language sql stable set search_path = public as $$
  select
    count(*),
    count(*) filter (where r.won),
    count(*) filter (where not r.won),
    coalesce(sum(r.points) filter (where r.won), 0),
    coalesce(sum(r.points) filter (where not r.won), 0),
    coalesce(sum(case when r.won then r.points else -r.points end), 0),
    count(*) filter (where r.won     and r.win_type = 'regular'),
    count(*) filter (where r.won     and r.win_type = 'sukhoi'),
    count(*) filter (where r.won     and r.win_type = 'koksi'),
    count(*) filter (where not r.won and r.win_type = 'regular'),
    count(*) filter (where not r.won and r.win_type = 'sukhoi'),
    count(*) filter (where not r.won and r.win_type = 'koksi'),
    min(r.played_at),
    max(r.played_at)
  from public.v_pair_results r
  where r.p1 = least(p_a1, p_a2) and r.p2 = greatest(p_a1, p_a2)
    and r.o1 = least(p_b1, p_b2) and r.o2 = greatest(p_b1, p_b2)
    and (p_from is null or r.played_at >= p_from)
    and (p_to   is null or r.played_at <  p_to);
$$;

-- რედაქტორისთვის სახელის მინიჭება (თითოზე ერთხელ):
-- update public.app_roles set display_name = 'ზურა'
-- where user_id = (select id from auth.users where email = 'zura@example.com');
