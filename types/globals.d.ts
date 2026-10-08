export {};

declare global {
  // Clerk → Sessions → Customize session token: {"metadata": "{{user.public_metadata}}"}
  interface CustomJwtSessionClaims {
    metadata?: { role?: "employee" | "manager" | "branch_head" | "hr" | "admin" };
  }
}
