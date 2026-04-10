import { execFile } from "child_process";

export interface CliResult {
  success: boolean;
  data?: unknown;
  error?: string;
  raw?: string;
}

export function runNebius(args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      "nebius",
      [...args, "--format", "json"],
      { timeout: 60_000 },
      (error, stdout, stderr) => {
        if (error) {
          resolve({
            success: false,
            error: stderr?.trim() || error.message,
            raw: stdout,
          });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          resolve({ success: true, data });
        } catch {
          resolve({ success: true, raw: stdout.trim() });
        }
      },
    );
  });
}

export function runShell(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 120_000 }, (error, stdout, stderr) => {
      resolve({
        stdout: stdout?.trim() ?? "",
        stderr: stderr?.trim() ?? "",
        exitCode: error?.code ? Number(error.code) : error ? 1 : 0,
      });
    });
  });
}
