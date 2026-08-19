import { describe, expect, it, vi } from "vitest";

import { startServer } from "../../server/lifecycle.js";

function createLifecycleHarness() {
  const events: string[] = [];
  const connectedDatabase = { name: "database" };
  const application = { name: "application" };
  const server = { name: "server" };
  const closeFrontend = vi.fn(async () => {
    events.push("frontend.close");
  });
  const database = {
    close: vi.fn(async () => {
      events.push("database.close");
    }),
    connect: vi.fn(async () => {
      events.push("database.connect");
      return connectedDatabase;
    }),
  };
  const dependencies = {
    closeServer: vi.fn(async () => {
      events.push("server.close");
    }),
    configureFrontend: vi.fn(async () => {
      events.push("frontend.configure");
      return closeFrontend;
    }),
    createApplication: vi.fn(() => {
      events.push("application.create");
      return application;
    }),
    database,
    ensureDatabaseIndexes: vi.fn(async () => {
      events.push("database.indexes");
    }),
    listen: vi.fn(async () => {
      events.push("server.listen");
      return server;
    }),
  };

  return {
    application,
    closeFrontend,
    connectedDatabase,
    database,
    dependencies,
    events,
    server,
  };
}

describe("server lifecycle", () => {
  it("connects MongoDB and creates indexes before configuring and starting the server", async () => {
    const harness = createLifecycleHarness();

    const runningServer = await startServer(harness.dependencies);

    expect(harness.events).toEqual([
      "database.connect",
      "database.indexes",
      "application.create",
      "frontend.configure",
      "server.listen",
    ]);
    expect(harness.dependencies.ensureDatabaseIndexes).toHaveBeenCalledWith(harness.connectedDatabase);
    expect(harness.dependencies.configureFrontend).toHaveBeenCalledWith(harness.application);
    expect(harness.dependencies.listen).toHaveBeenCalledWith(harness.application);

    await runningServer.shutdown();
  });

  it("cleans up MongoDB and does not listen when startup fails before frontend setup", async () => {
    const harness = createLifecycleHarness();
    const startupError = new Error("index creation failed");
    harness.dependencies.ensureDatabaseIndexes.mockRejectedValueOnce(startupError);

    await expect(startServer(harness.dependencies)).rejects.toBe(startupError);

    expect(harness.dependencies.createApplication).not.toHaveBeenCalled();
    expect(harness.dependencies.configureFrontend).not.toHaveBeenCalled();
    expect(harness.dependencies.listen).not.toHaveBeenCalled();
    expect(harness.closeFrontend).not.toHaveBeenCalled();
    expect(harness.database.close).toHaveBeenCalledTimes(1);
  });

  it("does not continue startup when MongoDB cannot connect", async () => {
    const harness = createLifecycleHarness();
    const connectionError = new Error("connection failed");
    harness.database.connect.mockRejectedValueOnce(connectionError);

    await expect(startServer(harness.dependencies)).rejects.toBe(connectionError);

    expect(harness.dependencies.ensureDatabaseIndexes).not.toHaveBeenCalled();
    expect(harness.dependencies.createApplication).not.toHaveBeenCalled();
    expect(harness.dependencies.configureFrontend).not.toHaveBeenCalled();
    expect(harness.dependencies.listen).not.toHaveBeenCalled();
    expect(harness.database.close).toHaveBeenCalledTimes(1);
  });

  it("cleans up the frontend and MongoDB when listening fails", async () => {
    const harness = createLifecycleHarness();
    const startupError = new Error("listen failed");
    harness.dependencies.listen.mockRejectedValueOnce(startupError);

    await expect(startServer(harness.dependencies)).rejects.toBe(startupError);

    expect(harness.closeFrontend).toHaveBeenCalledTimes(1);
    expect(harness.database.close).toHaveBeenCalledTimes(1);
  });

  it("returns one idempotent shutdown operation", async () => {
    const harness = createLifecycleHarness();
    const runningServer = await startServer(harness.dependencies);

    const firstShutdown = runningServer.shutdown();
    const secondShutdown = runningServer.shutdown();

    expect(secondShutdown).toBe(firstShutdown);
    await firstShutdown;
    expect(runningServer.shutdown()).toBe(firstShutdown);
    expect(harness.dependencies.closeServer).toHaveBeenCalledTimes(1);
    expect(harness.closeFrontend).toHaveBeenCalledTimes(1);
    expect(harness.database.close).toHaveBeenCalledTimes(1);
    expect(harness.events.slice(-3)).toEqual(["server.close", "frontend.close", "database.close"]);
  });

  it("closes MongoDB even when earlier shutdown steps fail", async () => {
    const harness = createLifecycleHarness();
    const serverCloseError = new Error("server close failed");
    harness.dependencies.closeServer.mockImplementationOnce(async () => {
      harness.events.push("server.close");
      throw serverCloseError;
    });
    harness.closeFrontend.mockImplementationOnce(async () => {
      harness.events.push("frontend.close");
      throw new Error("frontend close failed");
    });
    const runningServer = await startServer(harness.dependencies);

    await expect(runningServer.shutdown()).rejects.toBe(serverCloseError);

    expect(harness.database.close).toHaveBeenCalledTimes(1);
    expect(harness.events.slice(-3)).toEqual(["server.close", "frontend.close", "database.close"]);
  });
});
