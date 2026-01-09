const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

///middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.fyk0nds.mongodb.net/?appName=Cluster0`;

// Validate environment variables
if (!process.env.USER_DB || !process.env.PASS_DB) {
  console.error("Missing required environment variables: USER_DB or PASS_DB");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Global connection promise
let clientPromise;

// Initialize connection
if (!clientPromise) {
  clientPromise = client.connect();
}

// Health check endpoint
app.get("/", (req, res) => {
  res.send({
    message: "Digital Library Server is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    database: "my-bookCollection",
  });
});

// Test database connection endpoint
app.get("/test-db", async (req, res) => {
  try {
    await clientPromise;
    await client.db("admin").command({ ping: 1 });
    const { booksCollection } = await getCollections();
    const bookCount = await booksCollection.countDocuments();
    res.send({
      message: "Database connection successful!",
      bookCount: bookCount,
      timestamp: new Date(),
      database: "my-bookCollection",
    });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).send({
      error: "Database connection failed",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// const verifyJWT = async (req, res, next) => {
//   const token = req?.headers?.authorization?.split(" ")[1];
//   // console.log(token);
//   if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
//   try {
//     const decoded = await admin.auth().verifyIdToken(token);
//     req.tokenEmail = decoded.email;
//     // console.log(decoded);
//     next();
//   } catch (err) {
//     // console.log(err);
//     return res.status(401).send({ message: "Unauthorized Access!", err });
//   }
// };

//or
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).send({ message: "Unauthorized" });
  }

  req.tokenEmail = req.headers.email;
  next();
};

// Database collections helper
async function getCollections() {
  await clientPromise;
  const db = client.db("my-bookCollection");
  return {
    booksCollection: db.collection("books"),
    usersCollection: db.collection("users"),
    reviewsCollection: db.collection("reviews"),
    borrowedBooksCollection: db.collection("borrowedBooks"),
    categoriesCollection: db.collection("categories"),
    readingListsCollection: db.collection("readingLists"),
    libraryStatsCollection: db.collection("libraryStats"),
    commentsCollection: db.collection("comment-collection"),
  };
}

// Simple debug endpoint to test books collection
app.get("/debug-books", async (req, res) => {
  try {
    console.log("Debug books endpoint called");
    await clientPromise;
    console.log("Client connected");

    const db = client.db("my-bookCollection");
    console.log("Database selected: my-bookCollection");

    const booksCollection = db.collection("books");
    console.log("Books collection selected");

    const count = await booksCollection.countDocuments();
    console.log("Book count:", count);

    const allBooks = await booksCollection.find({}).toArray();
    console.log("All books fetched:", allBooks.length);

    res.json({
      success: true,
      message: "Debug successful",
      database: "my-bookCollection",
      collection: "books",
      totalBooks: count,
      books: allBooks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Debug books error:", error);
    res.status(500).json({
      success: false,
      error: "Debug failed",
      message: error.message,
      stack: error.stack,
    });
  }
});

////1.Get all books with enhanced filtering
app.get("/allbooks", async (req, res) => {
  try {
    console.log("AllBooks endpoint called with query:", req.query);

    // Direct database access
    await clientPromise;
    const db = client.db("my-bookCollection");
    const booksCollection = db.collection("books");

    console.log("Direct database connection established");

    const { category, author, search, page = 1, limit = 12 } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (category) filter.category = category;
    if (author) filter.author = new RegExp(author, "i");
    if (search) {
      filter.$or = [
        { title: new RegExp(search, "i") },
        { author: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    console.log("Filter applied:", filter);
    console.log("Pagination:", { page, limit, skip });

    const results = await booksCollection
      .find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ _id: -1 }) // Sort by _id instead of createdAt
      .toArray();

    console.log(`Found ${results.length} books`);

    const total = await booksCollection.countDocuments(filter);
    console.log(`Total books matching filter: ${total}`);

    const response = {
      books: results,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalBooks: total,
        hasNext: skip + results.length < total,
        hasPrev: page > 1,
      },
      success: true,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching books:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      error: "Failed to load books",
      message: error.message,
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
});

///get featured books
app.get("/featured-books", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const results = await booksCollection
      .find({ featured: true })
      .limit(8)
      .toArray();
    res.send(results);
  } catch (error) {
    console.error("Error fetching featured books:", error);
    res.status(500).send({
      error: "Failed to load featured books",
      message: error.message,
    });
  }
});

///get latest books
app.get("/latest-books", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const results = await booksCollection
      .find()
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.send(results);
  } catch (error) {
    console.error("Error fetching latest books:", error);
    res.status(500).send({
      error: "Failed to load latest books",
      message: error.message,
    });
  }
});

///get popular books (by rating)
app.get("/popular-books", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const results = await booksCollection
      .find()
      .sort({ averageRating: -1 })
      .limit(8)
      .toArray();
    res.send(results);
  } catch (error) {
    console.error("Error fetching popular books:", error);
    res.status(500).send({
      error: "Failed to load popular books",
      message: error.message,
    });
  }
});

