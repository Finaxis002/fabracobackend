import Tag from "../models/Tag.js";

// Fetch all tags (for dropdown)
export const getAllTags = async (req, res) => {
  try {
    const tags = await Tag.find();
    res.json(tags);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a tag (only if it doesn't exist)
export const createTag = async (req, res) => {
  const { name, createdBy } = req.body;
  if (!name) return res.status(400).json({ message: "Tag name required" });

  let tag = await Tag.findOne({ name: { $regex: `^${name}$`, $options: "i" } });
  if (tag) return res.json(tag); // Already exists, just return

  tag = new Tag({ name, createdBy });
  await tag.save();
  res.status(201).json(tag);
};
