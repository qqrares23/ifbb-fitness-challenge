import { invoke } from "@tauri-apps/api/core";

/** State of the local judging server (see src-tauri/src/judge_server.rs). */
export interface JudgeServerStatus {
  running: boolean;
  /** Address judges type into their browser, e.g. "http://192.168.1.23:8080". */
  url: string | null;
  /** This computer's other network addresses, for when `url` isn't reachable (e.g. a VPN is on). */
  otherUrls: string[];
  /** Access code judges enter to unlock judging. */
  code: string | null;
}

export const judgeServerStatus = () => invoke<JudgeServerStatus>("judge_server_status");
export const startJudgeServer = () => invoke<JudgeServerStatus>("start_judge_server");
export const stopJudgeServer = () => invoke<JudgeServerStatus>("stop_judge_server");
