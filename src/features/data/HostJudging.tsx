import { useQuery } from "@tanstack/react-query";
import { Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { judgeServerStatus, startJudgeServer, stopJudgeServer } from "@/db/hosting";
import { useDbMutation } from "@/hooks/useDbMutation";

/** Start/stop the local judging server and show judges the address + access code to connect. */
export function HostJudging() {
  const status = useQuery({ queryKey: ["judgeServer"], queryFn: judgeServerStatus });
  const invalidates = [["judgeServer"]];
  const start = useDbMutation<void>(() => startJudgeServer(), { invalidates, success: "Judging is now hosted on this network." });
  const stop = useDbMutation<void>(() => stopJudgeServer(), { invalidates });

  const busy = start.isPending || stop.isPending;

  if (!status.data?.running) {
    return (
      <Button variant="outline" size="sm" className="justify-start" disabled={busy} onClick={() => start.mutate()}>
        <Wifi /> Host judging
      </Button>
    );
  }

  return (
    <div className="grid gap-1.5">
      <Button variant="outline" size="sm" className="justify-start" disabled={busy} onClick={() => stop.mutate()}>
        <Wifi className="text-gold" /> Stop hosting
      </Button>
      <div className="rounded-lg border bg-muted/40 px-2.5 py-2 text-xs">
        <p className="text-muted-foreground">Judges open this on their phone browser:</p>
        <p className="mt-0.5 font-mono text-sm font-semibold select-all">{status.data.url}</p>
        <p className="mt-1 text-muted-foreground">
          Access code: <span className="font-mono text-sm font-semibold text-foreground select-all">{status.data.code}</span>
        </p>
      </div>
    </div>
  );
}
