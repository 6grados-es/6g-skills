-- Puente web de la plataforma descargable (Supabase 6grados-curso). Aplicado el 25-nov-2026 (por partes, con execute_sql).
-- La web publicada (móvil) deja órdenes cerradas y el ordenador del cliente las recoge. Tablas cerradas (RLS sin
-- políticas): solo se entra por las tres funciones, que comprueban la llave. El secreto se genera aquí y no sale.
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table if not exists privado.plataforma_ajustes (id int primary key default 1 check (id = 1), secreto bytea not null);
insert into privado.plataforma_ajustes (id, secreto) values (1, extensions.gen_random_bytes(32)) on conflict (id) do nothing;

create table if not exists public.plataforma_ordenes (
  id bigint generated always as identity primary key,
  plataforma text not null,
  tipo text not null check (tipo in ('skill', 'rutina', 'quitar-app', 'restaurar-app')),
  datos jsonb not null default '{}'::jsonb,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'tomada', 'hecha', 'error', 'caducada')),
  nota text,
  creada timestamptz not null default now(),
  tomada timestamptz,
  hecha timestamptz
);
create index if not exists plataforma_ordenes_cola on public.plataforma_ordenes (plataforma, estado, creada);

create table if not exists public.plataforma_latido (
  plataforma text primary key,
  visto timestamptz,
  mirando timestamptz,
  estado jsonb,
  version text,
  creada timestamptz not null default now()
);
alter table public.plataforma_ordenes enable row level security;
alter table public.plataforma_latido enable row level security;

create or replace function privado.plataforma_firma(id text) returns text
language sql stable security definer set search_path = '' as $$
  select left(translate(encode(extensions.hmac(convert_to('plat.' || id, 'utf8'), (select secreto from privado.plataforma_ajustes where id = 1), 'sha256'), 'base64'), '+/=', '-_'), 32)
$$;
create or replace function privado.plataforma_id(llave text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare p text[];
begin
  if llave is null or llave !~ '^plat\.[a-z0-9]{12}\.[A-Za-z0-9_-]{32}$' then raise exception 'llave no válida' using errcode = '28000'; end if;
  p := string_to_array(llave, '.');
  if privado.plataforma_firma(p[2]) <> p[3] then raise exception 'llave no válida' using errcode = '28000'; end if;
  return p[2];
end $$;

create or replace function public.plataforma_alta() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare id text := regexp_replace(lower(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=', ''), 1, 12)), '[^a-z0-9]', 'x', 'g');
begin
  return 'plat.' || id || '.' || privado.plataforma_firma(id);
end $$;

create or replace function public.plataforma_web(llave text, orden jsonb default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare pid text := privado.plataforma_id(llave); t text; d jsonb; nuevo bigint; l public.plataforma_latido;
begin
  if orden is not null then
    t := orden->>'tipo'; d := coalesce(orden->'datos', '{}'::jsonb);
    if t is null or t not in ('skill', 'rutina', 'quitar-app', 'restaurar-app') then raise exception 'orden no válida' using errcode = '22023'; end if;
    if length(d::text) > 2000 then raise exception 'orden demasiado larga' using errcode = '22023'; end if;
    if t = 'skill' and (coalesce(jsonb_typeof(d->'nombre'), '') <> 'string' or coalesce(jsonb_typeof(d->'activada'), '') <> 'boolean') then raise exception 'orden no válida' using errcode = '22023'; end if;
    if t = 'rutina' and (coalesce(jsonb_typeof(d->'id'), '') <> 'string' or coalesce(jsonb_typeof(d->'activa'), '') <> 'boolean') then raise exception 'orden no válida' using errcode = '22023'; end if;
    if t in ('quitar-app', 'restaurar-app') and coalesce(jsonb_typeof(d->'nombre'), '') <> 'string' then raise exception 'orden no válida' using errcode = '22023'; end if;
    if (select count(*) from public.plataforma_ordenes o where o.plataforma = pid and o.estado = 'pendiente') >= 50 then raise exception 'demasiadas órdenes' using errcode = '54000'; end if;
    insert into public.plataforma_ordenes (plataforma, tipo, datos) values (pid, t, d) returning id into nuevo;
  end if;
  insert into public.plataforma_latido (plataforma, mirando) values (pid, now())
    on conflict (plataforma) do update set mirando = now() returning * into l;
  return jsonb_build_object(
    'id', nuevo, 'visto', l.visto, 'ahora', now(), 'estado', l.estado,
    'ordenes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'tipo', o.tipo, 'datos', o.datos, 'estado', o.estado, 'nota', o.nota, 'creada', o.creada) order by o.id desc)
      from (select * from public.plataforma_ordenes x where x.plataforma = pid order by x.id desc limit 15) o), '[]'::jsonb));
end $$;

-- Lo pendiente de más de 2 min caduca: un portátil que se despierta días después no aplica interruptores viejos.
create or replace function public.plataforma_agente(llave text, estado jsonb default null, resultados jsonb default '[]'::jsonb, version text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare pid text := privado.plataforma_id(llave); r jsonb; l public.plataforma_latido; tomadas jsonb;
begin
  if estado is not null and length(estado::text) > 200000 then raise exception 'estado demasiado largo' using errcode = '22023'; end if;
  for r in select * from jsonb_array_elements(coalesce(resultados, '[]'::jsonb)) loop
    update public.plataforma_ordenes o set estado = case when (r->>'ok')::boolean then 'hecha' else 'error' end,
      nota = left(r->>'nota', 300), hecha = now()
      where o.plataforma = pid and o.id = (r->>'id')::bigint and o.estado = 'tomada';
  end loop;
  update public.plataforma_ordenes o set estado = 'caducada' where o.plataforma = pid and o.estado = 'pendiente' and o.creada < now() - interval '2 minutes';
  update public.plataforma_ordenes o set estado = 'error', nota = 'el ordenador no contestó' where o.plataforma = pid and o.estado = 'tomada' and o.tomada < now() - interval '5 minutes';
  insert into public.plataforma_latido as x (plataforma, visto, estado, version) values (pid, now(), plataforma_agente.estado, plataforma_agente.version)
    on conflict (plataforma) do update set visto = now(), estado = coalesce(excluded.estado, x.estado), version = coalesce(excluded.version, x.version)
    returning * into l;
  with t as (
    update public.plataforma_ordenes o set estado = 'tomada', tomada = now()
    where o.id in (select y.id from public.plataforma_ordenes y where y.plataforma = pid and y.estado = 'pendiente' order by y.id limit 20 for update skip locked)
    returning o.id, o.tipo, o.datos)
  select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'tipo', t.tipo, 'datos', t.datos) order by t.id), '[]'::jsonb) into tomadas from t;
  return jsonb_build_object('ordenes', tomadas, 'rapido', l.mirando is not null and l.mirando > now() - interval '2 minutes');
end $$;

-- Las tres funciones públicas las puede llamar el rol anon a propósito (el puente usa la clave publicable): cada una
-- comprueba la llave antes de nada. Las de `privado` no se ven desde la API (el esquema no se expone ni da USAGE a anon).
-- Pendiente (pide confirmación y no se pudo aplicar desde un subchat): borrar órdenes de más de 7 días, p. ej. con pg_cron:
--   delete from public.plataforma_ordenes where creada < now() - interval '7 days';
