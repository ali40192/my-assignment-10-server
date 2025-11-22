const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

///middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.PASS_DB}@cluster0.fyk0nds.mongodb.net/?appName=Cluster0`;

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

    const db = client.db("my-bookCollection");
    const booksCollection = db.collection("books");
    const loggedusersCollection = db.collection("comment-collection");

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

    ///2.Get one book
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

    // create logged users comment//

    app.post("/cratecomment", async (req, res) => {
      const mycomment = req.body;
      const result = await loggedusersCollection.insertOne(mycomment);
      res.send(result);
    });

    // get logged users comment//

    app.get("/getcomment", async (req, res) => {
      const email = req.query.email;
      const result = await loggedusersCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
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
