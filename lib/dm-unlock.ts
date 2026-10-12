import "server-only";
import { unlocker } from "./reauth";

// Admins read other people's DMs only after re-entering their password (app/chat/actions.ts).
export const dms = unlocker("dm_unlock", 15 * 60);
