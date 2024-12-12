const express = require('express');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 8001;

// ------------||Serve static files from the 'uploads' directory||----------------------
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    phoneNumber: {
      type: String,
      required: true
    },
    balance: {
      type: Number,
      default: 0
    },
    productprofitBalance: {
      type: Number,
      default: 0
    },
    advancePoints: {
      type: Number,
      default: 0
    },
    totalPoints: {
      type: Number,
      default: 0
    },
    directPoints: {
      type: Number,
      default: 0
    },
    indirectPoints: {
      type: Number,
      default: 0
    },
    trainingBonusBalance: {
      type: Number,
      default: 0
    },
    plan: {
      type: String,
      required: true
    },
    rank: {
      type: String,
      default: 'Buisness Member'
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    }, // Reference to the parent (referrer)
    refPer: {
      type: Number,
      required: true
    },
    refParentPer: {
      type: Number,
      required: true
    },
    parentName: {
      type: String,
      default: 'Admin'
    },
    grandParentName: {
      type: String,
      default: 'Admin'
    },
    productProfitHistory: [
      {
        amount: { type: Number, required: true },
        directPointsIncrement: { type: Number, required: true },
        totalPointsIncrement: { type: Number, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    profilePicture: {
      type: String, // URL or file path to the image
      default: null
    },

  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt timestamps
  }
);

const User = mongoose.model('User', userSchema);

// -----------------------||Get full name of user||---------------------------
app.get('/api/user/:userId', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.userId });
    if (!user) {
      return res.status(404).send('User not found');
    }
    res.send({user});
  } catch (err) {
    res.status(500).send(err);
  }
});

// ]----------------------||Authentication Endpoint||--------------------------------[

app.post('/api/authenticate', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      password: password
    });

    if (user) {
      res.json({ success: true, username: user.username });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
//------------------------||Training Bonus Approval Queue||--------------------------

const TrainingBonusApprovalSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    transactionId: { type: String, required: true },
    transactionAmount: { type: Number, required: true },
    gateway: { type: String, required: true },
    imagePath: { type: String, required: true },
    status: { type: String, default: 'pending' }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt timestamps
  }
);

const TrainingBonusApproval = mongoose.model('TrainingBonusApproval', TrainingBonusApprovalSchema);

// Define approved schema
const TrainingBonusApprovedSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    transactionId: { type: String, required: true },
    transactionAmount: { type: Number, required: true },
    gateway: { type: String, required: true },
    addedPoints: { type: Number, required: true },
    imagePath: { type: String, required: true },
    status: { type: String, default: 'approved' }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt timestamps
  }
);

const TrainingBonusApproved = mongoose.model('TrainingBonusApproved', TrainingBonusApprovedSchema);

// Define rejected schema
const TrainingBonusRejectedSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    transactionId: { type: String, required: true },
    transactionAmount: { type: Number, required: true },
    gateway: { type: String, required: true },
    imagePath: { type: String, required: true },
    feedback: { type: String, required: true },
    status: { type: String, default: 'rejected' }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt timestamps
  }
);

const TrainingBonusRejected = mongoose.model('TrainingBonusRejected', TrainingBonusRejectedSchema);

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../uploads/training-bonus'); // Uploads folder where files will be stored
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  }
});

// Multer file filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Multer upload instance
const upload = multer({ storage: storage, fileFilter: fileFilter });

app.use(express.json());

// -----------||POST route for uploading training bonus data||---------------

