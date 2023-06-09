const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 3000;


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        // classes database table 
        const classes = database.collection("classes");


        app.post('/jwt', (req, res) => {
            const userEmail = req.body;
            const token = jwt.sign(userEmail, process.env.ACCESS_TOKEN, { expiresIn: '24h' });
            res.send({ token })
        })

        // check user role 
        app.get('/users/checkrole/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const found = await users.findOne(query);
            // console.log(found);
            if (found) {
                const role = found.role;
                res.send(role);
            }
            else {
                res.status(404).send({ error: true, message: 'user not found' })
            }
        })

        // add new class to database - instructor
        app.post('/addclass', async (req, res) => {
            const newClass = req.body;
            const result = await classes.insertOne(newClass);
            res.send(result);
        })

        // get all classes - admin 
        app.get('/allclass', async (req, res) => {
            const result = await classes.find().toArray();
            res.send(result);
        })

        // get all users - admin 
        app.get('/allusers', async(req, res) => {
            const result = await users.find().toArray();
            res.send(result);
        })

        // update class status - admin 
        app.patch('/updatestatus/:id', async (req, res) => {
            const id = req.params.id;
            const status = req.query.status;
            const filter = { _id: new ObjectId(id) }

            const updateClass = {
                $set: {
                    status: status
                },
            };

            const result = await classes.updateOne(filter, updateClass);
            res.send(result);
        })

        // update feedback - admin 
        app.patch('/updatefb', async(req, res) => {
            const id = req.query.id;
            const feedback = req.body;
            const filter = { _id: new ObjectId(id) }

            const updateClass = {
                $set: {
                    feedback: feedback.value
                },
            };

            const result = await classes.updateOne(filter, updateClass);
            res.send(result);
        })

        //update user role - admin
        app.patch('/updaterole', async(req, res) => {
            const id = req.query.id;
            const role = req.body;
            const filter = { _id: new ObjectId(id) };

            const updateUser = {
                $set: {
                    feedback: role
                },
            };

            const result = await users.updateOne(filter, updateUser);
            res.send(result);
        })

        // get class by instructor
        app.get('/classes', async (req, res) => {
            const email = req.query.email;
            // console.log(email);
            const query = { instructorEmail: email };
            const result = await classes.find(query).toArray();
            // console.log(result);
            res.send(result)
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