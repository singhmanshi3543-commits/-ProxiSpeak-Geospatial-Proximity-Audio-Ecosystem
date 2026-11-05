import mongoose from 'mongoose';

const connectionSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    // Sorted "idA:idB" so a pair can only ever have one connection record, in either direction.
    pairKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

connectionSchema.index({ requester: 1 });
connectionSchema.index({ recipient: 1 });

export const makePairKey = (a, b) => [a.toString(), b.toString()].sort().join(':');
export const Connection = mongoose.model('Connection', connectionSchema);
