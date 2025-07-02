const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const path = require("path");
const connectDB = require("./config/db.js")
const caseRoutes = require("./routes/caseRoutes.js")
const userRoutes = require ('./routes/userRoutes.js');
const ownerRoutes = require("./routes/ownerRoutes");
const clientRoutes = require("./routes/clientRoutes");
const loginRoute = require('./routes/loginRoute.js');
const { initSocket } = require('./socket/socket.js')
const notificationRoute = require("./routes/notifications.js");
const serviceRoute = require('./routes/serviceRoute.js');
const seedDefaultServices = require('./config/seedServices.js');
const remarkRoute = require('./routes/remarksRoute.js')
const roleRoute = require('./routes/roleRoutes.js')
const recentRemarksRoute = require('./routes/recentRemarks');
const chatRoute = require('./routes/chatRoute.js');
const tagsRoute = require("./routes/tagsRoute");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const settingsRoutes = require("./routes/settingsRoute.js")
const pushNotificationRoutes = require('./routes/pushNotificationRoutes'); // Import push notification routes
const superAdminRoute = require('./routes/superadmin.js');
const jwt = require("jsonwebtoken");





dotenv.config();

const app = express();
// const corsOptions = {
//   origin: [
//     "http://localhost:9002", // for local dev frontend (adjust port if needed)
//     "https://fco.onrender.com",
//     "https://tumbledry.sharda.co.in" // deployed frontend URL
//   ],
//   credentials: true,
// };

const corsOptions = {
  origin: "*", // Allow all origins for testing
  credentials: true,
};


app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));




// Stricter limiter for /api/auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, 
  message: "Too many attempts, try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});


// 1. Apply authLimiter STRICTLY on /api/auth FIRST!
app.use('/api/auth', authLimiter, loginRoute);



// 2. Then apply apiLimiter on ALL other /api/ routes
// app.use('/api/', apiLimiter);

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}


// API Route
// app.use('/api/', apiLimiter); // only for API, not for static files
app.use('/api/cases', caseRoutes);
app.use('/api/users', userRoutes);
app.use("/api/owners", ownerRoutes);
app.use("/api/clients", clientRoutes);
// app.use('/api/auth', authLimiter, loginRoute);
app.use("/api/notifications", notificationRoute)
app.use("/api/services", serviceRoute);
app.use("/api/cases/:caseId/services", remarkRoute);
app.use("/api/roles", roleRoute);
app.use("/api/remarks", recentRemarksRoute);
app.use("/api/chats", chatRoute);
app.use("/api/settings", settingsRoutes);
app.use("/api/tags", tagsRoute);
app.use('/api/pushnotifications', pushNotificationRoutes);
app.use('/ap/admin', superAdminRoute);




// app.use(express.static(path.join(__dirname, "client/build")));
app.use(express.static(path.join(__dirname, "client")));


app.get("/", (req, res) => {
  res.send("FCA - Fabrico Backend is running -> CI/CD testing success!");
});




app.use((req, res, next) => {
  res.status(404).send('Route not found');
});



app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Server error" });
   next();
});


async function startServer() {
  try {
    await connectDB(); // connect only once here
    const server = http.createServer(app);
    const { io } = initSocket(server);
    app.set("io", io); // make io available in routes
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`FCO Backend running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();


