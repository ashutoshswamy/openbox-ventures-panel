-- channel_members out of realtime: opening a chat writes last_read_at (markRead), which refreshed the page,
-- which marked it read again: an endless refresh loop on every open chat.
alter publication supabase_realtime drop table channel_members;
