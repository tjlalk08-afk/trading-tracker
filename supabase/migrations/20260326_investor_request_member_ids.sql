alter table if exists public.investor_requests
  add column if not exists member_id uuid;

alter table if exists public.investor_requests
  add column if not exists target_member_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'investor_requests_member_id_fkey'
  ) then
    alter table public.investor_requests
      add constraint investor_requests_member_id_fkey
      foreign key (member_id)
      references public.investor_members(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'investor_requests_target_member_id_fkey'
  ) then
    alter table public.investor_requests
      add constraint investor_requests_target_member_id_fkey
      foreign key (target_member_id)
      references public.investor_members(id)
      on delete set null;
  end if;
end
$$;

update public.investor_requests ir
set member_id = im.id
from public.investor_members im
where ir.member_id is null
  and im.active = true
  and im.name = ir.member_name;

update public.investor_requests ir
set target_member_id = im.id
from public.investor_members im
where ir.target_member_id is null
  and im.active = true
  and im.name = ir.to_member_name;

create index if not exists investor_requests_member_id_idx
  on public.investor_requests (member_id);

create index if not exists investor_requests_target_member_id_idx
  on public.investor_requests (target_member_id);

create or replace function public.approve_investor_request(
  p_request_id uuid,
  p_reviewed_by uuid
)
returns table (
  request_id uuid,
  member_name text,
  request_type text,
  amount numeric,
  status text,
  created_at timestamptz,
  note text,
  to_member_name text,
  created_by uuid,
  posted_at timestamptz,
  posted_units numeric,
  unit_price numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.investor_requests%rowtype;
  v_request_member_id uuid;
  v_target_member_id uuid;
  v_total_units numeric := 0;
  v_fund_equity numeric := 0;
  v_unit_price numeric := 1;
  v_posted public.investor_posted_transactions%rowtype;
  v_units numeric := 0;
begin
  select *
  into v_request
  from public.investor_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found.';
  end if;

  if coalesce(v_request.status, '') <> 'Pending' then
    raise exception 'Only pending requests can be updated.';
  end if;

  v_request_member_id := v_request.member_id;
  v_target_member_id := v_request.target_member_id;

  if v_request_member_id is null then
    select id
    into v_request_member_id
    from public.investor_members
    where name = v_request.member_name
      and active = true
    limit 1;
  end if;

  if v_request_member_id is null then
    raise exception 'Approved request member is not linked to an active investor member.';
  end if;

  if lower(coalesce(v_request.request_type, '')) = 'transfer' then
    if v_target_member_id is null then
      select id
      into v_target_member_id
      from public.investor_members
      where name = v_request.to_member_name
        and active = true
      limit 1;
    end if;

    if v_target_member_id is null then
      raise exception 'Transfer target is not linked to an active investor member.';
    end if;
  end if;

  select coalesce(
    sum(
      case
        when txn_type = 'deposit' then coalesce(units, 0)
        when txn_type = 'grant' then coalesce(units, 0)
        when txn_type = 'withdrawal' then -coalesce(units, 0)
        else 0
      end
    ),
    0
  )
  into v_total_units
  from public.investor_transactions;

  select coalesce(equity, live_equity, account_equity, 0)
  into v_fund_equity
  from public.dashboard_snapshots
  where coalesce(mode, 'live') = 'live'
  order by created_at desc
  limit 1;

  if coalesce(v_total_units, 0) > 0 and coalesce(v_fund_equity, 0) > 0 then
    v_unit_price := v_fund_equity / v_total_units;
  else
    v_unit_price := 1;
  end if;

  if coalesce(v_unit_price, 0) <= 0 then
    v_unit_price := 1;
  end if;

  v_units := coalesce(v_request.amount, 0) / v_unit_price;

  update public.investor_requests
  set
    member_id = coalesce(member_id, v_request_member_id),
    target_member_id = case
      when lower(coalesce(v_request.request_type, '')) = 'transfer'
        then coalesce(target_member_id, v_target_member_id)
      else target_member_id
    end,
    status = 'Completed',
    reviewed_by = p_reviewed_by,
    reviewed_at = now(),
    completed_at = now()
  where id = v_request.id
  returning *
  into v_request;

  if lower(coalesce(v_request.request_type, '')) = 'deposit' then
    insert into public.investor_transactions (
      member_id,
      txn_type,
      amount,
      units,
      notes,
      effective_at
    )
    values (
      v_request_member_id,
      'deposit',
      v_request.amount,
      v_units,
      v_request.note,
      now()
    );
  elsif lower(coalesce(v_request.request_type, '')) = 'withdrawal' then
    insert into public.investor_transactions (
      member_id,
      txn_type,
      amount,
      units,
      notes,
      effective_at
    )
    values (
      v_request_member_id,
      'withdrawal',
      v_request.amount,
      v_units,
      v_request.note,
      now()
    );
  elsif lower(coalesce(v_request.request_type, '')) = 'transfer' then
    insert into public.investor_transactions (
      member_id,
      txn_type,
      amount,
      units,
      notes,
      effective_at
    )
    values
      (
        v_request_member_id,
        'withdrawal',
        v_request.amount,
        v_units,
        coalesce(v_request.note, 'Transfer out'),
        now()
      ),
      (
        v_target_member_id,
        'deposit',
        v_request.amount,
        v_units,
        coalesce(v_request.note, 'Transfer in'),
        now()
      );
  else
    raise exception 'Unsupported request type.';
  end if;

  insert into public.investor_posted_transactions (
    request_id,
    member_name,
    transaction_type,
    amount,
    units,
    posted_by,
    to_member_name
  )
  values (
    v_request.id,
    v_request.member_name,
    v_request.request_type,
    v_request.amount,
    v_units,
    p_reviewed_by,
    v_request.to_member_name
  )
  returning *
  into v_posted;

  return query
  select
    v_request.id,
    v_request.member_name,
    v_request.request_type,
    v_request.amount,
    v_request.status,
    v_request.created_at,
    v_request.note,
    v_request.to_member_name,
    v_request.created_by,
    v_posted.posted_at,
    v_posted.units,
    v_unit_price;
end;
$$;