///get books by category
app.get("/books/category/:category", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const { category } = req.params;
    const results = await booksCollection
      .find({ category })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(results);
  } catch (error) {
    console.error("Error fetching books by category:", error);
    res.status(500).send({
      error: "Failed to load books by category",
      message: error.message,
    });
  }
});

///2.Get one book
app.get("/allbooks/:id", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const { id } = req.params;
    const objectId = new ObjectId(id);
    const result = await booksCollection.findOne({ _id: objectId });
    res.send(result);
  } catch (error) {
    console.error("Error fetching single book:", error);
    res.status(500).send({
      error: "Failed to load book",
      message: error.message,
    });
  }
});

// Comments endpoints for books
///Get comments for a specific book
app.get("/books/:bookId/comments", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { bookId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const comments = await commentsCollection
      .find({ bookId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const totalComments = await commentsCollection.countDocuments({ bookId });

    res.send({
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / limit),
        totalComments,
        hasNext: skip + comments.length < totalComments,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching book comments:", error);
    res.status(500).send({
      error: "Failed to load comments",
      message: error.message,
    });
  }
});

///Add a comment to a specific book
app.post("/books/:bookId/comments", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { bookId } = req.params;
    const { userEmail, displayName, comment, photoURL } = req.body;

    if (!comment || !userEmail || !displayName) {
      return res.status(400).send({
        error: "Missing required fields",
        message: "Comment, userEmail, and displayName are required",
      });
    }

    const newComment = {
      bookId,
      userEmail,
      displayName,
      photoURL: photoURL || "",
      comment,
      createdAt: new Date(),
      updatedAt: new Date(),
      likes: 0,
      replies: [],
    };

    const result = await commentsCollection.insertOne(newComment);
    res.status(201).send({
      message: "Comment added successfully",
      comment: { ...newComment, _id: result.insertedId },
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).send({
      error: "Failed to add comment",
      message: error.message,
    });
  }
});

///Update a comment
app.put("/comments/:commentId", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { commentId } = req.params;
    const { comment, userEmail } = req.body;

    if (!comment) {
      return res.status(400).send({
        error: "Comment text is required",
      });
    }

    // Check if the comment belongs to the user
    const existingComment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
      userEmail,
    });

    if (!existingComment) {
      return res.status(404).send({
        error: "Comment not found or unauthorized",
      });
    }

    const result = await commentsCollection.updateOne(
      { _id: new ObjectId(commentId) },
      {
        $set: {
          comment,
          updatedAt: new Date(),
        },
      }
    );

    res.send({
      message: "Comment updated successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).send({
      error: "Failed to update comment",
      message: error.message,
    });
  }
});

