import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Fixed point where the room was created. Joining requires being within the radius of it.
    anchor: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    maxParticipants: { type: Number, min: 2, max: 6, default: 6 },
    participants: [
      {
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roomSchema.index({ anchor: '2dsphere' });
roomSchema.index({ 'participants.user': 1, isActive: 1 });

export const Room = mongoose.model('Room', roomSchema);
