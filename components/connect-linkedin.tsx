"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Linkedin } from "lucide-react";
import Link from "next/link";

export function ConnectLinkedIn() {
  return (
    <Card className="border-dashed border-2 border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
          <Linkedin className="h-6 w-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">Connect LinkedIn</CardTitle>
          <CardDescription>
            Link your LinkedIn account to publish posts directly from here.
          </CardDescription>
        </div>
        <Link href="/api/auth/linkedin/authorize">
          <Button
            variant="default"
            size="sm"
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Linkedin className="h-4 w-4" />
            Connect
          </Button>
        </Link>
      </CardHeader>
    </Card>
  );
}