///Delete a comment
app.delete("/comments/:commentId", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { commentId } = req.params;
    const { userEmail } = req.query;

    // Check if the comment belongs to the user
    const existingComment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
      userEmail,
    });

    if (!existingComment) {
      return res.status(404).send({
        error: "Comment not found or unauthorized",
      });
    }

    const result = await commentsCollection.deleteOne({
      _id: new ObjectId(commentId),
    });

    res.send({
      message: "Comment deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).send({
      error: "Failed to delete comment",
      message: error.message,
    });
  }
});

///Like/Unlike a comment
app.post("/comments/:commentId/like", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { commentId } = req.params;
    const { userEmail, action } = req.body; // action: 'like' or 'unlike'

    const comment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
    });

    if (!comment) {
      return res.status(404).send({ error: "Comment not found" });
    }

    let updateOperation;
    if (action === "like") {
      updateOperation = { $inc: { likes: 1 } };
    } else if (action === "unlike") {
      updateOperation = { $inc: { likes: -1 } };
    } else {
      return res.status(400).send({ error: "Invalid action" });
    }

    const result = await commentsCollection.updateOne(
      { _id: new ObjectId(commentId) },
      updateOperation
    );

    res.send({
      message: `Comment ${action}d successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    res.status(500).send({
      error: "Failed to like comment",
      message: error.message,
    });
  }
});

///Get comments by user
app.get("/users/:userEmail/comments", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { userEmail } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const comments = await commentsCollection
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    const totalComments = await commentsCollection.countDocuments({
      userEmail,
    });

    res.send({
      comments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalComments / limit),
        totalComments,
        hasNext: skip + comments.length < totalComments,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching user comments:", error);
    res.status(500).send({
      error: "Failed to load user comments",
      message: error.message,
    });
  }
});

///3.Create single book with enhanced fields
app.post("/allbooks", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const book = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date(),
      averageRating: 0,
      totalRatings: 0,
      totalReviews: 0,
      availableCopies: req.body.totalCopies || 1,
      borrowedCount: 0,
      featured: false,
      status: "available",
    };
    const result = await booksCollection.insertOne(book);
    res.send(result);
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(500).send({
      error: "Failed to create book",
      message: error.message,
    });
  }
});

///5.Update single book
app.put("/allbooks/:id", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const { id } = req.params;
    const updatedBook = { ...req.body, updatedAt: new Date() };
    const filter = { _id: new ObjectId(id) };
    const update = { $set: updatedBook };
    const result = await booksCollection.updateOne(filter, update);
    res.send(result);
  } catch (error) {
    console.error("Error updating book:", error);
    res.status(500).send({
      error: "Failed to update book",
      message: error.message,
    });
  }
});

///6.Delete single book
app.delete("/allbooks/:id", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const { id } = req.params;
    const query = { _id: new ObjectId(id) }; ///this id matches with mongodb _id
    const result = await booksCollection.deleteOne(query);
    res.send(result);
  } catch (error) {
    console.error("Error deleting book:", error);
    res.status(500).send({
      error: "Failed to delete book",
      message: error.message,
    });
  }
});

///get book for my data//
app.get("/mybooks", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const email = req.query.email;
    const result = await booksCollection.find({ userEmail: email }).toArray();
    res.send(result);
  } catch (error) {
    console.error("Error fetching user books:", error);
    res.status(500).send({
      error: "Failed to fetch user books",
      message: error.message,
    });
  }
});

// Categories endpoints
app.get("/categories", async (req, res) => {
  try {
    const { categoriesCollection } = await getCollections();
    const categories = await categoriesCollection.find().toArray();
    res.send(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).send({
      error: "Failed to fetch categories",
      message: error.message,
    });
  }
});

app.post("/categories", async (req, res) => {
  try {
    const { categoriesCollection } = await getCollections();
    const category = {
      ...req.body,
      createdAt: new Date(),
      bookCount: 0,
    };
    const result = await categoriesCollection.insertOne(category);
    res.send(result);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).send({
      error: "Failed to create category",
      message: error.message,
    });
  }
});

// Reviews endpoints
app.post("/reviews", async (req, res) => {
  try {
    const { reviewsCollection, booksCollection } = await getCollections();
    const review = {
      ...req.body,
      createdAt: new Date(),
      helpful: 0,
    };
    const result = await reviewsCollection.insertOne(review);

    // Update book rating
    const bookId = new ObjectId(req.body.bookId);
    const reviews = await reviewsCollection
      .find({ bookId: req.body.bookId })
      .toArray();
    const avgRating =
      reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await booksCollection.updateOne(
      { _id: bookId },
      {
        $set: {
          averageRating: avgRating,
          totalRatings: reviews.length,
          totalReviews: reviews.length,
        },
      }
    );

    res.send(result);
  } catch (error) {
    console.error("Error creating review:", error);
    res.status(500).send({
      error: "Failed to create review",
      message: error.message,
    });
  }
});

app.get("/reviews/:bookId", async (req, res) => {
  try {
    const { reviewsCollection } = await getCollections();
    const { bookId } = req.params;
    const reviews = await reviewsCollection
      .find({ bookId })
      .sort({ createdAt: -1 })
      .toArray();
    res.send(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).send({
      error: "Failed to fetch reviews",
      message: error.message,
    });
  }
});

// Comments endpoints for books
// Get all comments for a specific book
app.get("/comments/:bookId", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { bookId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const comments = await commentsCollection
      .find({ bookId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalComments = await commentsCollection.countDocuments({ bookId });
    const totalPages = Math.ceil(totalComments / limit);

    res.send({
      comments,
      pagination: {
        currentPage: page,
        totalPages,
        totalComments,
        hasNext: skip + comments.length < totalComments,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).send({
      error: "Failed to fetch comments",
      message: error.message,
    });
  }
});

// Add a new comment to a book
app.post("/comments", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { bookId, userEmail, displayName, comment, photoURL } = req.body;

    if (!bookId || !userEmail || !comment) {
      return res.status(400).send({
        error: "Missing required fields",
        message: "bookId, userEmail, and comment are required",
      });
    }

    const newComment = {
      bookId,
      userEmail,
      displayName: displayName || "Anonymous User",
      comment,
      photoURL: photoURL || "",
      createdAt: new Date(),
      updatedAt: new Date(),
      likes: 0,
      replies: [],
    };

    const result = await commentsCollection.insertOne(newComment);
    res.status(201).send({
      message: "Comment added successfully",
      commentId: result.insertedId,
      comment: newComment,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).send({
      error: "Failed to add comment",
      message: error.message,
    });
  }
});

// Update a comment
app.put("/comments/:commentId", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { commentId } = req.params;
    const { comment, userEmail } = req.body;

    if (!comment) {
      return res.status(400).send({
        error: "Missing comment text",
        message: "Comment text is required",
      });
    }

    // Check if the comment belongs to the user
    const existingComment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
      userEmail,
    });

    if (!existingComment) {
      return res.status(404).send({
        error: "Comment not found or unauthorized",
        message: "Comment not found or you don't have permission to edit it",
      });
    }

    const result = await commentsCollection.updateOne(
      { _id: new ObjectId(commentId) },
      {
        $set: {
          comment,
          updatedAt: new Date(),
        },
      }
    );

    res.send({
      message: "Comment updated successfully",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).send({
      error: "Failed to update comment",
      message: error.message,
    });
  }
});

// Delete a comment
app.delete("/comments/:commentId", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { commentId } = req.params;
    const { userEmail } = req.query;

    // Check if the comment belongs to the user
    const existingComment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
      userEmail,
    });

    if (!existingComment) {
      return res.status(404).send({
        error: "Comment not found or unauthorized",
        message: "Comment not found or you don't have permission to delete it",
      });
    }

    const result = await commentsCollection.deleteOne({
      _id: new ObjectId(commentId),
    });

    res.send({
      message: "Comment deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).send({
      error: "Failed to delete comment",
      message: error.message,
    });
  }
});

// Like/Unlike a comment
app.post("/comments/:commentId/like", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { commentId } = req.params;
    const { userEmail, action } = req.body; // action: 'like' or 'unlike'

    if (!userEmail || !action) {
      return res.status(400).send({
        error: "Missing required fields",
        message: "userEmail and action are required",
      });
    }

    const comment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
    });

    if (!comment) {
      return res.status(404).send({
        error: "Comment not found",
        message: "The comment you're trying to like doesn't exist",
      });
    }

    let updateOperation;
    if (action === "like") {
      updateOperation = { $inc: { likes: 1 } };
    } else if (action === "unlike") {
      updateOperation = { $inc: { likes: -1 } };
    } else {
      return res.status(400).send({
        error: "Invalid action",
        message: "Action must be 'like' or 'unlike'",
      });
    }

    const result = await commentsCollection.updateOne(
      { _id: new ObjectId(commentId) },
      updateOperation
    );

    res.send({
      message: `Comment ${action}d successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error liking comment:", error);
    res.status(500).send({
      error: "Failed to like comment",
      message: error.message,
    });
  }
});

