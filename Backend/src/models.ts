import mongoose, { Schema, Document } from 'mongoose';

// --- Subscription ---
export interface ISubscription extends Document {
    userId: mongoose.Types.ObjectId;
    chainId: number;
    contractAddress: string;
    abi: any[];
    webhookUrl: string;
    eventFilters?: string[]; // Optional: specific events to listen for
    lastProcessedBlock: number;
    status: 'active' | 'paused';
    createdAt: Date;
}

const SubscriptionSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    chainId: { type: Number, required: true },
    contractAddress: { type: String, required: true },
    abi: { type: Array, required: true },
    webhookUrl: { type: String, required: true },
    eventFilters: { type: [String], default: [] },
    lastProcessedBlock: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'paused'], default: 'active' },
}, { timestamps: true });

// Index for user lookups
SubscriptionSchema.index({ userId: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

// --- Event Log ---
export enum EventStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    DELIVERED = 'DELIVERED',
    FAILED = 'FAILED', // Max retries exceeded
}

export interface IEventLog extends Document {
    subscriptionId: mongoose.Types.ObjectId;
    blockNumber: number;
    transactionHash: string;
    eventName: string;
    payload: any; // Decoded args
    status: EventStatus;
    nextRetryAt: Date;
    retryCount: number;
    createdAt: Date;
}

const EventLogSchema: Schema = new Schema({
    subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
    blockNumber: { type: Number, required: true },
    transactionHash: { type: String, required: true },
    eventName: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: Object.values(EventStatus), default: EventStatus.PENDING },
    nextRetryAt: { type: Date, default: Date.now },
    retryCount: { type: Number, default: 0 },
}, { timestamps: true });

// Index for polling/processing
EventLogSchema.index({ status: 1, nextRetryAt: 1 });

export const EventLog = mongoose.model<IEventLog>('EventLog', EventLogSchema);

// --- Delivery Attempt ---
export interface IDeliveryAttempt extends Document {
    eventLogId: mongoose.Types.ObjectId;
    responseStatus?: number;
    responseBody?: string; // maybe truncate if too long
    success: boolean;
    error?: string;
    timestamp: Date;
}

const DeliveryAttemptSchema: Schema = new Schema({
    eventLogId: { type: mongoose.Schema.Types.ObjectId, ref: 'EventLog', required: true },
    responseStatus: { type: Number },
    responseBody: { type: String },
    success: { type: Boolean, required: true },
    error: { type: String },
    timestamp: { type: Date, default: Date.now },
});

export const DeliveryAttempt = mongoose.model<IDeliveryAttempt>('DeliveryAttempt', DeliveryAttemptSchema);

// --- User ---
export enum AuthProvider {
    EMAIL = 'email',
    GOOGLE = 'google',
    GITHUB = 'github',
}

export interface IUser extends Document {
    email: string;
    passwordHash?: string; // Optional for OAuth users
    name: string;
    provider: AuthProvider;
    providerId?: string; // OAuth provider's user ID
    createdAt: Date;
}

const UserSchema: Schema = new Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String }, // Only required for email provider
    name: { type: String, required: true, trim: true },
    provider: { type: String, enum: Object.values(AuthProvider), default: AuthProvider.EMAIL },
    providerId: { type: String }, // For OAuth providers
}, { timestamps: true });

// Compound index for OAuth lookups
UserSchema.index({ provider: 1, providerId: 1 });

export const User = mongoose.model<IUser>('User', UserSchema);

// --- API Key ---
export interface IApiKey extends Document {
    userId: mongoose.Types.ObjectId;
    name: string;
    keyHash: string; // Hashed key (we never store raw keys)
    prefix: string; // First 8 chars for identification (e.g., sk_live_abc...)
    lastUsedAt?: Date;
    createdAt: Date;
}

const ApiKeySchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true },
    prefix: { type: String, required: true },
    lastUsedAt: { type: Date },
}, { timestamps: true });

ApiKeySchema.index({ userId: 1 });
ApiKeySchema.index({ keyHash: 1 }, { unique: true });

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
