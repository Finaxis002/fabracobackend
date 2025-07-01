const jwt = require('jsonwebtoken');

// Only use User/Admin models if you want to fetch full user object later in controller

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.sendStatus(401); // No token: Unauthorized

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // Invalid token: Forbidden
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };
