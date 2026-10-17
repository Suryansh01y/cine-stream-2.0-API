const express = require("express");
const mongoose = require("mongoose");
const Post = require("../models/Post");
const User = require("../models/User");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { Readable } = require("node:stream");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error("Only JPG, PNG, WEBP, and GIF images are allowed."));
    }
    callback(null, true);
  },
});

function uploadToCloudinary(buffer) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const error = new Error("Image upload is not configured. Add Cloudinary credentials to the backend .env file.");
    error.status = 503;
    throw error;
  }
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: "cine-stream/community", resource_type: "image" }, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    });
    Readable.from(buffer).pipe(stream);
  });
}

// GET /posts/recent - return the 3 most recent posts
// Keep this route before /:id so "recent" is not treated as an ID.
router.get("/recent", async (req, res, next) => {
  try {
    const posts = await Post.find()
      .populate("authorId", "name email")
      .sort({ createdAt: -1 })
      .limit(3);

    res.status(200).json(posts);
  } catch (error) {
    next(error);
  }
});

// GET /posts - return all posts
router.get("/", async (req, res, next) => {
  try {
    const posts = await Post.find()
      .populate("authorId", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json(posts);
  } catch (error) {
    next(error);
  }
});

// GET /posts/:id - return one post
router.get("/:id", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Post ID must be a valid MongoDB ObjectId." });
  }

  try {
    const post = await Post.findById(req.params.id).populate("authorId", "name email");

    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    res.status(200).json(post);
  } catch (error) {
    next(error);
  }
});

// POST /posts - create a post
router.post("/", upload.single("image"), async (req, res, next) => {
  const { title, content, authorId } = req.body;

  if (typeof title !== "string" || !title.trim() ||
      typeof content !== "string" || !content.trim()) {
    return res.status(400).json({ message: "Title and content are required." });
  }

  if (authorId && !mongoose.isValidObjectId(authorId)) {
    return res.status(400).json({ message: "authorId must be a valid MongoDB ObjectId." });
  }

  try {
    let imageUrl = "";
    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer);
    }

    const post = await Post.create({
      title: title.trim(),
      content: content.trim(),
      imageUrl,
      ...(authorId ? { authorId } : {})
    });

    const populatedPost = await post.populate("authorId", "name email");
    res.status(201).json({
      message: "Post created successfully.",
      post: populatedPost
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
});

// DELETE /posts/:id - delete a post
router.delete("/:id", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Post ID must be a valid MongoDB ObjectId." });
  }

  try {
    const deletedPost = await Post.findByIdAndDelete(req.params.id);

    if (!deletedPost) {
      return res.status(404).json({ message: "Post not found." });
    }

    res.status(200).json({
      message: "Post deleted successfully.",
      postId: deletedPost._id
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
