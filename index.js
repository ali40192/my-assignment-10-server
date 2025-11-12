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

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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

    const db = client.db("project-db");
    const projectsCollection = db.collection("projects");
    ////1.Get all
    app.get("/projects", async (req, res) => {
      const results = await projectsCollection.find().toArray();
      res.send(results);
    });

    ///2.Get single project
    app.get("/projects/:id", async (req, res) => {
      const { id } = req.params;
      const objectId = new ObjectId(id);
      const result = await projectsCollection.findOne({ _id: objectId });
      res.send(result);
    });

    ///3.Create single project
    app.post("/projects", async (req, res) => {
      const project = req.body;
      const result = await projectsCollection.insertOne(project);
      res.send(result);
    });
    ////4.create many projects

    app.post("/projects/newCollection", async (req, res) => {
      const projects = req.body;
      const result = await projectsCollection.insertMany(projects);
      res.send(result);
    });

    ///5.Update single project
    app.put("/projects/:id", async (req, res) => {
      const { id } = req.params;
      const updatedProject = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = { $set: updatedProject };
      const result = await projectsCollection.updateOne(filter, update);
      res.send(result);
    });

    ///6.Delete single project

    app.delete("projects/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) }; ///this id matches with mongodb _id
      const result = await projectsCollection.deleteOne(query);
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