// Get comment statistics for a book
app.get("/comments/:bookId/stats", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();
    const { bookId } = req.params;

    const totalComments = await commentsCollection.countDocuments({ bookId });
    const totalLikes = await commentsCollection
      .aggregate([
        { $match: { bookId } },
        { $group: { _id: null, totalLikes: { $sum: "$likes" } } },
      ])
      .toArray();

    const recentComments = await commentsCollection
      .find({ bookId })
      .sort({ createdAt: -1 })
      .limit(3)
      .toArray();

    res.send({
      totalComments,
      totalLikes: totalLikes[0]?.totalLikes || 0,
      recentComments,
    });
  } catch (error) {
    console.error("Error fetching comment stats:", error);
    res.status(500).send({
      error: "Failed to fetch comment statistics",
      message: error.message,
    });
  }
});

// Borrow book
app.post("/borrow", async (req, res) => {
  try {
    const { booksCollection, borrowedBooksCollection } = await getCollections();
    const { bookId, userEmail, userName } = req.body;
    const objectId = new ObjectId(bookId);

    // Check if book is available
    const book = await booksCollection.findOne({ _id: objectId });
    if (!book) {
      return res.status(404).send({ message: "Book not found" });
    }
    if (book.availableCopies <= 0) {
      return res.status(400).send({ message: "Book not available" });
    }

    // Check if user already borrowed this book
    const existingBorrow = await borrowedBooksCollection.findOne({
      bookId,
      userEmail,
      status: "borrowed",
    });

    if (existingBorrow) {
      return res
        .status(400)
        .send({ message: "You have already borrowed this book" });
    }

    const borrowRecord = {
      bookId,
      userEmail,
      userName,
      borrowDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      status: "borrowed",
    };

    await borrowedBooksCollection.insertOne(borrowRecord);
    await booksCollection.updateOne(
      { _id: objectId },
      {
        $inc: { availableCopies: -1, borrowedCount: 1 },
      }
    );

    res.send({ message: "Book borrowed successfully" });
  } catch (error) {
    console.error("Error borrowing book:", error);
    res.status(500).send({
      error: "Failed to borrow book",
      message: error.message,
    });
  }
});

