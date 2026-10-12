import "server-only";
import { unlocker } from "./reauth";

// Bank details are shown only after the viewer re-enters their password (app/profile/bank-actions.ts).
const bank = unlocker("bank_unlock");
export const bankUnlocked = bank.unlocked;
export const setBankUnlock = bank.set;
export const clearBankUnlock = bank.clear;
