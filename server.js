const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();
const app = express();
const multer = require('multer');
// Increase payload size limits using Express's built-in middleware
app.use(express.json({ limit: '10mb' })); // For JSON payloads
app.use(express.urlencoded({ limit: '10mb', extended: true })); // For URL-encoded payloads

// SMTP Configuration for Hostinger Webmail
const transporter = nodemailer.createTransport({
host: "smtp.hostinger.com",
port: 465,
secure: true,
auth: {
    user: 'process.env.SMTP_EMAIL',
    pass: 'process.env.SMTP_PASSWORD',
},
auth: {
  user: process.env.SMTP_EMAIL,
  pass: process.env.SMTP_PASSWORD,
},

});


const PORT =  9001;

console.log('Attempting to start server on port:', PORT);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Your middleware and routes go here

app.listen(PORT, (err) => {
  if (err) {
    console.error('Error starting server:', err);
  } else {
    console.log(`Server is running on port ${PORT}`);
  }
});

// Close the Mongoose connection if the Node process ends
process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('Mongoose connection disconnected through app termination');
    process.exit(0);
  });
});
app.use(bodyParser.json());
app.use(cors());

// Generate Random Username and Password
const generateCredentials = () => {
  const username = `user${Math.floor(1000 + Math.random() * 9000)}${Math.random().toString(36).substring(2, 4)}`; // e.g., user1234ab
  const password = `${Math.random().toString(36).substring(2, 6)}${Math.floor(10 + Math.random() * 90)}`; // e.g., abcd42

  return { username, password };
};
