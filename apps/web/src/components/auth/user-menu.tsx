"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

export function UserMenu(): JSX.Element {
  return (
    <Button variant="ghost" size="sm" onClick={() => void signOut()} className="gap-2">
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
