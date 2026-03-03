import type { backendInterface } from "../backend.d";
// Backend service - uses createActorWithConfig to get the actor directly
import { createActorWithConfig } from "../config";

let actorInstance: backendInterface | null = null;

export async function getBackendActor(): Promise<backendInterface> {
  if (!actorInstance) {
    actorInstance = await createActorWithConfig();
  }
  return actorInstance;
}

// Reset when needed (e.g., on logout)
export function resetBackendActor(): void {
  actorInstance = null;
}
