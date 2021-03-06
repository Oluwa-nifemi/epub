const express = require('express');
require('dotenv').config();
const config = require('config');
const cors = require('cors');
const app = express();
const helmet = require('helmet');
const connectDB = require('./config/db');

// app.options('*', cors());
app.use(cors());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });

// Initialize express session middleware
app.use(express.json());
app.use(express.static('assets'));
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self"],
            scriptSrc: ["'self"]
        }
    },
    referrerPolicy: { policy: 'same-origin'}
}))

// Routes initialized
// const User = require('./Routes/user');
const Bar = require('./Routes/bar');
const Order = require('./Routes/order');
const BarOwner = require('./Routes/barConfirmation');
const Admin = require('./Routes/admin');

// app.use('/User', User);
app.use('/Bar', Bar);
app.use('/Order', Order);
app.use('/BarOwner', BarOwner);
app.use('/Admin', Admin);


// Start server on port
const port = process.env.PORT || 5000;


// Connect Database
connectDB().then(() => {
    app.listen(port, () => {
        console.log(`Server listening on port ${port}`)
    });
});