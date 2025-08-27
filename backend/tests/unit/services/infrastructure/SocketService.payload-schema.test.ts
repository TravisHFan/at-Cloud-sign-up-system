import { describe, it, expect, beforeEach, vi } from "vitest";
import { socketService } from "../../../../src/services/infrastructure/SocketService";

describe("SocketService payload schema", () => {
  let mockIO: any;

  beforeEach(() => {
    // Reset singleton internal state
    (socketService as any).authenticatedSockets = new Map();
    (socketService as any).userSockets = new Map();

    mockIO = {
      emit: vi.fn(),
      to: vi.fn().mockReturnThis(),
    };
    (socketService as any).io = mockIO;
  });

  const isISODateString = (value: string) => !Number.isNaN(Date.parse(value));

  it("emits system_message_update with expected shape", () => {
    socketService.emitSystemMessageUpdate("user-1", "system:test", { foo: 1 });

    expect(mockIO.to).toHaveBeenCalledWith("user:user-1");
    const [eventName, payload] =
      mockIO.to.mock.results[0].value.emit.mock.calls[0];

    expect(eventName).toBe("system_message_update");
    expect(payload).toMatchObject({ event: "system:test", data: { foo: 1 } });
    expect(typeof payload.timestamp).toBe("string");
    expect(isISODateString(payload.timestamp)).toBe(true);
  });

  it("emits unread_count_update with expected shape", () => {
    const counts = { bellNotifications: 2, systemMessages: 3, total: 5 };
    socketService.emitUnreadCountUpdate("user-2", counts);

    expect(mockIO.to).toHaveBeenCalledWith("user:user-2");
    const [eventName, payload] =
      mockIO.to.mock.results[0].value.emit.mock.calls[0];

    expect(eventName).toBe("unread_count_update");
    expect(payload.counts).toEqual(counts);
    expect(typeof payload.timestamp).toBe("string");
    expect(isISODateString(payload.timestamp)).toBe(true);
  });

  it("emits event_update globally and to the event room with expected shape", () => {
    const data = { bar: 2 };
    socketService.emitEventUpdate("evt-1", "guest_updated", data);

    // Global emit
    const [globalEventName, globalPayload] = mockIO.emit.mock.calls[0];
    expect(globalEventName).toBe("event_update");
    expect(globalPayload).toMatchObject({
      eventId: "evt-1",
      updateType: "guest_updated",
      data,
    });
    expect(typeof globalPayload.timestamp).toBe("string");
    expect(isISODateString(globalPayload.timestamp)).toBe(true);

    // Room emit
    expect(mockIO.to).toHaveBeenCalledWith("event:evt-1");
    const [roomEventName, roomPayload] =
      mockIO.to.mock.results[0].value.emit.mock.calls[0];
    expect(roomEventName).toBe("event_update");
    expect(roomPayload).toMatchObject({
      eventId: "evt-1",
      updateType: "guest_updated",
      data,
    });
    expect(typeof roomPayload.timestamp).toBe("string");
    expect(isISODateString(roomPayload.timestamp)).toBe(true);
  });

  it("emits event_room_update to the event room with expected shape", () => {
    const data = { baz: 3 };
    socketService.emitEventRoomUpdate("evt-2", "guest_registration", data);

    expect(mockIO.to).toHaveBeenCalledWith("event:evt-2");
    const [eventName, payload] =
      mockIO.to.mock.results[0].value.emit.mock.calls[0];
    expect(eventName).toBe("event_room_update");
    expect(payload).toMatchObject({
      eventId: "evt-2",
      updateType: "guest_registration",
      data,
    });
    expect(typeof payload.timestamp).toBe("string");
    expect(isISODateString(payload.timestamp)).toBe(true);
  });

  it("emits role_full update type with minimal payload", () => {
    const data = { roleId: "r1" };
    socketService.emitEventUpdate("evt-3", "role_full", data);

    const [eventName, payload] = (mockIO.emit as any).mock.calls.at(-1);
    expect(eventName).toBe("event_update");
    expect(payload).toMatchObject({
      eventId: "evt-3",
      updateType: "role_full",
      data,
    });
    expect(typeof payload.timestamp).toBe("string");
    expect(isISODateString(payload.timestamp)).toBe(true);
  });

  it("emits role_available update type with minimal payload", () => {
    const data = { roleId: "r2" };
    socketService.emitEventUpdate("evt-3b", "role_available" as any, data);

    const [eventName, payload] = (mockIO.emit as any).mock.calls.at(-1);
    expect(eventName).toBe("event_update");
    expect(payload).toMatchObject({
      eventId: "evt-3b",
      updateType: "role_available",
      data,
    });
    expect(typeof payload.timestamp).toBe("string");
    expect(isISODateString(payload.timestamp)).toBe(true);
  });

  it("emits role_available via emitEventUpdate to the event room with expected shape", () => {
    const data = { roleId: "r9" };
    socketService.emitEventUpdate("evt-7", "role_available" as any, data);

    // Room emit should be invoked for the event
    expect(mockIO.to).toHaveBeenCalledWith("event:evt-7");
    const [roomEventName, roomPayload] =
      mockIO.to.mock.results[0].value.emit.mock.calls[0];
    expect(roomEventName).toBe("event_update");
    expect(roomPayload).toMatchObject({
      eventId: "evt-7",
      updateType: "role_available",
      data,
    });
    expect(typeof roomPayload.timestamp).toBe("string");
    expect(isISODateString(roomPayload.timestamp)).toBe(true);
  });

  it("preserves inline event snapshot for user_moved", () => {
    const eventSnapshot = { id: "evt-4", title: "Event Title" };
    const data = {
      userId: "u1",
      fromRoleId: "r1",
      toRoleId: "r2",
      fromRoleName: "Role A",
      toRoleName: "Role B",
      event: eventSnapshot,
    };

    socketService.emitEventUpdate("evt-4", "user_moved", data);

    const [eventName, payload] = (mockIO.emit as any).mock.calls.at(-1);
    expect(eventName).toBe("event_update");
    expect(payload.updateType).toBe("user_moved");
    expect(payload.eventId).toBe("evt-4");
    // Snapshot should be passed through intact
    expect((payload.data as any).event).toBe(eventSnapshot);
    expect(payload.data as any).toMatchObject({
      userId: "u1",
      fromRoleId: "r1",
      toRoleId: "r2",
      fromRoleName: "Role A",
      toRoleName: "Role B",
    });
    expect(typeof payload.timestamp).toBe("string");
    expect(isISODateString(payload.timestamp)).toBe(true);
  });

  it("preserves inline event snapshot for guest_moved", () => {
    const eventSnapshot = { id: "evt-5", title: "Moved Event" };
    const data = {
      fromRoleId: "r1",
      toRoleId: "r2",
      fromRoleName: "Role A",
      toRoleName: "Role B",
      guestName: "Alpha Guest",
      event: eventSnapshot,
    };

    socketService.emitEventUpdate("evt-5", "guest_moved" as any, data);

    const [eventName, payload] = (mockIO.emit as any).mock.calls.at(-1);
    expect(eventName).toBe("event_update");
    expect(payload.updateType).toBe("guest_moved");
    expect(payload.eventId).toBe("evt-5");
    expect((payload.data as any).event).toBe(eventSnapshot);
    expect(payload.data as any).toMatchObject({
      fromRoleId: "r1",
      toRoleId: "r2",
      fromRoleName: "Role A",
      toRoleName: "Role B",
      guestName: "Alpha Guest",
    });
    expect(typeof payload.timestamp).toBe("string");
    expect(isISODateString(payload.timestamp)).toBe(true);
  });

  it("preserves inline event snapshot for user_assigned", () => {
    const eventSnapshot = { id: "evt-6", title: "Assigned Event" };
    const data = {
      operatorId: "admin",
      userId: "u1",
      roleId: "r1",
      roleName: "Role A",
      event: eventSnapshot,
    };

    socketService.emitEventUpdate("evt-6", "user_assigned" as any, data);

    const [eventName, payload] = (mockIO.emit as any).mock.calls.at(-1);
    expect(eventName).toBe("event_update");
    expect(payload.updateType).toBe("user_assigned");
    expect(payload.eventId).toBe("evt-6");
    expect((payload.data as any).event).toBe(eventSnapshot);
    expect(payload.data as any).toMatchObject({
      operatorId: "admin",
      userId: "u1",
      roleId: "r1",
      roleName: "Role A",
    });
    expect(typeof payload.timestamp).toBe("string");
    expect(isISODateString(payload.timestamp)).toBe(true);
  });
});
