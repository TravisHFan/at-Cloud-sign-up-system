import mongoose, { Schema, Document } from 'mongoose';

export interface IRegistration extends Document {
  user: mongoose.Types.ObjectId;
  event: mongoose.Types.ObjectId;
  status: 'registered' | 'waitlisted' | 'cancelled' | 'attended' | 'no-show';
  registrationDate: Date;
  cancellationDate?: Date;
  cancellationReason?: string;
  attendanceMarked?: boolean;
  attendanceTime?: Date;
  feedback?: {
    rating: number;
    comment?: string;
    responses: {
      questionId: string;
      answer: string | number | string[];
    }[];
    submittedAt: Date;
  };
  paymentInfo?: {
    transactionId: string;
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    paymentMethod: string;
    paidAt?: Date;
  };
  specialRequests?: string;
  referralSource?: string;
  qrCode?: string;
  remindersSent: {
    oneDayBefore: boolean;
    oneHourBefore: boolean;
    custom: Date[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const registrationSchema: Schema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required']
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Event is required']
    },
    status: {
      type: String,
      enum: ['registered', 'waitlisted', 'cancelled', 'attended', 'no-show'],
      default: 'registered'
    },
    registrationDate: {
      type: Date,
      default: Date.now,
      required: true
    },
    cancellationDate: Date,
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
    },
    attendanceMarked: {
      type: Boolean,
      default: false
    },
    attendanceTime: Date,
    feedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: {
        type: String,
        trim: true,
        maxlength: [1000, 'Feedback comment cannot exceed 1000 characters']
      },
      responses: [{
        questionId: {
          type: String,
          required: true
        },
        answer: mongoose.Schema.Types.Mixed
      }],
      submittedAt: Date
    },
    paymentInfo: {
      transactionId: {
        type: String,
        unique: true,
        sparse: true
      },
      amount: {
        type: Number,
        min: 0
      },
      currency: {
        type: String,
        default: 'USD'
      },
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
      },
      paymentMethod: String,
      paidAt: Date
    },
    specialRequests: {
      type: String,
      trim: true,
      maxlength: [500, 'Special requests cannot exceed 500 characters']
    },
    referralSource: {
      type: String,
      trim: true,
      maxlength: [100, 'Referral source cannot exceed 100 characters']
    },
    qrCode: String,
    remindersSent: {
      oneDayBefore: {
        type: Boolean,
        default: false
      },
      oneHourBefore: {
        type: Boolean,
        default: false
      },
      custom: [Date]
    }
  },
  {
    timestamps: true,
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
registrationSchema.index({ user: 1 });
registrationSchema.index({ event: 1 });
registrationSchema.index({ status: 1 });
registrationSchema.index({ registrationDate: -1 });
registrationSchema.index({ 'paymentInfo.status': 1 });

// Compound indexes
registrationSchema.index({ user: 1, event: 1 }, { unique: true }); // Prevent duplicate registrations
registrationSchema.index({ event: 1, status: 1 });
registrationSchema.index({ user: 1, status: 1 });

// Generate QR code before saving
registrationSchema.pre<IRegistration>('save', function(next) {
  if (this.isNew && !this.qrCode) {
    // Generate a unique QR code string
    const crypto = require('crypto');
    this.qrCode = crypto.randomBytes(16).toString('hex');
  }
  next();
});

export default mongoose.model<IRegistration>('Registration', registrationSchema);
