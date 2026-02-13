create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default 'New chat',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists ai_conversations_user_id_idx on public.ai_conversations(user_id);
create index if not exists ai_conversations_updated_at_idx on public.ai_conversations(updated_at desc);

alter table public.ai_conversations enable row level security;

create policy "Users can read their ai conversations"
on public.ai_conversations
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create their ai conversations"
on public.ai_conversations
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their ai conversations"
on public.ai_conversations
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their ai conversations"
on public.ai_conversations
for delete
to authenticated
using (user_id = auth.uid());

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user','bot')),
  content text not null,
  images text[] default '{}'::text[],
  created_at timestamp with time zone not null default now()
);

create index if not exists ai_messages_conversation_id_idx on public.ai_messages(conversation_id);
create index if not exists ai_messages_user_id_idx on public.ai_messages(user_id);
create index if not exists ai_messages_created_at_idx on public.ai_messages(created_at);

alter table public.ai_messages enable row level security;

create policy "Users can read their ai messages"
on public.ai_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy "Users can create their ai messages"
on public.ai_messages
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create policy "Users can delete their ai messages"
on public.ai_messages
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = auth.uid()
  )
);

create or replace function public.ai_conversation_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.ai_conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists ai_messages_touch_conversation on public.ai_messages;
create trigger ai_messages_touch_conversation
after insert on public.ai_messages
for each row
execute function public.ai_conversation_touch_updated_at();
