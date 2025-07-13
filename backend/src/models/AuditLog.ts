import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  user?: mongoose.Types.ObjectId;
  action: string;
  resource: {
    type: 'User' | 'Event' | 'Registration' | 'Notification' | 'System';
    id?: mongoose.Types.ObjectId;
  };
  details: {
    method?: string;
    endpoint?: string;
    userAgent?: string;
    ipAddress?: string;
    changes?: {
      field: string;
      oldValue?: any;
      newValue?: any;
    }[];
    metadata?: Record<string, any>;
  };
  result: 'success' | 'failure' | 'warning';
  errorMessage?: string;
  timestamp: Date;
  sessionId?: string;
  requestId?: string;
}

const auditLogSchema: Schema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      maxlength: [100, 'Action cannot exceed 100 characters']
    },
    resource: {
      type: {
        type: String,
        enum: ['User', 'Event', 'Registration', 'Notification', 'System'],
        required: [true, 'Resource type is required']
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'resource.type'
      }
    },
    details: {
      method: String,
      endpoint: String,
      userAgent: String,
      ipAddress: String,
      changes: [{
        field: {
          type: String,
          required: true
        },
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
      }],
      metadata: mongoose.Schema.Types.Mixed
    },
    result: {
      type: String,
      enum: ['success', 'failure', 'warning'],
      required: [true, 'Result is required']
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: [1000, 'Error message cannot exceed 1000 characters']
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    sessionId: String,
    requestId: String
  },
  {
    collection: 'audit_logs',
    toJSON: {
      transform: function(doc, ret) {
        (ret as any).id = ret._id;
        delete (ret as any)._id;
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

// Indexes for performance
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ user: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ 'resource.type': 1 });
auditLogSchema.index({ 'resource.id': 1 });
auditLogSchema.index({ result: 1 });
auditLogSchema.index({ sessionId: 1 });

// Compound indexes
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ 'resource.type': 1, timestamp: -1 });
auditLogSchema.index({ action: 1, result: 1 });

// TTL index to automatically delete old logs (keep for 2 years)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 }); // 2 years

export default mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