// Return book
app.post("/return", async (req, res) => {
  try {
    const { booksCollection, borrowedBooksCollection } = await getCollections();
    const { bookId, userEmail } = req.body;
    const objectId = new ObjectId(bookId);

    await borrowedBooksCollection.updateOne(
      { bookId, userEmail, status: "borrowed" },
      {
        $set: {
          status: "returned",
          returnDate: new Date(),
        },
      }
    );

    await booksCollection.updateOne(
      { _id: objectId },
      { $inc: { availableCopies: 1 } }
    );

    res.send({ message: "Book returned successfully" });
  } catch (error) {
    console.error("Error returning book:", error);
    res.status(500).send({
      error: "Failed to return book",
      message: error.message,
    });
  }
});

// Get borrowed books for user
app.get("/borrowed-books", async (req, res) => {
  try {
    const { booksCollection, borrowedBooksCollection } = await getCollections();
    const email = req.query.email;
    const borrowedBooks = await borrowedBooksCollection
      .find({ userEmail: email, status: "borrowed" })
      .toArray();

    // Get book details for each borrowed book
    const bookIds = borrowedBooks.map((b) => new ObjectId(b.bookId));
    const books = await booksCollection
      .find({ _id: { $in: bookIds } })
      .toArray();

    const result = borrowedBooks.map((borrowed) => {
      const book = books.find((b) => b._id.toString() === borrowed.bookId);
      return { ...borrowed, book };
    });

    res.send(result);
  } catch (error) {
    console.error("Error fetching borrowed books:", error);
    res.status(500).send({
      error: "Failed to fetch borrowed books",
      message: error.message,
    });
  }
});

