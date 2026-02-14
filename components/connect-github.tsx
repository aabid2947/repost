"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Github } from "lucide-react";
import Link from "next/link";

export function ConnectGitHub() {
  return (
    <Card className="border-dashed border-2 border-gray-500/30 bg-gray-50/50 dark:bg-gray-950/20">
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-900/50">
          <Github className="h-6 w-6 text-gray-600" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">Connect GitHub</CardTitle>
          <CardDescription>
            Link your GitHub account to access your repositories.
          </CardDescription>
        </div>
        <Link href="/api/auth/github/authorize">
          <Button
            variant="default"
            size="sm"
            className="gap-2 bg-gray-600 hover:bg-gray-700"
          >
            <Github className="h-4 w-4" />
            Connect
          </Button>
        </Link>
      </CardHeader>
    </Card>
  );
}
