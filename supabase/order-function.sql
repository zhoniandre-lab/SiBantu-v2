-- Atomic guest checkout for SiBantu V2.
-- Run after schema.sql and seed.sql.

create or replace function public.create_guest_order(
  p_recipient_name text,
  p_phone text,
  p_address_text text,
  p_landmark text,
  p_latitude double precision,
  p_longitude double precision,
  p_delivery_fee numeric,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_id uuid;
  v_guest_token uuid;
  v_address_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(14,2);
  v_total numeric(14,2);
  v_expected_count int;
  v_valid_count int;
begin
  if char_length(trim(p_recipient_name)) < 2
     or char_length(regexp_replace(p_phone, '\D', '', 'g')) < 10
     or char_length(trim(p_address_text)) < 8
     or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'INVALID_ORDER_DATA';
  end if;

  create temporary table if not exists tmp_order_items (
    product_id bigint,
    variant_id bigint,
    store_id uuid,
    product_name text,
    variant_label text,
    unit_price numeric(14,2),
    quantity numeric(12,3),
    note text,
    line_total numeric(14,2)
  ) on commit drop;
  truncate tmp_order_items;

  v_expected_count := jsonb_array_length(p_items);

  insert into tmp_order_items(product_id, variant_id, store_id, product_name, variant_label, unit_price, quantity, note, line_total)
  select
    p.id,
    v.id,
    p.store_id,
    p.name,
    v.label,
    v.price,
    i.quantity,
    nullif(trim(i.note), ''),
    round(v.price * i.quantity, 2)
  from jsonb_to_recordset(p_items) as i(product_id bigint, quantity numeric, note text)
  join products p on p.id = i.product_id
  join product_variants v on v.product_id = p.id and v.is_default = true and v.is_active = true
  join stores s on s.id = p.store_id and s.status = 'active'
  where p.is_active = true
    and p.moderation_status = 'approved'
    and i.quantity > 0
    and i.quantity <= 99
    and v.stock >= i.quantity;

  select count(*) into v_valid_count from tmp_order_items;
  if v_valid_count <> v_expected_count then
    raise exception 'PRODUCT_OR_STOCK_INVALID';
  end if;

  select coalesce(sum(line_total), 0) into v_subtotal from tmp_order_items;
  v_total := v_subtotal + greatest(coalesce(p_delivery_fee, 0), 0);

  insert into guest_sessions default values returning id, public_token into v_guest_id, v_guest_token;

  insert into addresses(guest_session_id, recipient_name, phone, address_text, landmark, latitude, longitude)
  values (v_guest_id, trim(p_recipient_name), p_phone, trim(p_address_text), nullif(trim(p_landmark), ''), p_latitude, p_longitude)
  returning id into v_address_id;

  v_order_number := 'SIB-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into orders(order_number, guest_session_id, address_id, status, subtotal, delivery_fee, discount, total, payment_method)
  values (v_order_number, v_guest_id, v_address_id, 'pending', v_subtotal, greatest(coalesce(p_delivery_fee, 0), 0), 0, v_total, 'cod')
  returning id into v_order_id;

  insert into store_orders(order_id, store_id, status, items_subtotal, platform_fee, seller_net)
  select
    v_order_id,
    store_id,
    'pending',
    sum(line_total),
    round(sum(line_total) * (s.commission_rate / 100.0), 2),
    round(sum(line_total) * (1 - s.commission_rate / 100.0), 2)
  from tmp_order_items t
  join stores s on s.id = t.store_id
  group by store_id, s.commission_rate;

  insert into order_items(order_id, store_order_id, store_id, product_name, variant_label, unit_price, quantity, line_total, note)
  select
    v_order_id,
    so.id,
    t.store_id,
    t.product_name,
    t.variant_label,
    t.unit_price,
    t.quantity,
    t.line_total,
    t.note
  from tmp_order_items t
  join store_orders so on so.order_id = v_order_id and so.store_id = t.store_id;

  insert into order_status_history(order_id, status, note)
  values (v_order_id, 'pending', 'Order dibuat melalui checkout SiBantu V2');

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'guest_token', v_guest_token,
    'subtotal', v_subtotal,
    'delivery_fee', greatest(coalesce(p_delivery_fee, 0), 0),
    'total', v_total,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.create_guest_order(text,text,text,text,double precision,double precision,numeric,jsonb) from public, anon, authenticated;
grant execute on function public.create_guest_order(text,text,text,text,double precision,double precision,numeric,jsonb) to service_role;
