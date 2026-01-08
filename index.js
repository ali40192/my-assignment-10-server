const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

///middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.send({ message: "Digital Library Server is running!" });
});

// Test endpoint for debugging
app.get("/test", (req, res) => {
  res.send({ message: "Server is working correctly", timestamp: new Date() });
});

// Debug endpoint to list all routes
app.get("/debug/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods),
      });
    }
  });
  res.json({ routes, message: "Available routes" });
});

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.fyk0nds.mongodb.net/?appName=Cluster0`;

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

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();

    const db = client.db("digitalLibrary");
    const booksCollection = db.collection("books");
    const usersCollection = db.collection("users");
    const reviewsCollection = db.collection("reviews");
    const borrowedBooksCollection = db.collection("borrowedBooks");
    const categoriesCollection = db.collection("categories");
    const readingListsCollection = db.collection("readingLists");
    const libraryStatsCollection = db.collection("libraryStats");

    ////1.Get all books with enhanced filtering
    app.get("/allbooks", async (req, res) => {
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

      const results = await booksCollection
        .find(filter)
        .skip(skip)
        .limit(parseInt(limit))
        .sort({ createdAt: -1 })
        .toArray();

      const total = await booksCollection.countDocuments(filter);

      res.send({
        books: results,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalBooks: total,
          hasNext: skip + results.length < total,
          hasPrev: page > 1,
        },
      });
    });

    ///get featured books
    app.get("/featured-books", async (req, res) => {
      const results = await booksCollection
        .find({ featured: true })
        .limit(8)
        .toArray();
      res.send(results);
    });

    ///get latest books
    app.get("/latest-books", async (req, res) => {
      const results = await booksCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(results);
    });

    ///get popular books (by rating)
    app.get("/popular-books", async (req, res) => {
      const results = await booksCollection
        .find()
        .sort({ averageRating: -1 })
        .limit(8)
        .toArray();
      res.send(results);
    });

    ///get books by category
    app.get("/books/category/:category", async (req, res) => {
      const { category } = req.params;
      const results = await booksCollection
        .find({ category })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(results);
    });

    ///2.Get one book
    app.get("/allbooks/:id", async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const result = await booksCollection.findOne({ _id: objectId });
      res.send(result);
    });

    ///3.Create single book with enhanced fields
    app.post("/allbooks", async (req, res) => {
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
    });

    ///5.Update single book
    app.put("/allbooks/:id", async (req, res) => {
      const { id } = req.params;
      const updatedBook = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = { $set: updatedBook };
      const result = await booksCollection.updateOne(filter, update);
      res.send(result);
    });

    ///6.Delete single book

    app.delete("/allbooks/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) }; ///this id matches with mongodb _id
      const result = await booksCollection.deleteOne(query);
      res.send(result);
    });

    ///get book for my data//
    app.get("/mybooks", async (req, res) => {
      const email = req.query.email;
      const result = await booksCollection.find({ userEmail: email }).toArray();
      res.send(result);
    });

    // Categories endpoints
    app.get("/categories", async (req, res) => {
      const categories = await categoriesCollection.find().toArray();
      res.send(categories);
    });

    app.post("/categories", async (req, res) => {
      const category = {
        ...req.body,
        createdAt: new Date(),
        bookCount: 0,
      };
      const result = await categoriesCollection.insertOne(category);
      res.send(result);
    });

    // Reviews endpoints
    app.post("/reviews", async (req, res) => {
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
    });

    app.get("/reviews/:bookId", async (req, res) => {
      const { bookId } = req.params;
      const reviews = await reviewsCollection
        .find({ bookId })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(reviews);
    });

    // Borrow book
    app.post("/borrow", async (req, res) => {
      const { bookId, userEmail, userName } = req.body;
      const objectId = new ObjectId(bookId);

      // Check if book is available
      const book = await booksCollection.findOne({ _id: objectId });
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
    });

    // Return book
    app.post("/return", async (req, res) => {
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
    });

    // Get borrowed books for user
    app.get("/borrowed-books", async (req, res) => {
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
    });

    // Reading Lists
    app.post("/reading-lists", async (req, res) => {
      const readingList = {
        ...req.body,
        createdAt: new Date(),
        books: [],
      };
      const result = await readingListsCollection.insertOne(readingList);
      res.send(result);
    });

    app.get("/reading-lists", async (req, res) => {
      const email = req.query.email;
      const lists = await readingListsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(lists);
    });

    app.post("/reading-lists/:listId/books", async (req, res) => {
      const { listId } = req.params;
      const { bookId } = req.body;

      await readingListsCollection.updateOne(
        { _id: new ObjectId(listId) },
        { $addToSet: { books: bookId } }
      );

      res.send({ message: "Book added to reading list" });
    });

    // Dashboard Statistics
    app.get("/dashboard/stats", async (req, res) => {
      try {
        const totalBooks = await booksCollection.countDocuments();
        const totalUsers = await usersCollection.countDocuments();
        const totalComments = await db
          .collection("comment-collection")
          .countDocuments();

        // Get books by status if available, otherwise use all books
        const availableBooks = await booksCollection.countDocuments({
          $or: [
            { status: { $exists: false } }, // Books without status field
            { status: "available" },
          ],
        });

        // Get average rating from your books
        const avgRatingResult = await booksCollection
          .aggregate([
            { $group: { _id: null, avgRating: { $avg: "$rating" } } },
          ])
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
          averageRating:
            Math.round((avgRatingResult[0]?.avgRating || 0) * 10) / 10,
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
        const totalBooks = await booksCollection.countDocuments();
        const totalComments = await db
          .collection("comment-collection")
          .countDocuments();

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
        const userCount = await usersCollection.countDocuments();
        const sampleUser = await usersCollection.findOne({});
        res.send({
          message: "Users collection accessible",
          totalUsers: userCount,
          sampleUser: sampleUser,
          collections: await db.listCollections().toArray(),
        });
      } catch (error) {
        res.status(500).send({
          error: "Failed to access users collection",
          message: error.message,
        });
      }
    });

    // Simple users list endpoint (no auth required)
    app.get("/users/list", async (req, res) => {
      try {
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
        console.log("Dashboard users endpoint called");
        console.log("Query params:", req.query);

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        console.log(
          `Fetching users: page=${page}, limit=${limit}, skip=${skip}`
        );

        // Check if users collection exists and is accessible
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
        const recentComments = await db
          .collection("comment-collection")
          .find({})
          .sort({ _id: -1 }) // Sort by newest first
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
        res
          .status(201)
          .json({
            message: "Test user created",
            user: testUser,
            insertedId: result.insertedId,
          });
      } catch (error) {
        console.error("Create test user error:", error);
        res
          .status(500)
          .json({
            error: "Failed to create test user",
            message: error.message,
          });
      }
    });

    ////user collection create or update //// all kinds of user here
    app.post("/users", async (req, res) => {
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
    });

    /////get user role   ///
    // app.get("/users/role", verifyJWT, async (req, res) => {
    //   console.log(req.tokenEmail);

    //   const result = await usersCollection.findOne({ email: req.tokenEmail });
    //   res.send({ role: result?.role });
    // });

    // or
    app.get("/users/role", verifyJWT, async (req, res) => {
      const email = req.tokenEmail;

      if (!email) {
        return res.status(400).send({ message: "Email missing" });
      }

      const user = await usersCollection.findOne({ email });

      if (!user) {
        return res.send({ role: "guest" });
      }

      res.send({ role: user.role });
    });

    /////get profile data
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const userDetails = await usersCollection.findOne(query);
      res.send(userDetails);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