// Reading Lists
app.post("/reading-lists", async (req, res) => {
  try {
    const { readingListsCollection } = await getCollections();
    const readingList = {
      ...req.body,
      createdAt: new Date(),
      books: [],
    };
    const result = await readingListsCollection.insertOne(readingList);
    res.send(result);
  } catch (error) {
    console.error("Error creating reading list:", error);
    res.status(500).send({
      error: "Failed to create reading list",
      message: error.message,
    });
  }
});

app.get("/reading-lists", async (req, res) => {
  try {
    const { readingListsCollection } = await getCollections();
    const email = req.query.email;
    const lists = await readingListsCollection
      .find({ userEmail: email })
      .toArray();
    res.send(lists);
  } catch (error) {
    console.error("Error fetching reading lists:", error);
    res.status(500).send({
      error: "Failed to fetch reading lists",
      message: error.message,
    });
  }
});

app.post("/reading-lists/:listId/books", async (req, res) => {
  try {
    const { readingListsCollection } = await getCollections();
    const { listId } = req.params;
    const { bookId } = req.body;

    await readingListsCollection.updateOne(
      { _id: new ObjectId(listId) },
      { $addToSet: { books: bookId } }
    );

    res.send({ message: "Book added to reading list" });
  } catch (error) {
    console.error("Error adding book to reading list:", error);
    res.status(500).send({
      error: "Failed to add book to reading list",
      message: error.message,
    });
  }
});

// Dashboard Statistics
app.get("/dashboard/stats", async (req, res) => {
  try {
    const { booksCollection, usersCollection, commentsCollection } =
      await getCollections();

    const totalBooks = await booksCollection.countDocuments();
    const totalUsers = await usersCollection.countDocuments();
    const totalComments = await commentsCollection.countDocuments();

    // Get books by status if available, otherwise use all books
    const availableBooks = await booksCollection.countDocuments({
      $or: [
        { status: { $exists: false } }, // Books without status field
        { status: "available" },
      ],
    });

    // Get average rating from your books
    const avgRatingResult = await booksCollection
      .aggregate([{ $group: { _id: null, avgRating: { $avg: "$rating" } } }])
      .toArray();

    // Get genre distribution
    const genreStats = await booksCollection
      .aggregate([
        { $group: { _id: "$genre", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])
      .toArray();

    const stats = {
      totalBooks,
      totalUsers,
      totalComments,
      availableBooks,
      averageRating: Math.round((avgRatingResult[0]?.avgRating || 0) * 10) / 10,
      totalReviews: totalComments, // Using comments as reviews
      genreStats,
      // Mock data for features you might add later
      totalBorrowed: 0,
    };

    res.send(stats);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).send({ error: "Failed to fetch dashboard statistics" });
  }
});

// Dashboard Summary (for DashMessage component)
app.get("/dashboard/summary", async (req, res) => {
  try {
    const { booksCollection, commentsCollection } = await getCollections();

    const totalBooks = await booksCollection.countDocuments();
    const totalComments = await commentsCollection.countDocuments();

    // Calculate total views if you have views field in books
    const totalViewsResult = await booksCollection
      .aggregate([
        {
          $group: {
            _id: null,
            totalViews: { $sum: { $ifNull: ["$views", 0] } },
          },
        },
      ])
      .toArray();

    const summary = {
      totalBooks,
      totalViews: totalViewsResult[0]?.totalViews || 0,
      totalComments,
    };

    res.send(summary);
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).send({ error: "Failed to fetch dashboard summary" });
  }
});

