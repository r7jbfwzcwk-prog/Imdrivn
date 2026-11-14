-- Live chat is on-screen only. A new row must not create a notification,
-- an email, a push, or an unread count.

comment on table public.chat_messages is
  'Shown only while the Live Chat screen is open. Inserts do not notify.';
