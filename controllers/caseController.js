const Case = require("../models/Case.js");
const User = require("../models/User.js");
const Notification = require("../models/Notification");
const Admin = require("../models/Admin"); // adjust path if needed
const notificationService = require("../services/notificationService");
const Tag = require("../models/Tag.js"); // adjust path if needed

const addCase = async (req, res) => {
  console.log("REQ.USER:", req.user); // Add this line for debugging
  const { name: creatorName, _id: creatorId } = req.user || {};

  try {
    const {
      srNo,
      ownerName,
      clientName,
      unitName,
      franchiseAddress,
      stateHead,
      authorizedPerson,
      services,
      assignedUsers,
      reasonForStatus,
      status,
    } = req.body;

    let cleanedServices = services;
    if (Array.isArray(services)) {
      cleanedServices = services.map((s) => {
        const { _id, ...rest } = s;
        return rest;
      });
    }

    const userIds = Array.isArray(assignedUsers)
      ? assignedUsers.map((u) => (typeof u === "object" ? u._id : u))
      : [];

    const usersFromDb = await User.find({
      _id: { $in: userIds },
    }).select("userId name");

    const formattedAssignedUsers = userIds.map((userId) => {
      const user = usersFromDb.find(
        (u) => u._id.toString() === userId.toString()
      );
      return {
        _id: user ? user._id : userId,
        userId: user ? user.userId : null,
        name: user ? user.name : `User ${userId}`,
      };
    });

    const totalServices = services ? services.length : 0;
    const completedCount = services
      ? services.filter((s) => s.status === "Completed").length
      : 0;

    const base = 50;
    const remaining = 50;

    const overallCompletionPercentage =
      totalServices === 0
        ? 50
        : Math.min(base + (completedCount * remaining) / totalServices, 100);

    const newCase = new Case({
      srNo,
      ownerName,
      clientName,
      unitName,
      franchiseAddress,
      stateHead,
      authorizedPerson,
      services: cleanedServices, // use cleaned services here
      overallCompletionPercentage,
      overallStatus: status || "To-be-Started",
      status: status || "New-Case",
      assignedUsers: formattedAssignedUsers,
      reasonForStatus,
      lastUpdate: new Date(),
      createdBy: creatorId,
      lastEditedService: {
        id: null,
        name: null,
        editedAt: null,
      },
    });

    const savedCase = await newCase.save();

    // 🔔 Notify Assigned Users
    for (const assignedUser of formattedAssignedUsers) {
      await Notification.create({
        type: "creation",
        userId: assignedUser._id,
        userName: assignedUser.name,
        caseId: savedCase._id,
        caseName: savedCase.unitName,
        createdBy: creatorId,
        message: `You have been assigned to a new case: "${savedCase.unitName}" created by ${creatorName}.`,

        // <-- added createdBy field
      });
    }

    // 🔔 Notify All Admins (optional: only Super Admins if needed)
    const admins = await Admin.find().select("_id name"); // Adjust if you want only Super Admins
    const assignedNames = formattedAssignedUsers.map((u) => u.name).join(", ");

    for (const admin of admins) {
      await Notification.create({
        type: "creation",
        userId: admin._id,
        userName: admin.name,
        caseId: savedCase._id,
        caseName: savedCase.unitName,
        createdBy: creatorId,
        message: `A new case "${savedCase.unitName}" has been created by ${creatorName} and assigned to: ${assignedNames}.`,

        // <-- added here as well
      });
    }

    res.status(201).json({
      message: "Case created successfully",
      case: savedCase,
    });
  } catch (error) {
    console.error("Error adding case:", error);
    res.status(500).json({
      message: "Failed to create case",
      error: error.message,
    });
  }
};

const getCases = async (req, res) => {
  try {
    const cases = await Case.find().sort({ lastUpdate: -1 });

    // Convert legacy string assignments to objects
    const formattedCases = cases.map((c) => ({
      ...c._doc,
      assignedUsers: c.assignedUsers.map((u) =>
        typeof u === "string" ? { _id: u, name: u } : u
      ),
    }));

    res.status(200).json(formattedCases);
  } catch (error) {
    console.error("Error fetching cases:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch cases", error: error.message });
  }
};