app.get("/dashboard/chart", async (req, res) => {
  try {
    // Get monthly book additions for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyData = await booksCollection
      .aggregate([
        {
          $addFields: {
            // Convert createdAt string to date if needed
            createdAtDate: {
              $cond: {
                if: { $type: "$createdAt" },
                then: { $dateFromString: { dateString: "$createdAt" } },
                else: new Date(),
              },
            },
          },
        },
        {
          $match: {
            createdAtDate: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAtDate" },
              month: { $month: "$createdAtDate" },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { "_id.year": 1, "_id.month": 1 },
        },
      ])
      .toArray();

    // Format data for the chart
    const chartData = monthlyData.map((item) => {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return {
        month: monthNames[item._id.month - 1],
        books: item.count,
      };
    });

    // If no data, return sample data for the last 6 months
    if (chartData.length === 0) {
      const sampleData = [];
      const currentDate = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() - i,
          1
        );
        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        sampleData.push({
          month: monthNames[date.getMonth()],
          books: Math.floor(Math.random() * 10) + 1,
        });
      }
      return res.send(sampleData);
    }

    res.send(chartData);
  } catch (error) {
    console.error("Dashboard chart error:", error);
    res.status(500).send({ error: "Failed to fetch chart data" });
  }
});

// Test endpoint for debugging
app.get("/test-users", async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const userCount = await usersCollection.countDocuments();
    const sampleUser = await usersCollection.findOne({});

    await clientPromise;
    const db = client.db("my-bookCollection");
    const collections = await db.listCollections().toArray();

    res.send({
      message: "Users collection accessible",
      totalUsers: userCount,
      sampleUser: sampleUser,
      collections: collections.map((c) => c.name),
    });
  } catch (error) {
    console.error("Test users error:", error);
    res.status(500).send({
      error: "Failed to access users collection",
      message: error.message,
    });
  }
});

// Simple users list endpoint (no auth required)
app.get("/users/list", async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    console.log("Simple users list endpoint called");
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await usersCollection
      .find({})
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalUsers = await usersCollection.countDocuments();
    const totalPages = Math.ceil(totalUsers / limit);

    res.status(200).json({
      users,
      totalUsers,
      totalPages,
      currentPage: page,
      success: true,
    });
  } catch (error) {
    console.error("Users list error:", error);
    res.status(500).json({
      error: "Failed to fetch users",
      message: error.message,
      success: false,
    });
  }
});

// Get users data for dashboard table
app.get("/dashboard/users", async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    console.log("Dashboard users endpoint called");
    console.log("Query params:", req.query);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    console.log(`Fetching users: page=${page}, limit=${limit}, skip=${skip}`);

    // Check if users collection exists and is accessible
    await clientPromise;
    const db = client.db("my-bookCollection");
    const collections = await db.listCollections().toArray();
    console.log(
      "Available collections:",
      collections.map((c) => c.name)
    );

    const users = await usersCollection
      .find({})
      .sort({ _id: -1 }) // Sort by _id (newest first)
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalUsers = await usersCollection.countDocuments();
    const totalPages = Math.ceil(totalUsers / limit);

    console.log(`Found ${users.length} users out of ${totalUsers} total`);

    res.status(200).json({
      users,
      totalUsers,
      totalPages,
      currentPage: page,
      success: true,
      message: "Users fetched successfully",
    });
  } catch (error) {
    console.error("Dashboard users error:", error);
    res.status(500).json({
      error: "Failed to fetch users data",
      message: error.message,
      success: false,
    });
  }
});

