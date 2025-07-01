const mongoose = require ("mongoose") ;

// A small palette of visible, accessible colors
const colorPalette = [
  "#3B82F6", "#F59E42", "#10B981", "#F472B6",
  "#EF4444", "#8B5CF6", "#FBBF24", "#06B6D4",
  "#6366F1", "#F43F5E", "#84CC16", "#EA580C"
];

// Utility to pick a random color
function getRandomColor() {
  return colorPalette[Math.floor(Math.random() * colorPalette.length)];
}

const TagSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  color: { type: String, required: true, default: getRandomColor }, // Always assigned
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// Enforce case-insensitive uniqueness on name
TagSchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

// Add the pre-save hook here:
TagSchema.pre('save', function (next) {
  if (this.name.toLowerCase() === 'approved') {
    this.color = '#10B981'; // green
  } else if (!this.color) {
    this.color = getRandomColor();
  }
  next();
});

module.exports = mongoose.model("Tag", TagSchema);