const getcase = async (req, res) => {
  try {
    const found = await Case.findById(req.params.id);
    if (!found) return res.status(404).json({ message: "Case not found" });

    // assignedUsers formatting (your existing code)
    const assignedUsersFormatted = found.assignedUsers.map((u) =>
      typeof u === "string" ? { _id: u, name: u } : u
    );

    // --- NEW: Populate tags inside each service ---
    // This modifies found.services in-place
    if (Array.isArray(found.services)) {
      for (const service of found.services) {
        if (Array.isArray(service.tags) && service.tags.length > 0) {
          // Fetch tag details for these ObjectIds
          const tags = await Tag.find({ _id: { $in: service.tags } }).lean();
          service.tags = tags;
        } else {
          service.tags = [];
        }
      }
    }

    // Prepare response object using virtual calculatedCompletionPercentage
    const response = {
      ...found.toObject(), // toObject includes virtuals because of your schema setting
      assignedUsers: assignedUsersFormatted,
      overallCompletionPercentage: found.calculatedCompletionPercentage, // override with virtual
    };

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

function mergeServices(oldServices, newServices) {
  // Create a map of old services for quick lookup
  const oldServicesMap = new Map(
    oldServices.map((os) => [os._id?.toString() || os.id, os])
  );

  // Process new services - update existing or add new
  const mergedServices = newServices.map((ns) => {
    const serviceId = ns._id?.toString() || ns.id;
    const existingService = oldServicesMap.get(serviceId);
    return existingService ? { ...existingService, ...ns } : ns;
  });

  return mergedServices;
}

// Then in your updateCase function, modify the services update logic:

const updateCase = async (req, res) => {
  const updatedByUserId = req.user?._id || null;
  const updatedByUserName = req.user?.name || "Unknown User";

  try {
    const {
      srNo,
      ownerName,
      clientName,
      unitName,
      franchiseAddress,
      stateHead,
      authorizedPerson,
      services,
      assignedUsers,
      reasonForStatus,
      status: reqStatus, // renamed to avoid const reassignment error
    } = req.body;

    const caseId = req.params.id;
    const existingCase = await Case.findById(caseId);

    if (!existingCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    // Track changes
    const changes = [];
    const excludedKeys = [
      "lastUpdate",
      "updatedAt",
      "assignedUsers",
      "services",
      "status",
      "readBy",
    ];

    const ignoredForChangeCheck = [
      "lastUpdate",
      "updatedAt",
      "assignedUsers",
      "services",
      "overallCompletionPercentage",
      "overallStatus",
      "createdAt",
      "_id",
      "__v",
      "readBy",
    ];

    // Track simple field changes (ignore computed/internal fields)
    for (const key in req.body) {
      if (excludedKeys.includes(key) || ignoredForChangeCheck.includes(key))
        continue;

      // Normalize 'name' to 'unitName' for comparison
      const compareKey = key === "name" ? "unitName" : key;

      const oldVal = existingCase[compareKey];
      const newVal = req.body[key];

      if ((oldVal == null && newVal == null) || oldVal === newVal) continue;

      if (typeof oldVal === "object" && typeof newVal === "object") continue;

      // Skip 'name' changes entirely since we handle 'unitName'
      if (key === "name") continue;

      changes.push({
        type: "field-change",
        message: `${key} changed from "${oldVal ?? ""}" to "${newVal ?? ""}"`,
      });
    }

    // Track status separately
    if (reqStatus && reqStatus !== existingCase.status) {
      changes.push({
        type: "status-change",
        message: `status changed from "${existingCase.status}" to "${reqStatus}"`,
      });
    }

    // Process assignedUsers
    let formattedAssignedUsers = Array.isArray(existingCase.assignedUsers)
      ? existingCase.assignedUsers
      : [];
    if (Array.isArray(assignedUsers)) {
      const newUserIds = assignedUsers.map((u) =>
        typeof u === "object" ? u._id.toString() : u.toString()
      );

      const usersFromDb = await User.find({ _id: { $in: newUserIds } }).select(
        "userId name"
      );
      formattedAssignedUsers = newUserIds.map((userId) => {
        const user = usersFromDb.find(
          (u) => u._id.toString() === userId.toString()
        );
        return {
          _id: user ? user._id : userId,
          userId: user ? user.userId : null,
          name: user ? user.name : `User ${userId}`,
        };
      });

      // Track user changes
      const oldUserIds = Array.isArray(existingCase.assignedUsers)
        ? existingCase.assignedUsers.map((u) =>
            typeof u === "object" && u._id ? u._id.toString() : u.toString()
          )
        : [];
      const addedUsers = newUserIds.filter((id) => !oldUserIds.includes(id));
      const removedUsers = oldUserIds.filter((id) => !newUserIds.includes(id));

      if (addedUsers.length > 0) {
        changes.push({
          type: "user-added",
          message: `${addedUsers.length} user(s) added to case`,
        });
      }
      if (removedUsers.length > 0) {
        changes.push({
          type: "user-removed",
          message: `${removedUsers.length} user(s) removed from case`,
        });
      }
    }

    // Defensive: always use array for services
    const servicesToUse =
      Array.isArray(services) && services.length > 0
        ? services
        : Array.isArray(existingCase.services)
        ? existingCase.services
        : [];

    const totalServices = servicesToUse.length;
    const completedCount = servicesToUse.filter(
      (s) => s.status === "Completed"
    ).length;
    const overallCompletionPercentage =
      totalServices === 0
        ? 50
        : Math.min(50 + (completedCount * 50) / totalServices, 100);

    // Determine the new status based on service states
    let newStatus = reqStatus || existingCase.status;
    let updatedStatus = newStatus;

    if (Array.isArray(services)) {
      const allCompleted = services.every((s) => s.status === "Completed");
      const anyInProgress = services.some((s) => s.status === "In-Progress");

      // FORCE status to "Completed" if all services are completed
      if (allCompleted) {
        newStatus = "Completed";
        updatedStatus = "Completed";
      }
      // Otherwise, only auto-update to "In-Progress" if case was "New-Case"
      else if (existingCase.status === "New-Case" && anyInProgress) {
        newStatus = "In-Progress";
        updatedStatus = "In-Progress";
      }
      // Don't auto-downgrade from Completed to In-Progress
    }

    // --- Detect service status changes ---
    const oldServices = Array.isArray(existingCase.services)
      ? existingCase.services
      : [];
    const newServices =
      services !== undefined
        ? Array.isArray(services)
          ? services
          : []
        : oldServices;

    const oldServicesMap = new Map(
      oldServices.map((s) => [s.id ?? s._id?.toString() ?? s.name, s])
    );

    const statusChanges = [];
    let lastEditedService = existingCase.lastEditedService || null;

    for (const newService of newServices) {
      const key =
        newService.id ?? newService._id?.toString() ?? newService.name;
      const oldService = oldServicesMap.get(key);
      //   if (
      //     oldService &&
      //     (oldService.status !== newService.status ||
      //       oldService.remarks !== newService.remarks ||
      //       oldService.completionPercentage !== newService.completionPercentage)
      //   ) {
      //     statusChanges.push({
      //       serviceId: newService.id ?? null,
      //       serviceName: newService.name,
      //       oldStatus: oldService.status,
      //       newStatus: newService.status,
      //     });
      //   }
      // }

      if (oldService && oldService.status !== newService.status) {
        statusChanges.push({
          serviceId: newService.id ?? null,
          serviceName: newService.name,
          oldStatus: oldService.status,
          newStatus: newService.status,
        });
      }
    }

    if (statusChanges.length > 0) {
      const lastChanged = statusChanges[statusChanges.length - 1];
      lastEditedService = {
        id: lastChanged.serviceId,
        name: lastChanged.serviceName,
        editedAt: new Date(),
      };
    }

    const updatePayload = {
      srNo: srNo !== undefined ? srNo : existingCase.srNo,
      ownerName: ownerName !== undefined ? ownerName : existingCase.ownerName,
      clientName:
        clientName !== undefined ? clientName : existingCase.clientName,
      unitName: unitName !== undefined ? unitName : existingCase.unitName,
      franchiseAddress:
        franchiseAddress !== undefined
          ? franchiseAddress
          : existingCase.franchiseAddress,
      stateHead: stateHead !== undefined ? stateHead : existingCase.stateHead,
      authorizedPerson:
        authorizedPerson !== undefined
          ? authorizedPerson
          : existingCase.authorizedPerson,
      assignedUsers: formattedAssignedUsers,
      reasonForStatus:
        reasonForStatus !== undefined
          ? reasonForStatus
          : existingCase.reasonForStatus,
      status: updatedStatus,
      overallStatus: updatedStatus,
      overallCompletionPercentage,
      lastUpdate: new Date(),
      lastEditedService: lastEditedService,
    };

    // Only update services if provided and not empty
    if (Array.isArray(services) && services.length > 0) {
      updatePayload.services = mergeServices(oldServices, services);
    }

    // Then in your updateCase function, modify the services update logic:
    if (services !== undefined) {
      // Check if services was provided at all
      updatePayload.services = Array.isArray(services)
        ? mergeServices(existingCase.services || [], services)
        : existingCase.services || [];
    }

    // Now update the case
    const updated = await Case.findByIdAndUpdate(caseId, updatePayload, {
      new: true,
      runValidators: true,
    });

    // Send notifications if there are any service status changes
    if (statusChanges.length > 0) {
      for (const change of statusChanges) {
        const notificationMessage = `Service "${change.serviceName}" status changed from "${change.oldStatus}" to "${change.newStatus}" in Case "${updated.unitName}" by ${updatedByUserName}.`;

        // Notify assigned users
        for (const assignedUser of formattedAssignedUsers) {
          await Notification.create({
            type: "service-status",
            message: notificationMessage,
            userId: assignedUser._id,
            userName: assignedUser.name,
            caseId: updated._id,
            caseName: updated.unitName,
            serviceId: change.serviceId,
            serviceName: change.serviceName,
            createdBy: updatedByUserId,
            updatedBy: updatedByUserId,
          });
        }

        // Notify all admins/superadmins
        const admins = await Admin.find().select("_id name");
        for (const admin of admins) {
          await Notification.create({
            type: "service-status",
            message: notificationMessage,
            userId: admin._id,
            userName: admin.name,
            caseId: updated._id,
            caseName: updated.unitName,
            serviceId: change.serviceId,
            serviceName: change.serviceName,
            createdBy: updatedByUserId || null,
            updatedBy: updatedByUserId,
          });
        }
      }
    }

    // Send notifications only if there are actual changes
    if (changes.length > 0) {
      const isFirstUpdate = existingCase.lastUpdate === existingCase.createdAt;

      // Check if 'name' field change exists
      const hasNameChange = changes.some((change) =>
        change.message.startsWith("name changed")
      );

      // Filter out service-added notifications if not first update
      let filteredChanges = changes.filter(
        (change) => change.type !== "service-added" || isFirstUpdate
      );

      // If name changed, exclude unitName change notifications
      if (hasNameChange) {
        filteredChanges = filteredChanges.filter(
          (change) => !change.message.startsWith("unitName changed")
        );
      }

      if (filteredChanges.length > 0) {
        const changeMessage = `Case "${
          updated.unitName
        }" updated by ${updatedByUserName}:\n${filteredChanges
          .map((c) => c.message)
          .join(";\n")}`;

        // Notify assigned users
        for (const assignedUser of formattedAssignedUsers) {
          await Notification.create({
            type: "update",
            message: changeMessage,
            userId: assignedUser._id,
            userName: assignedUser.name,
            caseId: updated._id,
            caseName: updated.unitName,
            updatedBy: updatedByUserId,
          });
        }

        // Notify all admins/superadmins as well
        const admins = await Admin.find().select("_id name");
        for (const admin of admins) {
          await Notification.create({
            type: "update",
            message: changeMessage,
            userId: admin._id,
            userName: admin.name,
            caseId: updated._id,
            caseName: updated.unitName,
            updatedBy: updatedByUserId,
          });
        }
      }
    }

    for (const assignedUser of formattedAssignedUsers) {
      if (assignedUser.subscription) {
        const payload = {
          title: "Case Update",
          body: notificationMessage,
          icon: "/images/icon.png",
        };
        await sendPushNotification(assignedUser.subscription, payload);
      }
    }

    res.json({
      message: "Case updated successfully",
      case: updated,
      changes:
        changes.length > 0
          ? changes.map((c) => c.message)
          : ["No significant changes detected"],
    });
  } catch (err) {
    console.error("Error updating case:", err);
    res.status(500).json({
      message: "Failed to update case",
      error: err.message,
    });
  }
};

const deleteCase = async (req, res) => {
  try {
    const deleted = await Case.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Case not found" });
    }

    // 👤 Logged-in user info
    const deleterName = req.user?.name || "Someone";
    const deleterId = req.user?._id || null;

    // 🔔 Notify assigned users
    if (
      Array.isArray(deleted.assignedUsers) &&
      deleted.assignedUsers.length > 0
    ) {
      for (const assignedUser of deleted.assignedUsers) {
        await Notification.create({
          type: "deletion",
          message: `Case "${deleted.unitName}" has been deleted by ${deleterName}.`,
          userId: assignedUser._id,
          userName: assignedUser.name || null,
          caseId: deleted._id,
          caseName: deleted.unitName,
          createdBy: deleterId,
        });
      }
    }

    // 🔔 Notify all admins
    const admins = await Admin.find().select("_id name");
    for (const admin of admins) {
      await Notification.create({
        type: "deletion",
        message: `Case "${deleted.unitName}" has been deleted by ${deleterName}.`,
        userId: admin._id,
        userName: admin.name,
        caseId: deleted._id,
        caseName: deleted.unitName,
        createdBy: deleterId,
      });
    }

    res.json({ message: "Case deleted successfully" });
  } catch (err) {
    console.error("Error deleting case:", err);
    res
      .status(500)
      .json({ message: "Failed to delete case", error: err.message });
  }
};

module.exports = { addCase, getCases, getcase, updateCase, deleteCase };
