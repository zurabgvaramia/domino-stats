-- ცვლილებების ისტორიაში ავტორის სახელის საჩვენებლად.
-- გაუშვი Supabase-ის SQL Editor-ში ერთხელ.

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

-- სახელის მინიჭება (თითო რედაქტორზე):
-- update public.app_roles set display_name = 'ზურა'
-- where user_id = (select id from auth.users where email = 'zura@example.com');
