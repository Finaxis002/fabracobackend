const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema({
  srNo: String,
  ownerName: String,
  clientName: String,
  unitName: String,
  franchiseAddress: String,
  stateHead: String,
  authorizedPerson: String,
  services: [
    {
       _id: { type: String },
      id: String,
      name: String,
      status: {
        type: String,
        default: "To be Started",
      },
     remarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Remark" }],
      completionPercentage: {
        type: Number,
        default: 0,
      },
      tags: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }] // <--- add this
    },
  ],
  lastEditedService: {
    id: { type: String, default: null },
    name: { type: String, default: null },
    editedAt: { type: Date, default: null },
  },
  status: {
    type: String,
    enum: ["New-Case", "In-Progress", "Completed", "Rejected", "Approved"],
    default: "New-Case",
  },
   assignedUsers: [
  {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userId: String,   // your custom userId string
    name: String,
  },
],
  reasonForStatus: String,
  overallStatus: {
    type: String,
    default: "Pending",
  },
  lastUpdate: {
    type: Date,
    default: Date.now,
  },
  overallCompletionPercentage: {
  type: Number,
  default: 50, // Starts at 50% for new cases
},
});


caseSchema.virtual("calculatedCompletionPercentage").get(function () {
  const totalServices = this.services.length;
  if (totalServices === 0) return 50; // default for new case

  const completedCount = this.services.filter(
    (s) => s.status === "Completed"
  ).length;

  const base = 50;
  const remaining = 50;
  const increment = (completedCount * remaining) / totalServices;

  return Math.min(base + increment, 100);
});

// Enable virtuals in JSON output
caseSchema.set("toJSON", { virtuals: true });
caseSchema.set("toObject", { virtuals: true });


// Make sure this line is present and correct
module.exports = mongoose.models.Case || mongoose.model("Case", caseSchema);
