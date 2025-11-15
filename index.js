const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

///middleware
app.use(cors());
app.use(express.json());

const uri =
  "mongodb+srv://projects-db:W3gn3R6OcMphvIAx@cluster0.fyk0nds.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("my-bookCollection");
    const booksCollection = db.collection("books");
    ////1.Get all
    app.get("/allbooks", async (req, res) => {
      const results = await booksCollection.find().toArray();
      res.send(results);
    });

    ///get 6 data///
    app.get("/leatest-six", async (req, res) => {
      const results = await booksCollection
        .find()
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(results);
    });

    ///2.Get single book
    app.get("/allbooks/:id", async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const result = await booksCollection.findOne({ _id: objectId });
      res.send(result);
    });

    ///3.Create single book
    app.post("/allbooks", async (req, res) => {
      const project = req.body;
      const result = await booksCollection.insertOne(project);
      res.send(result);
    });
    ////4.create many books

    app.post("/allbooks/newCollection", async (req, res) => {
      const booksnewCollection = req.body;
      const result = await booksCollection.insertMany(booksnewCollection);
      res.send(result);
    });

    ///5.Update single book
    app.put("/single-book/:id", async (req, res) => {
      const { id } = req.params;
      const updatedBook = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = { $set: updatedBook };
      const result = await booksCollection.updateOne(filter, update);
      res.send(result);
    });

    ///6.Delete single book

    app.delete("/books/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) }; ///this id matches with mongodb _id
      const result = await booksCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
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
