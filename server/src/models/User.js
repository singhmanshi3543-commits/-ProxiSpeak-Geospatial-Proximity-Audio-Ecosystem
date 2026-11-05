import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String, required: true, unique: true, lowercase: true, trim: true,
      minlength: 3, maxlength: 24, match: /^[a-z0-9_]+$/,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    displayName: { type: String, required: true, trim: true, maxlength: 40 },
    bio: { type: String, trim: true, maxlength: 160, default: '' },
    avatarColor: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: '#6366f1' },
    isDiscoverable: { type: Boolean, default: true },
    lastLoginAt: { type: Date },

    // GeoJSON Point, [lng, lat]. Absent until the user shares a location.
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], default: undefined },
    },
    locationAccuracy: { type: Number },
    locationUpdatedAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });
userSchema.index({ locationUpdatedAt: 1 });

userSchema.methods.toSelf = function toSelf() {
  return {
    id: this._id.toString(),
    username: this.username,
    email: this.email,
    displayName: this.displayName,
    bio: this.bio,
    avatarColor: this.avatarColor,
    isDiscoverable: this.isDiscoverable,
    createdAt: this.createdAt,
  };
};

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    username: this.username,
    displayName: this.displayName,
    bio: this.bio,
    avatarColor: this.avatarColor,
  };
};

export const User = mongoose.model('User', userSchema);