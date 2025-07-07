const express = require('express');
const { addCase , getCases, getcase, updateCase, deleteCase} = require('../controllers/caseController.js');
const { authMiddleware } = require('../middleware/auth');
const ChatMessage = require("../models/chatMessage");
const Case = require("../models/Case.js");
const router = express.Router();

router.post('/add', authMiddleware, addCase);   

router.get('/', authMiddleware, getCases);

router.get('/:id', getcase)


router.put('/:id',authMiddleware, updateCase)


router.delete('/:id',authMiddleware, deleteCase);


router.get('/:caseId/messages', async (req, res) => {
  const { caseId } = req.params;
  try {
    console.log('Fetching messages for case:', caseId);
    const messages = await ChatMessage.find({ caseId }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to load messages' });
  }
});

// PATCH /api/cases/:caseId/services/:serviceId/status
// router.patch("/:caseId/services/:serviceId/status", authMiddleware, async (req, res) => {
//   const { caseId, serviceId } = req.params;
//   const { status } = req.body;
//   if (!status) return res.status(400).json({ message: "Missing status" });

//   try {
//     const updated = await Case.findOneAndUpdate(
//       { _id: caseId, "services._id": serviceId },
//       { $set: { "services.$.status": status, lastUpdate: new Date() } },
//       { new: true }
//     );
//     if (!updated) return res.status(404).json({ message: "Case/Service not found" });

//     res.json({
//       message: "Service status updated",
//       case: updated
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Error updating status", error: err.message });
//   }
// });


// ...existing code...
router.patch("/:caseId/services/:serviceId/status", authMiddleware, async (req, res) => {
  const { caseId, serviceId } = req.params;
  const { status } = req.body;
  if (!status) return res.status(400).json({ message: "Missing status" });

  try {
    // Update the service status
    const updatedCase = await Case.findOneAndUpdate(
      { _id: caseId, "services._id": serviceId },
      { $set: { "services.$.status": status, lastUpdate: new Date() } },
      { new: true }
    );
    if (!updatedCase) return res.status(404).json({ message: "Case/Service not found" });

    // Recalculate overall status and completion percentage
    const total = updatedCase.services.length;
    const completed = updatedCase.services.filter(s => s.status === "Completed").length;
    let overallStatus = updatedCase.status;
    if (completed === total && total > 0) {
      overallStatus = "Completed";
    } else if (updatedCase.services.some(s => s.status === "In-Progress")) {
      overallStatus = "In-Progress";
    } else {
      overallStatus = "New-Case";
    }
    const overallCompletionPercentage = total === 0 ? 50 : Math.min(50 + (completed * 50) / total, 100);

    updatedCase.status = overallStatus;
    updatedCase.overallStatus = overallStatus;
    updatedCase.overallCompletionPercentage = overallCompletionPercentage;
    await updatedCase.save();

    res.json({
      message: "Service status updated",
      case: updatedCase
    });
  } catch (err) {
    res.status(500).json({ message: "Error updating status", error: err.message });
  }
});
// ...existing code...



router.patch('/:caseId/services/:serviceId/tags', async (req, res) => {
  const { caseId, serviceId } = req.params;
  const { tagIds } = req.body;

  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) return res.status(404).json({ message: 'Case not found' });

    const service = caseDoc.services.find(s => s.id === serviceId);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    service.tags = tagIds;
    await caseDoc.save();

    // Populate tags of all services, or just the updated service's tags
    await caseDoc.populate('services.tags');

    const updatedService = caseDoc.services.find(s => s.id === serviceId);
    res.status(200).json(updatedService.tags);

  } catch (err) {
    res.status(500).json({ message: 'Failed to update tags', error: err.message });
  }
});

// DELETE /api/cases/:caseId/services/:serviceId/tags/:tagId
router.delete('/:caseId/services/:serviceId/tags/:tagId', async (req, res) => {
  const { caseId, serviceId, tagId } = req.params;

  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) return res.status(404).json({ message: 'Case not found' });

    // Find service by id inside case.services
    const service = caseDoc.services.id(serviceId) || caseDoc.services.find(s => s.id === serviceId);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    // Remove the tag ID from service.tags array
    service.tags = service.tags.filter(t => t.toString() !== tagId);

    await caseDoc.save();

    res.json({ message: "Tag removed from service successfully", tags: service.tags });
  } catch (error) {
    console.error('Failed to remove tag:', error);
    res.status(500).json({ message: 'Server error removing tag' });
  }
});






module.exports = router;
