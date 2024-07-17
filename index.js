const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();
const bcrypt = require("bcryptjs");
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6u1ikeh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const usersCollection = client.db("mfs").collection("users");

    app.post("/register", async (req, res) => {
      const { name, pin, phone, email, role } = req.body;

      if (!/^\d{5}$/.test(pin)) {
        return res.status(400).send({ error: "PIN must be a 5-digit number" });
      }

      const hashedPin = await bcrypt.hash(pin, 10);
      const newUser = {
        name,
        pin: hashedPin,
        phone,
        email,
        role,
        status: false,
        balance: 0,
      };
      try {
        const result = await usersCollection.insertOne(newUser);
        res.status(201).send({
          message: "User registered successfully",
          userId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({ error: "Failed to register user" });
      }
    });
    //
    // app.post("/login", async (req, res) => {
    //   const { identifier, pin } = req.body;
    //   const user = await usersCollection.findOne({
    //     $or: [{ email: identifier }, { phone: identifier }],
    //   });

    //   if (!user) {
    //     return res.status(404).send({ error: "User not found" });
    //   }

    //   const isMatch = await bcrypt.compare(pin, user.pin);

    //   if (!isMatch) {
    //     return res.status(401).send({ error: "Invalid credentials" });
    //   }

    //   const token = jwt.sign(
    //     { userId: user._id, role: user.role },
    //     process.env.ACCESS_TOKEN_SECRET,
    //     { expiresIn: "1h" }
    //   );
    //   res.status(200).send({ token });
    // });

    // User approval by admin
    app.post("/admin/approve", async (req, res) => {
      const { userId } = req.body;
      const user = await usersCollection.findOne({ _id: new ObjectID(userId) });

      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      const bonus = user.role === "agent" ? 10000 : 40;

      try {
        await usersCollection.updateOne(
          { _id: new ObjectID(userId) },
          { $set: { status: "active", balance: bonus } }
        );
        res.status(200).send({ message: "User approved successfully" });
      } catch (error) {
        res.status(500).send({ error: "Failed to approve user" });
      }
    });

    // login
    app.post("/login", async (req, res) => {
      const { mobile, email, pin } = req.body;
      try {
        const user = await usersCollection.findOne({
          $or: [{ mobile }, { email }],
        });
        if (!user || !(await bcrypt.compare(pin, user.pin))) {
          return res.status(400).json({ error: "Invalid credentials" });
        }
        const token = jwt.sign(
          { userId: user._id },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: "1h" }
        );
        res.json({ token });
      } catch (error) {
        res.status(500).json({ error: "Login failed" });
      }
    });

    // get all users data from db
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // get verified all user
    app.get("/verified/users", async (req, res) => {
      try {
        const users = await usersCollection.find({ status: true }).toArray();
        res.status(200).json(users);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running");
});

app.listen(port, () => {
  console.log(`mfs server is running on port${port}`);
});
