const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 3000;

//stripe payment key
const stripe = require("stripe")(process.env.PAYMENT_KEY);


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
        // student selected class database table 
        const studentClasses = database.collection("studentClasses");


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
        app.get('/allusers', async (req, res) => {
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
        app.patch('/updatefb', async (req, res) => {
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
        app.patch('/updaterole', async (req, res) => {
            const id = req.query.id;
            const update = req.body;
            const filter = { _id: new ObjectId(id) };

            const updateUser = {
                $set: {
                    role: update.role
                },
            };

            const result = await users.updateOne(filter, updateUser);
            res.send(result);
        })

        // get class by - instructor
        app.get('/classes', async (req, res) => {
            const email = req.query.email;
            // console.log(email);
            const query = { instructorEmail: email };
            const result = await classes.find(query).toArray();
            // console.log(result);
            res.send(result)
        })

        //select class - student
        app.post('/selectclass', async (req, res) => {
            const email = req.query.email;
            const selectedClass = req.body;
            const id = selectedClass.classId;
            const query = { classId: id, studentEmail: email };
            const find = await studentClasses.findOne(query)
            console.log(find);
            if (find) {
                return res.send({ matched: true })
            }
            else {
                const result = await studentClasses.insertOne(selectedClass);
                res.send(result)
            }
        })

        //delete selected class - student
        app.delete('/deletmyclass/:id', async (req, res) => {
            const email = req.query.email;
            const id = req.params.id;
            const query = { classId: id, studentEmail: email }
            const result = await studentClasses.deleteOne(query);
            // console.log(id);
            res.send(result);
        })

        //my selected classes - student
        app.get('/myselectedclass', async (req, res) => {
            const email = req.query.email;
            const filter = { paymentStatus: 'pending', studentEmail: email }
            const result = await studentClasses.find(filter).toArray();
            const ids = result.map(item => new ObjectId(item.classId));
            // console.log(ids);
            const query = { _id: { $in: ids } };
            const finalResult = await classes.find(query).toArray();

            res.send(finalResult);
        })

        //after payment - student
        app.patch('/paymentsuccess', async (req, res) => {
            const classId = req.query.classId;
            const filterClass = { _id: new ObjectId(classId) }
            const findClass = await classes.findOne(filterClass)
            const afterMathOne = findClass.totalEnrolledStudent + 1;
            const afterMathTwo = findClass.availableSeat - 1;
            const updateClass = {
                $set: {
                    totalEnrolledStudent: afterMathOne,
                    availableSeat: afterMathTwo
                },
            }
            const resultClass = await classes.updateOne(filterClass, updateClass);


            const email = req.query.email;
            const paymentInfo = req.body;
            const paymentStatus = paymentInfo.paymentStatus;
            const paymentDate = paymentInfo.paymentDate;
            const paymentId = paymentInfo.transactionId;

            const filter = { classId: classId, studentEmail: email }

            const options = { upsert: true };

            const updateInfo = {
                $set: {
                    paymentStatus: paymentStatus,
                    paymentDate,
                    paymentId
                },
            }

            const result = await studentClasses.updateOne(filter, updateInfo, options);
            res.send(result)
        })

        //all instructors
        app.get('/allinstructors', async (req, res) => {
            const filter = { role: 'instructor' };
            const result = await users.find(filter).toArray();
            res.send(result);
        })

        //all classes
        app.get('/allclasses', async (req, res) => {
            const filter = { status: 'approved' }
            const result = await classes.find(filter).toArray();
            res.send(result)
        })

        //my enrolled class
        app.get('/enrolledclass', async (req, res) => {
            const email = req.query.email;
            const filter = { studentEmail: email, paymentStatus: 'successful' }
            const result = await studentClasses.find(filter).toArray();
            const ids = result.map(item => new ObjectId(item.classId));

            const query = { _id: { $in: ids } };
            const finalResult = await classes.find(query).toArray();

            // const result = await studentClasses.find(filter).toArray();
            // res.send(result)


            res.send(finalResult);
        })

        //my payment history
        app.get('/payhistory', async (req, res) => {
            const email = req.query.email;
            const filter = { studentEmail: email, paymentStatus: 'successful' }
            const result = await studentClasses.find(filter).toArray();
            res.send(result)
        })

        // popular class - home 
        app.get('/popularclass', async (req, res) => {
            // const maxEnrolledClasses = await classes.find().sort({ totalEnrolledStudent: -1 }).limit(2).toArray();
            const query = [
                { $match: { status: "approved" } },
                { $sort: { totalEnrolledStudent: -1 } },
                { $limit: 2 }
            ];
            const result = await classes.aggregate(query).toArray();
            res.send(result);
        })

        //popular instructor - home
        app.get('/popularinstructor', async (req, res) => {
            const query = [
                { $match: { status: "approved" } },
                { $sort: { totalEnrolledStudent: -1 } },
                { $limit: 2 }
            ];
            const result = await classes.aggregate(query).toArray();

            const emails = result.map(item => item.instructorEmail);
            const queryFinal = { email: { $in: emails } };
            const finalResult = await users.find(queryFinal).toArray();
            res.send(finalResult)
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

        //payment zone
        //create payment intent
        app.post('/paymentintent', async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret
            })
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