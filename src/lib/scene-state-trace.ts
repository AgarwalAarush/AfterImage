import { z } from "zod";

const symbol = z.string().min(1).max(5);
export const stateTraceSchema = z.object({
  initial: z.object({ state: symbol, h: symbol, z: symbol, observation: symbol }),
  branches: z.array(z.object({
    mode: z.enum(["replay", "imagination"]),
    steps: z.array(z.object({ state: symbol, h: symbol, z: symbol, action: symbol, observation: symbol.nullable() })).min(1).max(2),
  })).length(2),
});
export type StateTrace = z.infer<typeof stateTraceSchema>;
export function validateStateTrace(trace: StateTrace) {
  if(new Set(trace.branches.map(branch => branch.mode)).size !== 2)
    throw new Error("A state trace compares one replay branch and one imagined branch.");
  const states=[trace.initial.state,...trace.branches.flatMap(branch=>branch.steps.map(step=>step.state))];
  if(new Set(states).size!==states.length)throw new Error("State trace snapshots need distinct identities after their shared start.");
  for(const branch of trace.branches)for(const step of branch.steps){
    if(branch.mode === "replay" ? step.observation === null : step.observation !== null)
      throw new Error("Replay states need fresh observations; imagined states must not receive them.");
  }
}
