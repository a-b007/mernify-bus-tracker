/**
 * faults.js — Fault injection for the simulator.
 *
 * Provides functions to:
 *  - Break down a specific bus for a duration
 *  - Inject bunching on a route (speed up trailing bus)
 *  - Listen for admin commands on stdin
 */

/**
 * Inject a breakdown on a specific bus.
 *
 * @param {Map<string,object>} fleet    — busId → bus object
 * @param {string}             busId
 * @param {number}             durationS — breakdown duration in seconds
 */
export function injectBreakdown(fleet, busId, durationS) {
  const bus = fleet.get(busId);
  if (!bus) {
    console.error(`[faults] bus ${busId} not found`);
    return false;
  }
  bus.state = "BROKEN_DOWN";
  bus.breakdownTimer = durationS;
  bus.speed = 0;
  console.log(`[faults] bus ${busId} BROKEN_DOWN for ${durationS}s`);
  return true;
}

/**
 * Inject bunching on a route by speeding up the trailing bus.
 *
 * Finds the two buses on the given route with the smallest gap
 * (by progressM) and increases the trailing bus's progressM to
 * create artificial bunching.
 *
 * @param {Map<string,object>} fleet
 * @param {string}             routeId
 */
export function injectBunching(fleet, routeId) {
  const buses = [];
  for (const bus of fleet.values()) {
    const baseRoute = bus.routeId.replace(/-UP$|-DN$/, "");
    const targetBase = routeId.replace(/-UP$|-DN$/, "");
    if (baseRoute === targetBase && bus.state === "RUNNING") {
      buses.push(bus);
    }
  }
  if (buses.length < 2) {
    console.error(`[faults] need at least 2 running buses on ${routeId}`);
    return false;
  }

  buses.sort((a, b) => a.progressM - b.progressM);

  // Find the pair with the smallest gap
  let minGap = Infinity;
  let trailing = null;
  let leading = null;
  for (let i = 0; i < buses.length - 1; i++) {
    const gap = buses[i + 1].progressM - buses[i].progressM;
    if (gap < minGap) {
      minGap = gap;
      trailing = buses[i];
      leading = buses[i + 1];
    }
  }

  // Push trailing bus forward (close 70% of the gap)
  const pushM = minGap * 0.7;
  trailing.progressM += pushM;
  console.log(
    `[faults] bunching on ${routeId}: bus ${trailing.busId} pushed ${pushM.toFixed(0)}m toward ${leading.busId}`
  );
  return true;
}

/**
 * Start listening for fault commands on stdin.
 *
 * Commands:
 *   breakdown <busId> <durationS>
 *   bunching <routeId>
 */
export function listenStdin(fleet) {
  if (!process.stdin.isTTY && process.stdin.readable) {
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      const lines = chunk.trim().split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const cmd = parts[0];
        if (cmd === "breakdown" && parts.length >= 3) {
          injectBreakdown(fleet, parts[1], parseFloat(parts[2]));
        } else if (cmd === "bunching" && parts.length >= 2) {
          injectBunching(fleet, parts[1]);
        } else {
          console.log("[faults] unknown command:", line);
        }
      }
    });
    console.log("[faults] listening for commands on stdin");
  }
}
