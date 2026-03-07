"use client";

import type { ExecutionListItem } from "@tolty/sdk";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Eye } from "lucide-react";

export function ExecutionDetailDialog({
  execution,
}: {
  execution: ExecutionListItem;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Execution Details</DialogTitle>
          <DialogDescription>
            {execution.productName} - {execution.status}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {execution.input && (
            <div>
              <p className="mb-1 text-sm font-medium">Input</p>
              <pre className="overflow-auto rounded-lg bg-muted p-3 text-sm">
                {JSON.stringify(execution.input, null, 2)}
              </pre>
            </div>
          )}
          {execution.output && (
            <div>
              <p className="mb-1 text-sm font-medium">Output</p>
              <pre className="overflow-auto rounded-lg bg-muted p-3 text-sm max-h-96">
                {JSON.stringify(execution.output, null, 2)}
              </pre>
            </div>
          )}
          {execution.errorMessage && (
            <div>
              <p className="mb-1 text-sm font-medium text-destructive">
                Error
              </p>
              <pre className="overflow-auto rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm">
                {execution.errorMessage}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
