require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const postRoutes = require("./src/routes/postRoutes");

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
console.log("FRONTEND_URL from env:", process.env.FRONTEND_URL);
console.log("Allowed origins:", allowedOrigins);


app.use(cors({
  origin(origin, callback) {
    // Permit non-browser clients such as curl/Postman, plus configured frontend origins.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);

    console.log("Blocked origin:", origin);
    
    return callback(new Error("Origin is not allowed by CORS."));
  },
}));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl} - ${new Date().toLocaleTimeString()}`);
  next();
});

app.get("/", (req, res) => {
  res.status(200).json({ message: "Cine-Stream Community API is running", status: "OK" });
});
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", database: require("mongoose").connection.readyState === 1 ? "connected" : "disconnected" });
});
app.use("/posts", postRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  if (error.name === "MulterError") {
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({ message: error.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller." : error.message });
  }
  if (error.message === "Only JPG, PNG, WEBP, and GIF images are allowed.") {
    return res.status(400).json({ message: error.message });
  }
  if (error.message === "Origin is not allowed by CORS.") {
    return res.status(403).json({ message: error.message });
  }
  res.status(error.status || 500).json({ message: error.status ? error.message : "Internal server error." });
});

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Cine-Stream Community API running on port ${PORT}`);
      console.log(`Local URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed because the database connection could not be established.", error.message);
    process.exit(1);
  }
}

if (require.main === module) startServer();
module.exports = app;
