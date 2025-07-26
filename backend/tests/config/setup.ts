// Simple test setup
import { vi } from "vitest";

// Create mock model class
class MockModel {
  constructor(data: any) {
    Object.assign(this, data);
  }

  static find = vi.fn().mockResolvedValue([]);

  static findById = vi.fn().mockReturnValue({
    populate: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(null),
  });

  static findOne = vi.fn().mockReturnValue({
    populate: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(null),
  });

  static create = vi.fn().mockResolvedValue({});
  static deleteMany = vi.fn().mockResolvedValue({});
  static countDocuments = vi.fn().mockResolvedValue(0);
  static aggregate = vi.fn().mockResolvedValue([]);

  save = vi.fn().mockResolvedValue(this);
}

// Mock ObjectId class
class MockObjectId {
  public id: string;

  constructor(id?: string) {
    this.id = id || "mock-object-id";
  }

  toString() {
    return this.id;
  }

  static isValid = vi.fn().mockReturnValue(true);
}

// Mock Schema class
class MockSchema {
  constructor() {}
  pre = vi.fn().mockReturnThis();
  post = vi.fn().mockReturnThis();
  index = vi.fn().mockReturnThis();
  plugin = vi.fn().mockReturnThis();
  virtual = vi.fn().mockReturnValue({
    get: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  });
  methods = {};
  statics = {};

  static Types = {
    ObjectId: MockObjectId,
    String: String,
    Number: Number,
    Date: Date,
    Boolean: Boolean,
    Array: Array,
    Mixed: Object,
  };
}

// Mock database connections to prevent timeouts
vi.mock("mongoose", () => {
  return {
    default: {
      connect: vi.fn().mockResolvedValue({}),
      connection: {
        close: vi.fn().mockResolvedValue({}),
      },
      model: vi.fn().mockReturnValue(MockModel),
      Schema: MockSchema,
      Types: {
        ObjectId: MockObjectId,
      },
    },
    connect: vi.fn().mockResolvedValue({}),
    model: vi.fn().mockReturnValue(MockModel),
    Schema: MockSchema,
    Types: {
      ObjectId: MockObjectId,
    },
  };
});
