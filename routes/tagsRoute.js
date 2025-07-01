//tagsRoute.js

const express = require("express");
const router = express.Router();
const Tag = require("../models/Tag");
const Case = require('../models/Case');
const mongoose = require('mongoose'); // Don't forget to import mongoose


// GET /api/tags - fetch all tags (for dropdown, etc)
router.get("/", async (req, res) => {
  try {
    const tags = await Tag.find().sort({ name: 1 }); // sort by name
    res.json(tags);
  } catch (err) {
    console.error("Error fetching tags:", err);
    res.status(500).json({ message: "Server error fetching tags" });
  }
});

// POST /api/tags - create a new tag (or return existing if already present)
router.post("/", async (req, res) => {
  try {
    const { name, createdBy } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Tag name required" });
    }
    // Check if tag exists (case-insensitive)
    let tag = await Tag.findOne({ name: { $regex: `^${name.trim()}$`, $options: "i" } });
    if (tag) return res.json(tag);

    tag = new Tag({ name: name.trim(), createdBy });
    await tag.save();
    res.status(201).json(tag);
  } catch (err) {
    console.error("Error creating tag:", err);
    res.status(500).json({ message: "Server error creating tag" });
  }
});

// DELETE /api/tags/:caseId/tags/:tagId - remove tag from case
router.delete('/:caseId/tags/:tagId', async (req, res) => {
  try {
    const { caseId, tagId } = req.params;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(caseId) || 
        !mongoose.Types.ObjectId.isValid(tagId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    // Remove tag reference from case
    const updatedCase = await Case.findByIdAndUpdate(
      caseId,
      { $pull: { tags: tagId } },
      { new: true }
    );

    if (!updatedCase) {
      return res.status(404).json({ message: 'Case not found' });
    }

    res.json({ 
      success: true,
      tags: updatedCase.tags
    });
  } catch (error) {
    console.error('Error removing tag:', error);
    res.status(500).json({ message: 'Server error removing tag' });
  }
});



module.exports = router;
