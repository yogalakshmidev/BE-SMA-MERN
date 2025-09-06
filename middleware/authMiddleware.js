const jwt = require("jsonwebtoken");
const HttpError = require("../models/errorModel");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization; 

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(new HttpError("No token, authorization denied", 401));
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new HttpError("Token is not valid", 401));
      }

      req.user = { 
    _id: decoded.id,
    id: decoded.id,
    email: decoded.email,
  };
      // req.user = decoded;
      next();
    });
  } catch (error) {
    return next(new HttpError("Server Error in auth middleware", 500));
  }
};

module.exports = authMiddleware;
