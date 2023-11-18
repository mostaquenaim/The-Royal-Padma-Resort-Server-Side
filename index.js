const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken'); //uncommented
const cookieParser = require('cookie-parser'); //uncommented
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(
    cors({
        origin: [
            'http://localhost:5173', 
            // 'https://the-royal-padma-resort.web.app', 
            'https://hotel-projecr.web.app'
    ],
    // uncommented credentials
        credentials: true
    })
);
app.use(express.json());
app.use(cookieParser()); //uncommented

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4epqqc2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});


// middlewares 
// const logger = (req, res, next) => {
//     console.log('log: info', req.method, req.url);
//     next();
// }

// uncommented 
const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    // console.log('token in the middleware', token);
    // no token available 
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'unauthorized access 2' })
        }
        req.user = decoded;
        next();
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const imageCollection = client.db('hotelDB').collection('rooms');
        const roomImageCollection = client.db('hotelDB').collection('RoomImageries');
        const amenitiesImageCollection = client.db('hotelDB').collection('amenitiesImagery');
        const offerCollection = client.db('hotelDB').collection('promotions');
        const roomDetailsCollection = client.db('hotelDB').collection('room_details');
        const roomReviewsCollection = client.db('hotelDB').collection('room_reviews');
        const bookingCollection = client.db('hotelDB').collection('bookings');

        // auth related api
        // jwt uncommented 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            console.log('user for token', user);
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true });
        })

        // uncommented
        app.post('/logout', async (req, res) => {
            const user = req.body;
            console.log('logging out', user);
            res.clearCookie('token', { maxAge: 0 }).send({ success: true })
        })

        // get all room imageries 
        app.get('/room-imageries', async (req, res) => {
            const result = await roomImageCollection.find(req?.query).toArray();
            res.send(result);
        })

        // get all amenities imageries 
        app.get('/amenities-imageries', async (req, res) => {
            const result = await amenitiesImageCollection.find(req?.query).toArray();
            res.send(result);
        })

        // get all room details 
        app.get('/room-details', async (req, res) => {
            const result = await roomDetailsCollection.find(req?.query).toArray();
            res.send(result);
        })

        // get particular room details 
        app.get('/room-details-no/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await roomDetailsCollection.findOne(query)
            res.send(result);
        })

        // get particular room reviews 
        app.get('/room-reviews/:id', async (req, res) => {
            const id = req.params.id;
            const query = { 'room._id': id }
            const result = await roomReviewsCollection.find(query).toArray()
            res.send(result);
        })

        // get all room reviews 
        app.get('/all-reviews', async (req, res) => {
            const query = req.body;
            const result = await roomReviewsCollection.find(query).toArray()
            res.send(result);
        })

        // post reviews 
        app.post('/post-reviews', async (req, res) => {
            const query = req.body;

            const result = await roomReviewsCollection.insertOne(query);
            res.send(result);
        });

        // book a room 
        app.post('/book-room/:id', async (req, res) => {
            const id = req.params.id; //room id
            const query = req.body; //details

            // Check if the room is available
            const roomQuery = { _id: new ObjectId(id) };
            const room = await roomDetailsCollection.findOne(roomQuery);

            if (!room) {
                // Room not found
                return res.status(404).send({ message: 'Room not found' });
            }

            if (room.seats <= 0) {
                // No available seats
                return res.status(400).send({ message: 'No available seats for this room' });
            }

            // Update the seats count
            const updatedSeats = room.seats - 1;
            const updateRoomQuery = {
                $set: { seats: updatedSeats },
            };

            // Insert the booking record
            const result = await bookingCollection.insertOne(query);

            // Update the seats count for the room
            await roomDetailsCollection.updateOne(roomQuery, updateRoomQuery);

            res.send(result);
        });

        // Delete a booking
        app.delete('/deleteBooking/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            // Find the booking before deleting
            const resp = await bookingCollection.findOne(query);

            const roomId = resp.room._id; // Assuming room _id is stored in result.room._id
            const roomQuery = { _id: new ObjectId(roomId) };
            const room = await roomDetailsCollection.findOne(roomQuery);
            // 
            const updatedSeats = room.seats + 1
            const updateRoomQuery = {
                $set: { seats: updatedSeats },
            };

            // 

            await roomDetailsCollection.updateOne(roomQuery, updateRoomQuery);

            // Now, delete the booking
            const result = await bookingCollection.deleteOne(query);


            res.send(result);
        });

        app.patch('/updateBookings/:id', async (req, res) => {
            console.log("come");
            const id = req.params.id;
            const userEmail = req.query.email
            const query = {
                'user.email': userEmail, // Use the userEmail variable
            };
            const filter = { _id: new ObjectId(id) };
            const updatedBooking = req.body;
            const updateDoc = {
                $set: {
                    date: updatedBooking.date
                },
            };
            await bookingCollection.updateOne(filter, updateDoc);
            const cursor = bookingCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedBooking = req.body;

            const updateDoc = {
                $set: {
                    status: updatedBooking.status
                },
            };
            const result = await imageCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }

            const options = {
                // Include only the `title` and `imdb` fields in the returned document
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            };

            const result = await serviceCollection.findOne(query, options);
            res.send(result);
        })

        // get all promotions 
        app.get('/promotions', async (req, res) => {
            const result = await offerCollection.find(req?.query).toArray();
            res.send(result);
        })

        // my bookings
        app.get('/bookings',verifyToken, async (req, res) => {
            console.log("bookisss")
            const userEmail = req.query.email; // Access the 'email' query parameter from the URL

            // Construct the query to match the user's email within the 'user' field
            const query = {
                'user.email': userEmail, // Use the userEmail variable
            };

            const options = {
                sort: {
                    date: 1, // Sort the 'date' field in ascending order
                }
            };

            const cursor = bookingCollection.find(query, options);
            const result = await cursor.toArray();

            res.send(result);
        });

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('hotel is running')
})

app.listen(port, () => {
    console.log(`hotel Server is running on port ${port}`)
})