app.post('/api/training-bonus/upload', upload.single('image'), async (req, res) => {
  try {
    const { username, transactionId, transactionAmount, gateway } = req.body;

    // Construct the file path for the uploaded image
    const imagePath = req.file.path;

    // Create new TrainingBonusApproval document
    const newApproval = new TrainingBonusApproval({
      username,
      transactionId,
      transactionAmount: Number(transactionAmount),
      gateway,
      imagePath: imagePath
    });

    // Save the new document to MongoDB
    await newApproval.save();

    res.status(201).json({ message: 'Training bonus approval data uploaded successfully.' });
  } catch (err) {
    console.error('Error uploading training bonus data:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Fetch training bonuses for the user
app.get('/api/training-bonus/:username', async (req, res) => {
  try {
    const bonuses = await TrainingBonusApproval.find({ username: req.params.username }).sort({ createdAt: -1 });
    res.json(bonuses);
  } catch (error) {
    console.error('Error fetching training bonuses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch approved training bonuses for the user
app.get('/api/approvals/approve/:username', async (req, res) => {
  try {
    const approvedBonuses = await TrainingBonusApproved.find({ username: req.params.username }).sort({ createdAt: -1 });
    res.json(approvedBonuses);
  } catch (error) {
    console.error('Error fetching approved training bonuses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch rejected training bonuses for the user
app.get('/api/approvals/reject/:username', async (req, res) => {
  try {
    const rejectedBonuses = await TrainingBonusRejected.find({ username: req.params.username }).sort({ createdAt: -1 });
    res.json(rejectedBonuses);
  } catch (error) {
    console.error('Error fetching rejected training bonuses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//       ]------------------------||Investment Plans Model||----------------------------[

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  advancePoints: { type: Number, required: true },
  DirectPoint: { type: Number, required: true },
  IndirectPoint: { type: Number, required: true },
  parent: { type: Number, required: true },
  grandParent: { type: Number, required: true }
});
const Plan = mongoose.model('Plan', planSchema);

//      ]---------------------GET all Plans Documents-----------------------[

app.get('/api/plans', async (req, res) => {
  try {
    const plans = await Plan.find();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ]-------------------||Get Profile Data by username from User Model||-------------------------[

app.get('/api/users/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      fullName: user.fullName,
      rank: user.rank,
      plan: user.plan,
      refPer: user.refPer,
      phone: user.phoneNumber,
      refParentPer: user.refParentPer
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

const referralPaymentSchema = new mongoose.Schema({
  username: { type: String, required: true },
  transactionId: { type: String, required: true },
  transactionAmount: { type: Number, required: true },
  gateway: { type: String, required: true },
  planName: { type: String, required: true },
  planPRICE: { type: Number, required: true },
  advancePoints: { type: Number, required: true },
  DirectPoint: { type: Number, required: true },
  IndirectPoint: { type: Number, required: true },
  refPer: { type: Number, required: true },
  refParentPer: { type: Number, required: true },
  referrerPin: { type: String, required: true, unique: true },
  imagePath: { type: String, required: true },
  status: { type: String, default: 'pending' }
}, { timestamps: true });

const ReferralPaymentVerification = mongoose.model('ReferralPaymentVerification', referralPaymentSchema);
const ReferralApproveds = mongoose.model('ReferralApproveds', referralPaymentSchema);
const referralRejectedSchema = new mongoose.Schema({
  username: { type: String, required: true },
  transactionId: { type: String, required: true },
  transactionAmount: { type: Number, required: true },
  gateway: { type: String, required: true },
  imagePath: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, default: 'rejected' }
}, { timestamps: true });

const ReferralRejected = mongoose.model('ReferralRejected', referralRejectedSchema);

// Multer storage configuration
const referralStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '../uploads/referral-plan-payment');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  }
});

const uploadReferral = multer({ storage: referralStorage });

//----------------------|| POST route to handle payment verification upload||-------------------
const generateUniquePin = async () => {
  let pin;
  let isUnique = false;

  while (!isUnique) {
    pin = Math.random().toString(36).substring(2, 12); // Generate a random 10-character string
    const existingPin = await ReferralPaymentVerification.findOne({ referrerPin: pin });
    if (!existingPin) {
      isUnique = true;
    }
  }

  return pin;
};

app.post('/api/referral-payment/upload', uploadReferral.single('image'), async (req, res) => {
  try {
    // Generate a unique referrer pin
    const referrerPin = await generateUniquePin();
    
    // Create a new ReferralPaymentVerification instance
    const newPayment = new ReferralPaymentVerification({
      username: req.body.username,
      transactionId: req.body.transactionId,
      transactionAmount: req.body.transactionAmount,
      gateway: req.body.gateway,
      planName: req.body.planName,
      planPRICE: req.body.planPRICE,
      advancePoints: req.body.advancePoints,
      DirectPoint: req.body.DirectPoint,
      IndirectPoint: req.body.IndirectPoint,
      refPer: req.body.parent,
      refParentPer: req.body.grandParent,
      referrerPin: referrerPin, // Add referrer pin
      imagePath: req.file.path // Store path to uploaded image
    });

    // Save to MongoDB
    await newPayment.save();

    // Respond with success message
    res.status(201).json({ message: 'Payment verification details saved successfully.' });
  } catch (error) {
    console.error('Error saving payment verification:', error);
    res.status(500).json({ error: 'Failed to save payment verification details.' });
  }
});

// Endpoint to fetch referral payment verifications by username
app.get('/api/referral-payment/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const referralPayments = await ReferralPaymentVerification.find({ username: username });
    res.json(referralPayments);
  } catch (error) {
    console.error('Error fetching referral payment verifications:', error);
    res.status(500).json({ error: 'Failed to fetch referral payment verifications.' });
  }
});

// Fetch approvals by username
app.get('/api/approvals/referral/approve/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const approvals = await ReferralApproveds.find({ username });
    res.json(approvals);
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).send('Server error');
  }
});

// Fetch rejected approvals by username
app.get('/api/approvals/referral/reject/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const rejectedApprovals = await ReferralRejected.find({ username });
    res.json(rejectedApprovals);
  } catch (error) {
    console.error('Error fetching rejected approvals:', error);
    res.status(500).send('Server error');
  }
});


// User Accounts Model
const userAccountsSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    gateway: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountTitle: { type: String, required: true }
  },
  { timestamps: true }
);

const UserAccounts = mongoose.model('UserAccounts', userAccountsSchema);

// ------------------||POST route to add user payment account||------------------------

app.post('/api/user-accounts/add', async (req, res) => {
  const { username, gateway, accountNumber, accountTitle } = req.body;

  try {
    // Create a new UserAccounts instance
    const newUserAccount = new UserAccounts({
      username,
      gateway,
      accountNumber,
      accountTitle
    });

    // Save to MongoDB
    await newUserAccount.save();

    // Respond with success message
    res.status(201).json({ message: 'Account added successfully.' });
  } catch (error) {
    console.error('Error adding account:', error);
    res.status(500).json({ error: 'Failed to add account.' });
  }
});

// ]-------------------||GET route to fetch user accounts by username||----------------------[

app.get('/api/user-accounts/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const accounts = await UserAccounts.find({ username });
    res.status(200).json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts.' });
  }
});

const userPendingSchema = new mongoose.Schema(
  {
    planName: { type: String, required: true },
    planPRICE: { type: Number, required: true },
    advancePoints: { type: Number, required: true },
    DirectPoint: { type: Number, required: true },
    IndirectPoint: { type: Number, required: true },
    refPer: { type: Number, required: true },
    refParentPer: { type: Number, required: true },
    referrerPin: { type: String, required: true, unique: true },
    referrerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }
  },
  { timestamps: true }
);

const UserPending = mongoose.model('UserPending', userPendingSchema);

// ]-----------------------||Endpoint for user signup||------------------------[

app.post('/api/signup', async (req, res) => {
  const { fullName, username, email, password, phoneNumber, referrerPin } = req.body;

  try {
    // Check if referrerPin exists in UserPending
    const userPending = await UserPending.findOne({ referrerPin });
    if (!userPending) {
      return res.status(400).json({ success: false, message: 'Invalid referrer PIN' });
    }

    // Check if the email or username already exists in the User model
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email or username already taken' });
    }

    // Create a new user based on the form data and UserPending document
    const newUser = new User({
      fullName,
      username,
      email,
      password,
      phoneNumber,
      plan: userPending.planName,
      rank: '',
      refPer: userPending.refPer,
      refParentPer: userPending.refParentPer,
      parent: userPending.referrerId,
      advancePoints: userPending.advancePoints,
      // Initialize other fields as needed
      balance: 0,
      totalPoints: 0,
      directPoints: 0,
      indirectPoints: 0,
      trainingBonusBalance: 0
    });

    // Save the new user to the database
    await newUser.save();
    await UserPending.findByIdAndRemove(userPending.id);

    // Respond with success
    res.status(201).json({ success: true, message: 'User registered successfully!' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
});

// ]----------------------------||Get Total Balance||-----------------------------[

app.get('/api/user/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username }).exec();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      phone: user.phoneNumber,
      balance: user.balance,
      totalPoints: user.totalPoints,
      advancePoints: user.advancePoints,
      trainingBonusBalance: user.trainingBonusBalance
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});
// Endpoint to get the count of direct referrals
app.get('/api/referrals', async (req, res) => {
  const { username } = req.query;

  try {
    // Find the main user by username
    const mainUser = await User.findOne({ username });

    if (!mainUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Count the number of users who have the main user's _id as their parent
    const directReferralsCount = await User.countDocuments({ parent: mainUser._id });
    const directReferral = await User.findOne({ parent: mainUser._id });
    const IndirectReferralsCount = await User.countDocuments({ parent: directReferral._id });

    return res.json({ DirectCount: directReferralsCount, IndirectCount: IndirectReferralsCount });
  } catch (error) {
    console.error('Error counting direct referrals:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ----------------------||Api to handle Password change||----------------------
app.put('/api/change-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user || user.password !== currentPassword) {
      return res.status(401).json({ message: 'Invalid current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});


// ----------------------||Notification||----------------------



const notificationSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['alert', 'message'], default: 'message' },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['read', 'unread'], default: 'unread' }
});

const Notification = mongoose.model('Notification', notificationSchema);


// API Endpoints
app.get('/api/notifications/:username', async (req, res) => {
  try {
    const notifications = await Notification.find({ userName: req.params.username });
    if (!notifications || notifications.length === 0) {
      return res.status(404).json({ message: 'No notifications found for this user' });
    }
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

// Create a new notification
app.post('/api/notifications', async (req, res) => {
  const { userName, message, type } = req.body;

  try {
    const newNotification = new Notification({ userName, message, type });
    await newNotification.save();
    res.status(201).json(newNotification);
  } catch (error) {
    res.status(500).json({ message: 'Error creating notification', error: error.message });
  }
});

// Update a notification's status
app.put('/api/notifications/:id', async (req, res) => {
  const { status } = req.body;

  try {
    const updatedNotification = await Notification.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!updatedNotification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(updatedNotification);
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification status', error: error.message });
  }
});



//------------------------||WithdrawalRequest Schema (Client Side)||--------------------------

const withdrawalRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    accountNumber: {
      type: String,
      required: true
    },
    accountTitle: {
      type: String,
      required: true
    },
    gateway: {
      type: String,
      required: true
    },
    remarks: {
      type: String,
      default: null // This field is for admin remarks, especially in case of rejection
    }
  },
  { timestamps: true }
);

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);

// Submit a withdrawal request (User Side - No remarks, status is 'pending')
// Submit a withdrawal request (User Side - No balance deduction, status is 'pending')
app.post('/api/withdraw-balance', async (req, res) => {
  const { username, withdrawAmount, gateway, accountNumber, accountTitle } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create and save new withdrawal request (No balance deduction here)
    const newWithdrawalRequest = new WithdrawalRequest({
      userId: user._id,
      amount: withdrawAmount,
      accountNumber,
      accountTitle,
      gateway
    });
    await newWithdrawalRequest.save();

    res.status(200).json({ message: 'Withdrawal request submitted successfully.', requestId: newWithdrawalRequest._id });
  } catch (error) {
    console.error('Error processing withdrawal request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch withdrawal requests (Transactions) for the user
app.get('/api/withdrawals/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch all withdrawal requests (acts as transactions)
    const withdrawalRequests = await WithdrawalRequest.find({ userId: user._id }).sort({ createdAt: -1 });

    res.json(withdrawalRequests); // Return the request with status and remarks (if any)
  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/api/users/product-profit-history/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.productProfitHistory);
  } catch (error) {
    console.error('Error fetching product profit history:', error);
    res.status(500).json({ message: 'Failed to fetch product profit history' });
  }
});



// Get Parent User Name
app.get('/api/user/:userId/parent', async (req, res) => {
  try {
    // Find the user based on the provided username
    const user = await User.findOne({ username: req.params.userId });
    
    // Check if the user exists
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Check if the user has a parent ID
    if (!user.parent) {
      return res.status(404).send('No parent found for this user');
    }

    // Fetch the parent user details using the parent ID
    const parent = await User.findById(user.parent).select('fullName username');

    // Check if the parent exists
    if (!parent) {
      return res.status(404).send('Parent user not found');
    }

    // Return the parent's details
    res.send({ parent });
    
  } catch (err) {
    res.status(500).send(err);
  }
});

// Multer storage configuration for profile pictures
const profilePictureStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/profile-pictures')); // Ensure correct path
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + Date.now() + ext); // Use a unique name for the profile picture
  }
});

// Create the multer instance
const profileUpload = multer({ storage: profilePictureStorage });


// Your route for uploading profile pictures
app.post('/api/user/:username/profile-picture', profileUpload.single('profilePicture'), (req, res) => {
  const filePath = `uploads/profile-pictures/${req.file.filename}`; // Save as a relative path

  // Save the file path in the user document in the database
  User.findOneAndUpdate({ username: req.params.username }, { profilePicture: filePath }, { new: true })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ user });
    })
    .catch(err => {
      console.error('Error saving profile picture:', err);
      res.status(500).json({ message: 'Error saving profile picture' });
    });
});


// Route to update user information including the profile picture
app.put('/api/user/:username', profileUpload.single('profilePicture'), async (req, res) => {
  const { username } = req.params;
  const { fullName, email, phone } = req.body;

  try {
    const updates = { fullName, email, phone };

    if (req.file) {
      updates.profilePicture = `uploads/profile-pictures/${req.file.filename}`; // Save as relative path
    }

    const user = await User.findOneAndUpdate({ username }, updates, { new: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      console.error('Multer Error:', error);
      return res.status(400).json({ message: error.message });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});