// Get genre analytics
app.get("/dashboard/genres", async (req, res) => {
  try {
    const { booksCollection } = await getCollections();
    const genreStats = await booksCollection
      .aggregate([
        { $group: { _id: "$genre", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    const formattedStats = genreStats.map((stat) => ({
      name: stat._id || "Unknown",
      value: stat.count,
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`, // Random color
    }));

    res.send(formattedStats);
  } catch (error) {
    console.error("Dashboard genres error:", error);
    res.status(500).send({ error: "Failed to fetch genre data" });
  }
});

// Get recent comments
app.get("/dashboard/recent-comments", async (req, res) => {
  try {
    const { commentsCollection } = await getCollections();

    const recentComments = await commentsCollection
      .find({})
      .sort({ createdAt: -1 }) // Sort by newest first
      .limit(5)
      .toArray();

    res.send(recentComments);
  } catch (error) {
    console.error("Dashboard recent comments error:", error);
    res.status(500).send({ error: "Failed to fetch recent comments" });
  }
});

// Create test user endpoint (for debugging)
app.post("/create-test-user", async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const testUser = {
      email: "test@example.com",
      displayName: "Test User",
      photoURL: "https://via.placeholder.com/150",
      role: "user",
      status: "active",
      created_at: new Date().toISOString(),
      last_loggedIn: new Date().toISOString(),
    };

    const existingUser = await usersCollection.findOne({
      email: testUser.email,
    });
    if (existingUser) {
      return res
        .status(200)
        .json({ message: "Test user already exists", user: existingUser });
    }

    const result = await usersCollection.insertOne(testUser);
    res.status(201).json({
      message: "Test user created",
      user: testUser,
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error("Create test user error:", error);
    res.status(500).json({
      error: "Failed to create test user",
      message: error.message,
    });
  }
});

////user collection create or update //// all kinds of user here
app.post("/users", async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const user = req.body;

    user.created_at = new Date().toISOString();
    user.last_loggedIn = new Date().toISOString();
    user.role = "user";
    user.status = "active";
    const query = { email: user.email };
    const existingUser = await usersCollection.findOne(query);

    if (existingUser) {
      const result = await usersCollection.updateOne(query, {
        $set: { last_loggedIn: new Date().toISOString() },
      });
      return res.send(result);
    }

    const result = await usersCollection.insertOne(user);
    res.send(result);
  } catch (error) {
    console.error("Error creating/updating user:", error);
    res.status(500).send({
      error: "Failed to create/update user",
      message: error.message,
    });
  }
});

/////get user role   ///
// app.get("/users/role", verifyJWT, async (req, res) => {
//   console.log(req.tokenEmail);

//   const result = await usersCollection.findOne({ email: req.tokenEmail });
//   res.send({ role: result?.role });
// });

// or
app.get("/users/role", verifyJWT, async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const email = req.tokenEmail;

    if (!email) {
      return res.status(400).send({ message: "Email missing" });
    }

    const user = await usersCollection.findOne({ email });

    if (!user) {
      return res.send({ role: "guest" });
    }

    res.send({ role: user.role });
  } catch (error) {
    console.error("Error fetching user role:", error);
    res.status(500).send({
      error: "Failed to fetch user role",
      message: error.message,
    });
  }
});

/////get profile data
app.get("/user/:email", async (req, res) => {
  try {
    const { usersCollection } = await getCollections();
    const email = req.params.email;
    const query = { email: email };
    const userDetails = await usersCollection.findOne(query);
    res.send(userDetails);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).send({
      error: "Failed to fetch user profile",
      message: error.message,
    });
  }
});

// Send a ping to confirm a successful connection
console.log("MongoDB connection initialized for serverless deployment");

// Initialize database connection
clientPromise
  .then(() => {
    console.log("Connected to MongoDB successfully!");
  })
  .catch(console.error);

// For serverless deployment, export the app
module.exports = app;

// For local development
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Digital Library Server listening on port ${port}`);
  });
}
