"use client";

import { UserButton } from "@clerk/nextjs";
import { ArrowLeftRight } from "lucide-react";

export type PanelSwitch = { href: string; label: string };

// Compound children must be built in a client component; client references don't expose UserButton.Link etc.
export function UserMenu({ switchTo }: { switchTo?: PanelSwitch }) {
  return (
    <UserButton>
      {switchTo && (
        <UserButton.MenuItems>
          <UserButton.Link label={switchTo.label} href={switchTo.href} labelIcon={<ArrowLeftRight className="size-4" />} />
          <UserButton.Action label="manageAccount" />
          <UserButton.Action label="signOut" />
        </UserButton.MenuItems>
      )}
    </UserButton>
  );
}
