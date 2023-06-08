const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 3000;


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6rjh1tl.mongodb.net/?retryWrites=true&w=majority`;


// middleware
app.use(express.json());
app.use(cors())

// verify token 
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    //bearer token 
    const token = authorization.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}

//----------------- Mongo DB ------------------------
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

        const database = client.db("justMusic");
        // user Database table
        const users = database.collection("users");

        app.post('/jwt', (req, res) => {
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN, { expiresIn: '24h' });
            res.send({ token })
        })

        // set user to database 
        app.post('/setuser', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const find = await users.findOne(query);
            if (find) {
                return;
            }
            const result = await users.insertOne(user);
            res.send(result);
        })
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);
//----------------- Mongo DB ------------------------

app.get('/', (req, res) => {
    res.send('justMusic server is running')
})

app.listen(port, () => {
    console.log(`jusMusic is running on port ${port}`);
})