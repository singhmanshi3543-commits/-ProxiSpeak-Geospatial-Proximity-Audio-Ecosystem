import mongoose from 'mongoose';

const UserLocationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    socketId: {
      type: String,
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      default: 'Engineer',
    },
    avatarColor: {
      type: String,
      default: '#3b82f6',
    },

    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length === 2;
        },
        message: 'Coordinates must be [x, y]',
      },
    },
    facingAngle: {
      type: Number,
      default: 0,
    },
    isSpeaking: {
      type: Boolean,
      default: false,
    },
    isMuted: {
      type: Boolean,
      default: false,
    },
    isDeafened: {
      type: Boolean,
      default: false,
    },
    isBot: {
      type: Boolean,
      default: false,
    },
    currentRoom: {
      type: String,
      default: 'Engineering Hub',
    },
    lastMovedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

UserLocationSchema.index({ coordinates: '2d' }, { min: -500, max: 4000 });

export const UserLocation = mongoose.model('UserLocation', UserLocationSchema);
export default UserLocation;
