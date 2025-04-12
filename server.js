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

// User Model
const userSchema = new mongoose.Schema(
{
  fullName: { type: String, required: true, trim: true },
  username: { type: String, required: true,  unique: true },
  password: { type: String, required: true , unique: true },
  email: { type: String, required: true},
  phoneNumber: { type: String, required: true },
  accountType: { type: String, required: true,  default: 'none' }, // e.g., "Starter", "Pro", "Premium"
  balance: { type: Number, default: 0 },
  withdrawalBalance: { type: Number, default: 0 },
  dailyTaskLimit: { type: Number, required: true , default: 0},
  lastCompletedDate: { type: Date, default: null },
  tasksCompletedToday: { type: Number, default: 0 },
  bonusBalance: { type: Number, default: 0 },
  referralDetails: {
    referralCode: { type: String },
    referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
  },
  taskHistory: [
    {
      taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
      completedAt: { type: Date },
      reward: { type: Number },
    },
  ],
  transactionHistory: [
    {
      type: { type: String, required: true }, // "credit" or "debit"
      amount: { type: Number, required: true },
      description: { type: String, trim: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  commissionPendingTasks: [
    {
      taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
      commissionAmount: { type: Number, required: true },
      releaseDate: { type: Date, required: true },
    },
  ],
  planActivationDate: { type: Date, default: null },
  profilePicture: { type: String, default: null },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  pendingCommission: { type: Number, default: 0 },
  lastSalaryClaimDate: { type: Date, default: null }, // Added field
},
{ timestamps: true }
);

const User = mongoose.model('User', userSchema);  // Define User model

// Admin Schema
const adminSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  totalProfit: { type: Number, default: 0 },
  monthlyProfit: { type: Number, default: 0 },
  transactions: [{
    amount: { type: Number, required: true },
    type: { type: String, required: true }, // e.g., "Withdrawal", "Deposit"
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);



// POST route to create an admin
app.post('/api/admins', async (req, res) => {
const { fullName, username, password } = req.body;

try {
  // Check if the username already exists
  const existingAdmin = await Admin.findOne({ username });
  if (existingAdmin) {
    return res.status(400).json({ success: false, message: 'Username already exists. Please choose a different username.' });
  }

  // Create a new admin
  const newAdmin = new Admin({
    fullName,
    username,
    password, // Ensure you hash the password before saving in production
  });

  // Save to the database
  await newAdmin.save();

  res.status(201).json({ success: true, message: 'Admin created successfully', admin: newAdmin });
} catch (error) {
  console.error(error);
  res.status(500).json({ success: false, message: 'Server error' });
}
});
// Get full name by username
app.get('/api/users/fullname/:username', async (req, res) => {
try {
  const user = await Admin.findOne({ username: req.params.username });
  if (!user) {
    return res.status(404).send('User not found');
  }
  res.send({ fullName: user.fullName });
} catch (err) {
  res.status(500).send(err);
}
});

// POST Route to Add a New User
app.post('/users', async (req, res) => {
try {
  const {
    fullName,
    username,
    password,
    email,
    phoneNumber,
    accountType,
    balance,
    withdrawalBalance,
    dailyTaskLimit,
    lastCompletedDate,
    tasksCompletedToday,
    bonusBalance,
    referralDetails,
    taskHistory,
    transactionHistory,
    commissionPendingTasks,
    planActivationDate,
    profilePicture,
    parent,
    pendingCommission,
  } = req.body;

  // Create a new user instance
  const newUser = new User({
    fullName,
    username,
    password,
    email,
    phoneNumber,
    accountType,
    balance,
    withdrawalBalance,
    dailyTaskLimit,
    lastCompletedDate,
    tasksCompletedToday,
    bonusBalance,
    referralDetails,
    taskHistory,
    transactionHistory,
    commissionPendingTasks,
    planActivationDate,
    profilePicture,
    parent,
    pendingCommission,
  });

  // Save the user to the database
  const savedUser = await newUser.save();
  res.status(201).json({ message: 'User created successfully', user: savedUser });
} catch (error) {
  res.status(400).json({ message: 'Error creating user', error: error.message });
}
});

// Authentication Endpoint
app.post('/api/authenticate', async (req, res) => {
const { usernameOrEmail, password } = req.body;

try {
  const user = await Admin.findOne({
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
// Define schemas and models
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

// Serve static files from the VPS 'uploads' directory during local development
app.use('/uploads', (req, res) => {
const vpsUrl = `http://localhost:8001/uploads${req.url}`;
res.redirect(vpsUrl);
});

// Fetch all pending approval requests
app.get('/api/approvals/pending-approvals', async (req, res) => {
try {
  const approvals = await TrainingBonusApproval.find({ status: 'pending' });
  res.json(approvals);
} catch (error) {
  console.error('Error fetching pending approvals:', error);
  res.status(500).send('Server error');
}
});

app.post('/api/approvals/approve', async (req, res) => {
const { id } = req.body;

try {
  const approval = await TrainingBonusApproval.findById(id);
  if (!approval) {
    return res.status(404).send('Approval request not found');
  }

  // Fetch the user (replace User with your actual User model)
  const user = await User.findOne({ username: approval.username });
  if (!user) {
    return res.status(404).send('User not found');
  }

  // Update user's balance, training bonus balance, and total points
  const bonusAmount = approval.transactionAmount * 0.5;
  const trainingBonusPoints = parseInt(process.env.TRAINING_BONUS_POINTS);
  user.balance += bonusAmount;
  user.trainingBonusBalance += bonusAmount;
  user.totalPoints += trainingBonusPoints;
  await user.save();

  // Create a new approved record
  const approvedRecord = new TrainingBonusApproved({
    username: approval.username,
    transactionId: approval.transactionId,
    transactionAmount: approval.transactionAmount,
    gateway: approval.gateway,
    addedPoints: process.env.TRAINING_BONUS_POINTS,
    imagePath: approval.imagePath, // Ensure image path is correct for frontend display
    approvedAt: new Date()
  });
  await approvedRecord.save();

  // Remove the approval request
  await TrainingBonusApproval.findByIdAndRemove(id);

  res.send('Request approved successfully');
} catch (error) {
  console.error('Error approving request:', error);
  res.status(500).send('Server error: ' + error.message); // Send detailed error message
}
});

//---------------||Rejected Training Bonus Schema||---------------------
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

// ]--------------------||EndPoint to Handle Training Bonus Rejection||---------------------------[

app.post('/api/approvals/reject', async (req, res) => {
const { id, feedback } = req.body;

try {
  const approval = await TrainingBonusApproval.findById(id);
  if (!approval) {
    return res.status(404).send('Approval request not found');
  }

  // Create a new rejected record
  const rejectedRecord = new TrainingBonusRejected({
    username: approval.username,
    transactionId: approval.transactionId,
    transactionAmount: approval.transactionAmount,
    gateway: approval.gateway,
    imagePath: approval.imagePath,
    feedback: feedback
  });
  await rejectedRecord.save();

  // Remove the approval request
  await TrainingBonusApproval.findByIdAndRemove(id);

  res.send('Request rejected successfully');
} catch (error) {
  console.error('Error rejecting request:', error);
  res.status(500).send('Server error: ' + error.message);
}
});



//       ]------------------------||Investment Plans Model||----------------------------[

const planSchema = new mongoose.Schema({
name: { type: String, required: true },
price: { type: Number, required: true },
DailyTaskLimit:{ type: Number, required: true },
DirectBonus: { type: Number, required: true },
IndirectBonus: { type: Number, required: true },

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

// Add a new plan

// Add a new plan
app.post('/api/plans', async (req, res) => {
const { name, price, DailyTaskLimit, DirectBonus, IndirectBonus} = req.body;

const newPlan = new Plan({ name, price, DailyTaskLimit, DirectBonus, IndirectBonus });

try {
  const savedPlan = await newPlan.save();
  res.status(201).json(savedPlan);
} catch (err) {
  res.status(400).json({ message: err.message });
}
});
// Delete a plan
app.delete('/api/plans/:id', async (req, res) => {
try {
  const deletedPlan = await Plan.findByIdAndDelete(req.params.id);
  if (!deletedPlan) return res.status(404).json({ message: 'Plan not found' });
  res.json({ message: 'Plan deleted successfully' });
} catch (err) {
  res.status(500).json({ message: err.message });
}
});


// ]-------------------||Get Profile Data by username from User Model||-------------------------[

// ]----------------||Implementation of approving Referrals||------------------[

// Define schema for ReferralPaymentVerification
const referralPaymentSchema = new mongoose.Schema({
username: { type: String, required: true },
transactionId: { type: String, required: true },
transactionAmount: { type: Number, required: true },
gateway: { type: String, required: true },
planName: { type: String, required: true },
planPrice: { type: Number, required: true }, // Price of the plan
directBonus: { type: Number, required: true }, // Direct bonus points
indirectBonus: { type: Number, required: true }, // Indirect bonus points
DailyTaskLimit: { type: Number, required: true },
imagePath: { type: String, required: true },
status: { type: String, default: 'pending' }
}, { timestamps: true });

const ReferralPaymentVerification = mongoose.model('ReferralPaymentVerification', referralPaymentSchema);
const ReferralApproveds = mongoose.model('ReferralApproveds', referralPaymentSchema);


// Fetch all pending referral payment verification requests
app.get('/api/approvals/referral/pending-approvals', async (req, res) => {
try {
  // Fetch pending referrals from ReferralPaymentVerification collection
  const pendingApprovals = await ReferralPaymentVerification.find({ status: 'pending' });

  if (!pendingApprovals || pendingApprovals.length === 0) {
    return res.status(404).json({ message: 'No pending approvals found.' });
  }

  res.json(pendingApprovals); // Return the list of pending approvals
} catch (err) {
  console.error('Error fetching pending approvals:', err);
  res.status(500).send('Server error');
}
});

app.post('/api/approvals/referral/approve', async (req, res) => {
const { transactionId } = req.body;

if (!transactionId) {
  return res.status(400).json({ message: 'Transaction ID is required.' });
}

try {
  const referralPayment = await ReferralPaymentVerification.findOne({ transactionId, status: 'pending' });
  if (!referralPayment) {
    return res.status(404).json({ message: 'Referral payment not found or already processed.' });
  }

  const user = await User.findOne({ username: referralPayment.username });
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  // Update daily task limit only if the new value is greater than the existing one
  if (referralPayment.DailyTaskLimit > user.dailyTaskLimit) {
    user.dailyTaskLimit += referralPayment.DailyTaskLimit;
  }


  // Set plan activation date to the current date
  user.planActivationDate = new Date();


  const { directBonus, indirectBonus, transactionAmount } = referralPayment;
  let totalBonusDistributed = 0;

  // Check and distribute direct bonus
  if (user.referralDetails?.referrer) {
    const referrer = await User.findById(user.referralDetails.referrer);
    if (referrer && referrer.dailyTaskLimit > 0) {
      referrer.balance += directBonus;
      referrer.bonusBalance += directBonus;
      referrer.transactionHistory.push({
        type: 'credit',
        amount: directBonus,
        description: `Direct bonus from ${user.username}`,
      });
      await referrer.save();
      totalBonusDistributed += directBonus;
    } else {
      console.log(`Referrer has no daily task limit or does not exist for user: ${user.username}`);
    }
  }

  // Check and distribute indirect bonus
  if (user.referralDetails?.referrer) {
    const referrer = await User.findById(user.referralDetails.referrer);
    if (referrer?.referralDetails?.referrer) {
      const indirectReferrer = await User.findById(referrer.referralDetails.referrer);
      if (indirectReferrer && indirectReferrer.dailyTaskLimit > 0) {
        indirectReferrer.balance += indirectBonus;
        indirectReferrer.bonusBalance += indirectBonus;
        indirectReferrer.transactionHistory.push({
          type: 'credit',
          amount: indirectBonus,
          description: `Indirect bonus from ${user.username}`,
        });
        await indirectReferrer.save();
        totalBonusDistributed += indirectBonus;
      } else {
        console.log(`Indirect referrer has no daily task limit or does not exist for referrer: ${referrer.username}`);
      }
    } else {
      console.log(`Referrer does not have an indirect referrer for user: ${user.username}`);
    }
  }

  // Remaining amount goes to admin
  const admin = await Admin.findOne();
  if (admin) {
    const adminShare = transactionAmount - totalBonusDistributed;
    admin.totalProfit += adminShare;
    admin.monthlyProfit += adminShare;
    admin.transactions.push({
      amount: adminShare,
      type: 'Deposit',
      date: new Date(),
    });
    await admin.save();
  }

  // Approve the referral payment
  referralPayment.status = 'approved';
  const approvedPayment = new ReferralApproveds(referralPayment.toObject());
  await approvedPayment.save();

  await ReferralPaymentVerification.deleteOne({ _id: referralPayment._id });

  await user.save();

  // Send email to the user
  const mailOptions = {
    from: `Devix.Team <${process.env.SMTP_EMAIL}>`,
    to: user.email, // User's email
    subject: 'Referral Payment Approved',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #4CAF50; text-align: center;">Congratulations, ${user.username}!</h2>
        <p>We are excited to inform you that your referral payment has been approved. Here are the details:</p>
        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: #f9f9f9;">
          <p><strong>Transaction Amount:</strong> ${transactionAmount}</p>
          <p><strong>Daily Task Limit Updated To:</strong> ${user.dailyTaskLimit}</p>
        </div>
        <p>Bonuses have been distributed to your referrer(s) where applicable. Thank you for contributing to our community.</p>
        <h3 style="color: #4CAF50;">Keep Growing</h3>
        <p>Continue sharing and growing your network. Click the button below to log in to your account and explore more opportunities:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="https://account.Devix.com/pages/login/login3" 
             style="text-decoration: none; padding: 10px 20px; color: white; background-color: #4CAF50; border-radius: 5px; font-weight: bold;">Log In to Your Account</a>
        </div>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Thank you for being a valued member of our community!</p>
        <p style="margin-top: 20px;">Warm regards,<br><strong>The Team at Devix</strong></p>
      </div>
    `,
  };
  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Email sent successfully:', info.response);
    }
  });
  
  res.json({ message: 'Referral payment approved, bonuses distributed, and email sent successfully.' });
} catch (err) {
  console.error('Error approving referral payment:', err);
  res.status(500).json({ message: 'Internal server error', error: err.message });
}
});


// ---------------||Define schema for ReferralRejected||-----------------------


// Referral Rejected Schema (unchanged)
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

// Reject a referral payment request
app.post('/api/approvals/referral/reject', async (req, res) => {
const { transactionId, reason } = req.body;

if (!transactionId || !reason) {
  return res.status(400).json({ message: 'Transaction ID and rejection reason are required.' });
}

try {
  // Find the referral payment in the pending collection
  const referralPayment = await ReferralPaymentVerification.findOne({ transactionId, status: 'pending' });
  if (!referralPayment) {
    return res.status(404).json({ message: 'Referral payment not found or already processed.' });
  }

  // Fetch the user associated with the referral payment
  const user = await User.findOne({ username: referralPayment.username });
  if (!user) {
    return res.status(404).json({ message: 'User associated with this referral payment not found.' });
  }

  // Change the status to rejected and move the record to the ReferralRejected collection
  referralPayment.status = 'rejected'; // Update the status to rejected
  const rejectedPayment = new ReferralRejected({
    ...referralPayment.toObject(), // Clone the document data
    reason, // Add the rejection reason
  });

  await rejectedPayment.save(); // Save to the rejected collection
  await ReferralPaymentVerification.deleteOne({ _id: referralPayment._id }); // Remove from the pending collection

  // Send email to the user about the rejection
  await transporter.sendMail({
    from: `Devix Team <${process.env.SMTP_EMAIL}>`,
    to: user.email, // Use email from the User schema
    subject: 'Referral Payment Request Rejected',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #ff0000; text-align: center;">Referral Payment Request Rejected</h2>
        <p>Dear ${user.fullName},</p>
        <p>We regret to inform you that your referral payment request with transaction ID <strong>${transactionId}</strong> has been rejected. Below are the details:</p>
        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: #f9f9f9;">
          <p><strong>Reason for Rejection:</strong> ${reason}</p>
          <p><strong>Amount:</strong> ${referralPayment.amount}</p>
        </div>
        <p>If you have any questions or need further assistance, please reach out to our support team.</p>
        <p style="margin-top: 20px;">Warm regards,<br><strong>The Devix Team</strong></p>
      </div>
    `,
  });

  res.json({ message: 'Referral payment rejected successfully and email sent to the user.' });
} catch (err) {
  console.error('Error rejecting referral payment:', err);
  res.status(500).json({ message: 'Server error', error: err.message });
}
});


// Define the WithdrawalRequest model
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
    default: null // For admin remarks in case of rejection
  }
},
{ timestamps: true }
);

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);



const systemSettingsSchema = new mongoose.Schema({
withdrawalEnabled: {
  type: Boolean,
  default: true, // Default to withdrawals being enabled
},
});
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);


// Get current withdrawal status
app.get('/api/settings/withdrawal-status', async (req, res) => {
try {
  const settings = await SystemSettings.findOne();
  if (!settings) {
    return res.status(404).json({ message: 'Settings not found' });
  }
  res.status(200).json({ withdrawalEnabled: settings.withdrawalEnabled });
} catch (error) {
  res.status(500).json({ message: 'Error fetching withdrawal status', error });
}
});


// Update withdrawal status
app.post('/api/settings/withdrawal-status', async (req, res) => {
try {
  const { withdrawalEnabled } = req.body;
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = new SystemSettings({ withdrawalEnabled });
  } else {
    settings.withdrawalEnabled = withdrawalEnabled;
  }
  await settings.save();
  res.status(200).json({ message: 'Withdrawal status updated successfully', withdrawalEnabled });
} catch (error) {
  res.status(500).json({ message: 'Error updating withdrawal status', error });
}
});


// Fetch all withdrawal requests (Admin Side)
app.get('/api/withdrawals', async (req, res) => {
try {
  // Fetch all withdrawal requests
  const withdrawalRequests = await WithdrawalRequest.find().populate('userId', 'username').sort({ createdAt: -1 });

  res.json(withdrawalRequests); // Return all requests with their status and remarks s(if any)
} catch (error) {
  console.error('Error fetching withdrawal requests:', error);
  res.status(500).json({ message: 'Internal server error' });
}
});

// Approve a withdrawal request
app.post('/api/withdrawals/approve', async (req, res) => {
const { id } = req.body;

try {
  const withdrawal = await WithdrawalRequest.findById(id);
  if (!withdrawal) {
    return res.status(404).json({ message: 'Withdrawal request not found' });
  }

  // Find the user associated with the request
  const user = await User.findById(withdrawal.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Find the admin responsible for managing profits
  const admin = await Admin.findOne(); // Assuming there's one admin record
  if (!admin) {
    return res.status(500).json({ message: 'Admin record not found' });
  }

  // Check if the user has sufficient balance (extra safety check)
  if (user.balance < withdrawal.amount) {
    return res.status(400).json({ message: 'Insufficient balance for approval.' });
  }

  // Deduct the balance from the user
  user.balance -= withdrawal.amount;
  await user.save();

  // Deduct the withdrawal amount from admin profits
  admin.totalProfit -= withdrawal.amount;
  admin.monthlyProfit -= withdrawal.amount;

  // Add the transaction to admin's transaction history
  admin.transactions.push({
    amount: withdrawal.amount,
    type: 'Withdrawal',
    date: new Date(),
  });

  await admin.save();

  // Update withdrawal status to 'approved'
  withdrawal.status = 'approved';
  await withdrawal.save();

  // Send Email Notification to User
  await transporter.sendMail({
    from: `Devix.Team <${process.env.SMTP_EMAIL}>`,
    to: user.email,
    subject: 'Your Withdrawal Request is Approved',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #4CAF50; text-align: center;">Withdrawal Approved</h2>
        <p>Dear ${user.fullName},</p>
        <p>We are pleased to inform you that your withdrawal request has been approved. The amount has been processed and sent to your provided account details:</p>
        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: #f9f9f9;">
          <p><strong>Withdrawal Amount:</strong> ${withdrawal.amount}</p>
          <p><strong>Account Number:</strong> ${withdrawal.accountNumber}</p>
          <p><strong>Account Title:</strong> ${withdrawal.accountTitle}</p>
          <p><strong>Gateway:</strong> ${withdrawal.gateway}</p>
        </div>
        <p>Please check your account for the credited amount. If you encounter any issues, feel free to contact our support team.</p>
        <h3 style="color: #4CAF50;">Need Help?</h3>
        <p>Our support team is here to assist you. Reach out to us via email or our support page for any questions.</p>
        <p>Thank you for choosing Devix!</p>
        <p style="margin-top: 20px;">Warm regards,<br><strong>The Devix Team</strong></p>
      </div>
    `,
  });

  res.json({ message: 'Withdrawal approved successfully, balance deducted, admin profit updated, and email sent.' });
} catch (error) {
  console.error('Error approving withdrawal:', error);
  res.status(500).json({ message: 'Failed to approve withdrawal' });
}
});

// Reject a withdrawal request with feedback (No balance refund, just rejection)
app.post('/api/withdrawals/reject', async (req, res) => {
const { id, feedback } = req.body;

try {
  const withdrawal = await WithdrawalRequest.findById(id);
  if (!withdrawal) {
    return res.status(404).json({ message: 'Withdrawal request not found' });
  }

  // Find the user associated with the request
  const user = await User.findById(withdrawal.userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Update status to 'rejected' and save remarks
  withdrawal.status = 'rejected';
  withdrawal.remarks = feedback;
  await withdrawal.save();

  // Send Email Notification to User
  await transporter.sendMail({
    from: `Devix.Team <${process.env.SMTP_EMAIL}>`,
    to: user.email,
    subject: 'Your Withdrawal Request Has Been Rejected',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #E53935; text-align: center;">Withdrawal Request Rejected</h2>
        <p>Dear ${user.fullName},</p>
        <p>We regret to inform you that your withdrawal request has been rejected. Below are the details of your request:</p>
        <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: #f9f9f9;">
          <p><strong>Withdrawal Amount:</strong> ${withdrawal.amount}</p>
          <p><strong>Account Number:</strong> ${withdrawal.accountNumber}</p>
          <p><strong>Account Title:</strong> ${withdrawal.accountTitle}</p>
          <p><strong>Gateway:</strong> ${withdrawal.gateway}</p>
           <h3 style="color: #E53935;">Reason for Rejection:</h3>
        <p style="font-weight: bold; color: #333; background-color: #FFEBEE; padding: 10px; border-radius: 5px;">${feedback}</p>
        </div>
         <p>We encourage you to review the feedback and make necessary adjustments before submitting a new withdrawal request.</p>
        <h3 style="color: #E53935;">Need Help?</h3>
        <p>If you have any questions or require assistance, please contact our support team. We are here to help you.</p>
        <p>Thank you for your understanding.</p>
        <p style="margin-top: 20px;">Warm regards,<br><strong>The Devix Team</strong></p>
      </div>
    `,
  });

  res.json({ message: 'Withdrawal rejected successfully, and email sent with feedback.' });
} catch (error) {
  console.error('Error rejecting withdrawal:', error);
  res.status(500).json({ message: 'Failed to reject withdrawal' });
}
});

// Fetch all training bonuses
app.get('/api/training-bonus', async (req, res) => {
try {
  const bonuses = await TrainingBonusApproval.find().sort({ createdAt: -1 });
  res.json(bonuses);
} catch (error) {
  console.error('Error fetching training bonuses:', error);
  res.status(500).json({ message: 'Internal server error' });
}
});

// Fetch all approved training bonuses
app.get('/api/approvals/approve', async (req, res) => {
try {
  const approvedBonuses = await TrainingBonusApproved.find().sort({ createdAt: -1 });
  res.json(approvedBonuses);
} catch (error) {
  console.error('Error fetching approved training bonuses:', error);
  res.status(500).json({ message: 'Internal server error' });
}
});

// Fetch all rejected training bonuses
app.get('/api/approvals/reject', async (req, res) => {
try {
  const rejectedBonuses = await TrainingBonusRejected.find().sort({ createdAt: -1 });
  res.json(rejectedBonuses);
} catch (error) {
  console.error('Error fetching rejected training bonuses:', error);
  res.status(500).json({ message: 'Internal server error' });
}
});

// Fetch all approved referral payments
app.get('/api/approvals/referral/approve', async (req, res) => {
console.log('Fetching all approved referral payments...'); // Add logging
try {
  const approvals = await ReferralApproveds.find();
  console.log('Approved referrals fetched:', approvals); // Log the fetched data
  res.json(approvals);
} catch (error) {
  console.error('Error fetching approvals:', error.message); // Log the error message
  res.status(500).send('Server error: ' + error.message);
}
});



// Fetch all rejected referral payments
app.get('/api/approvals/referral/reject', async (req, res) => {
try {
  const rejectedApprovals = await ReferralRejected.find();
  res.json(rejectedApprovals);
} catch (error) {
  console.error('Error fetching rejected approvals:', error);
  res.status(500).send('Server error');
}
});

// Fetch user by username (to validate existence)
app.get('/api/users/:username', async (req, res) => {
const { username } = req.params;

try {
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  res.json(user);
} catch (error) {
  console.error('Error fetching user:', error);
  res.status(500).json({ message: 'Internal server error' });
}
});
app.post('/api/users/update-product-profit-balance', async (req, res) => {
const { username, amount, directPointsIncrement, totalPointsIncrement } = req.body;

try {
  // Parse amount to ensure it's a valid number
  const parsedAmount = Number(amount);
  if (isNaN(parsedAmount)) {
    return res.status(400).json({ message: 'Invalid amount provided' });
  }

  // Find the user by username
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Update user's product profit balance, total balance, and points
  user.productprofitBalance += parsedAmount;
  user.balance += parsedAmount;
  user.totalPoints += totalPointsIncrement;
  user.directPoints += totalPointsIncrement;

  // Add the updated product profit history
  user.productProfitHistory.push({
    amount: parsedAmount,
    directPointsIncrement,
    totalPointsIncrement,
  });

  // If the user has a parent, update the parent's indirect points
  if (user.parent) {
    const parent = await User.findById(user.parent);
    if (parent) {
      parent.indirectPoints += directPointsIncrement; // Update parent's indirect points
      parent.totalPoints += totalPointsIncrement;     // Also increment total points for parent

      // Save the parent
      await parent.save();
    } else {
      console.warn(`Parent not found for user ${user.username}`);
    }
  }

  // Save the user after all updates
  await user.save();

  // Return success response
  res.json({
    message: "Product profit balance updated successfully",
    newBalance: user.productprofitBalance,
    totalBalance: user.balance,
    username: user.fullName,
    directPoints: user.directPoints,
    totalPoints: user.totalPoints,
  });

} catch (error) {
  console.error('Error updating product profit balance:', error);
  res.status(500).json({ message: 'Failed to update product profit balance' });
}
});
app.get('/api/users-activated', async (req, res) => {
try {
  // Fetch users with dailyTaskLimit >= 2
  const users = await User.find({ dailyTaskLimit: { $gte: 2 } });
 
  // Check if no users are found
  if (users.length === 0) {
    return res.status(404).json({ message: 'No users found with dailyTaskLimit >= 2' });
  }

  // Calculate the total number of users
  const totalUsers = users.length;

  // Send response with users and total count
  res.status(200).json({
    totalUsers,
    users
  });
} catch (error) {
  console.error('Error fetching users:', error);
  res.status(500).json({ error: 'Server error. Could not fetch users.' });
}
});



app.get('/api/users', async (req, res) => {
try {
  // Set headers to allow streaming
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Transfer-Encoding', 'chunked');

  // Start the JSON array
  res.write('[');

  let firstRecord = true;

  // Use a Mongoose cursor to stream users
  const cursor = User.find().cursor();

  // Use for await...of to iterate through the cursor
  for await (const user of cursor) {
    if (!firstRecord) {
      res.write(','); // Add a comma between JSON objects
    }
    res.write(JSON.stringify(user));
    firstRecord = false;
  }

  // Close the JSON array
  res.write(']');
  res.end();
} catch (error) {
  console.error('Error fetching users:', error);
  res.status(500).json({ error: 'Server error. Could not fetch users.' });
}
});


// POST endpoint to add a new user
app.post('/api/users', async (req, res) => {
const {
  fullName,
  username,
  password, // Keep this field but store as plain text (not recommended)
  email,
  phoneNumber,
  plan,
  rank,
  refPer,
  refParentPer,
  advancePoints,
  balance,
  directPoints,
  indirectPoints,
  trainingBonusBalance,
  productprofitBalance,
  productProfitHistory,
  parent // Assuming you want to store the parent reference as well
} = req.body;

try {
  // Create a new user instance
  const newUser = new User({
    fullName,
    username,
    password, // Directly store the plain text password
    email,
    phoneNumber,
    plan,
    rank,
    refPer,
    refParentPer,
    advancePoints,
    balance,
    directPoints,
    indirectPoints,
    trainingBonusBalance,
    productprofitBalance,
    productProfitHistory,
    parent // Add parent reference if needed
  });

  // Save the user to the database
  await newUser.save();

  res.status(201).json({ message: 'User created successfully', user: newUser });
} catch (error) {
  console.error('Error creating user:', error);
  res.status(400).json({ error: error.message });
}
});



// DELETE endpoint to delete a user by ID
app.delete('/api/users/:id', async (req, res) => {
try {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) {
    return res.status(404).json({ msg: 'User not found' });
  }
  res.json({ msg: 'User deleted' });
} catch (error) {
  console.error('Error deleting user:', error);
  res.status(500).send('Server error');
}
});


app.put('/api/users/:id', async (req, res) => {
try {
  const allowedFields = [
    'fullName',
    'username',
    
    'email',
    'phoneNumber',
    'accountType',
    'balance',
    'withdrawalBalance',
    'bonusBalance',
    'dailyTaskLimit',
    'pendingCommission',
  ];

  // Filter the req.body to include only allowed fields
  const updateData = Object.keys(req.body).reduce((acc, key) => {
    if (allowedFields.includes(key)) {
      acc[key] = req.body[key];
    }
    return acc;
  }, {});

  const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
  res.status(200).json(updatedUser);
} catch (error) {
  console.error('Error updating user:', error);
  res.status(500).send('Error updating user');
}
});



app.post('/api/users/reset-points', async (req, res) => {
try {
  await User.updateMany({}, {
    $set: {
      totalPoints: 0,
      advancePoints: 0,
      directPoints: 0,
      indirectPoints: 0,
      trainingBonusBalance: 0,
      productProfitBalance: 0

    }
  });
  res.status(200).json({ message: 'Points reset successfully' });
} catch (error) {
  console.error('Error resetting points:', error);
  res.status(500).json({ message: 'Error resetting points' });
}
});




// Add a route to get the total user count
app.get('/users/total', async (req, res) => {
try {
  const totalUsers = await User.countDocuments(); // Counts all documents in the User collection
  res.status(200).json({ totalUsers });
} catch (error) {
  console.error('Error fetching total users:', error);
  res.status(500).json({ message: 'Internal Server Error' });
}
});


// Get admin total profit
app.post('/api/admin/profit/:username', async (req, res) => {
const { username } = req.params;
try {
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(404).send('Admin not found');
  
  res.json({ totalProfit: admin.totalProfit });
} catch (error) {
  res.status(500).send('Server error');
}
});

// Add transaction
app.post('/api/admin/transaction/:username', async (req, res) => {
const { username } = req.params;
const { amount, type } = req.body; // Expecting amount and type in the request body

try {
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(404).send('Admin not found');
  
  admin.transactions.push({ amount, type });
  admin.totalProfit += amount; // Adjust total profit
  await admin.save();

  res.status(201).send('Transaction added successfully');
} catch (error) {
  res.status(500).send('Server error');
}
});



// Add profit
app.post('/api/admin/add-profit/:username', async (req, res) => {
const { username } = req.params;
const { amount } = req.body;

try {
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(404).send('Admin not found');
  
  admin.totalProfit += amount;
  admin.monthlyProfit += amount; // Store in monthly profit
  admin.transactions.push({ amount, type: 'Deposit' });
  await admin.save();

  res.status(201).send('Profit added successfully');
} catch (error) {
  res.status(500).send('Server error');
}
});


// Withdraw profit
app.post('/api/admin/withdraw-profit/:username', async (req, res) => {
const { username } = req.params;
const { amount } = req.body;

try {
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(404).send('Admin not found');

  if (admin.totalProfit < amount) return res.status(400).send('Insufficient funds');

  admin.totalProfit -= amount;
  admin.transactions.push({ amount, type: 'Withdrawal' });
  await admin.save();

  res.status(201).send('Profit withdrawn successfully');
} catch (error) {
  res.status(500).send('Server error');
}
});

// Get transaction history
app.get('/api/admin/transactions/:username', async (req, res) => {
const { username } = req.params;

try {
  const admin = await Admin.findOne({ username });
  if (!admin) return res.status(404).send('Admin not found');

  res.json({ transactions: admin.transactions });
} catch (error) {
  res.status(500).send('Server error');
}
});

// Example endpoint code
app.post('/api/commission/this-month/:username', async (req, res) => {
const { username } = req.params;

try {
    // Fetch commissions for the current month for the specified username
    const commissions = await Commission.find({
        username,
        createdAt: {
            $gte: new Date(new Date().setDate(1)), // Start of the month
            $lt: new Date(new Date().setDate(1)).setMonth(new Date().getMonth() + 1) // Start of next month
        }
    });

    // Calculate total commission
    const totalCommission = commissions.reduce((acc, commission) => acc + commission.amount, 0);
    
    res.json({ commissionAmount: totalCommission });
} catch (error) {
    console.error('Error fetching commission:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
}
});
app.get('/api/admin/monthly-profit/:username', async (req, res) => {
const { username } = req.params;

try {
  // Fetch the admin document by username
  const admin = await Admin.findOne({ username });

  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' });
  }

  // Respond with the monthly profit
  res.json({ monthlyProfit: admin.monthlyProfit });
} catch (error) {
  console.error('Error fetching monthly profit:', error);
  res.status(500).json({ message: 'Server error', error: error.message });
}
});


// Endpoint to fetch product profit history for all users
// Endpoint to fetch product profit history for all users
app.get('/api/users/product-profit-history', async (req, res) => {
try {
  // Fetch all users and only return their username and productProfitHistory
  const users = await User.find({}, 'username productProfitHistory');

  if (!users || users.length === 0) {
    return res.status(404).json({ message: 'No users found' });
  }

  // Transform the data to a more usable format
  const productProfitHistories = users.map(user => ({
    username: user.username,
    productProfitHistory: user.productProfitHistory,
  }));

  res.json(productProfitHistories);
} catch (error) {
  console.error('Error fetching all users product profit history:', error);
  res.status(500).json({ message: 'Failed to fetch product profit history for all users' });
}
});


const notificationSchema = new mongoose.Schema({
message: {
  type: String,
  required: true,
},
type: {
  type: String,
  default: 'message', // Default type for notifications
},
status: {
  type: String,
  default: 'unread', // Default status for new notifications
},
timestamp: {
  type: Date,
  default: Date.now, // Automatically set to the current date/time
},
userName: {
  type: String,
  required: true, // User associated with the notification
},
}, {
versionKey: false, // Disable the version key (__v)
});

const Notification = mongoose.model('Notification', notificationSchema);
app.post('/api/notifications/:username', async (req, res) => {
const { username } = req.params;
const { message } = req.body;

try {
  const newNotification = new Notification({
    message,
    userName: username,
    type: 'message', // or any other type you want to set
    status: 'unread',
  });

  await newNotification.save();
  res.status(201).json(newNotification);
} catch (error) {
  console.error('Error creating notification:', error);
  res.status(500).json({ message: 'Failed to create notification' });
}
});
app.get('/api/notifications', async (req, res) => {
try {
  const notifications = await Notification.find(); // Fetch all notifications

  if (!notifications || notifications.length === 0) {
    return res.status(404).json({ message: 'No notifications found' });
  }

  // Format notifications to the required structure
  const formattedNotifications = notifications.map(notification => ({
    _id: notification._id,
    message: notification.message,
    type: notification.type,
    status: notification.status,
    timestamp: notification.timestamp.toISOString(), // Ensure timestamp is in ISO format
    userName: notification.userName,
  }));

  res.json(formattedNotifications);
} catch (error) {
  console.error('Error fetching notifications:', error);
  res.status(500).json({ message: 'Failed to fetch notifications' });
}
});

app.get('/api/notifications/:username', async (req, res) => {
const { username } = req.params;

try {
  const notifications = await Notification.find({ userName: username });
  
  if (!notifications || notifications.length === 0) {
    return res.status(404).json({ message: 'No notifications found for this user' });
  }

  // Format notifications to the required structure
  const formattedNotifications = notifications.map(notification => ({
    _id: notification._id,
    message: notification.message,
    type: notification.type,
    status: notification.status,
    timestamp: notification.timestamp.toISOString(), // Ensure timestamp is in ISO format
    userName: notification.userName,
  }));

  res.json(formattedNotifications);
} catch (error) {
  console.error('Error fetching notifications:', error);
  res.status(500).json({ message: 'Failed to fetch notifications' });
}
});
app.delete('/api/notifications/:id', async (req, res) => {
const { id } = req.params;

try {
  const deletedNotification = await Notification.findByIdAndDelete(id);
  
  if (!deletedNotification) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  res.status(200).json({ message: 'Notification deleted successfully' });
} catch (error) {
  console.error('Error deleting notification:', error);
  res.status(500).json({ message: 'Failed to delete notification' });
}
});





// Define Mongoose Schema for WhatsApp Contacts
const whatsappContactSchema = new mongoose.Schema({
whatsappNumber: { type: String, required: true, unique: true },
fullName: { type: String, required: true },
email: { type: String, required: true },
phoneNumber: { type: String, required: true },
}, { timestamps: true });

const WhatsappContact = mongoose.model('WhatsappContact', whatsappContactSchema);

// Routes for Admin to manage WhatsApp contacts

// Add a new WhatsApp contact
// Add a new WhatsApp contact
app.post('/api/admin/whatsapp/contact', async (req, res) => {
const { whatsappNumber, fullName, email, phoneNumber } = req.body;

if (!whatsappNumber || !fullName || !email || !phoneNumber) {
  return res.status(400).json({ message: 'All fields are required' });
}

try {
  // Check if the WhatsApp number already exists
  const existingContact = await WhatsappContact.findOne({ whatsappNumber });
  if (existingContact) {
    return res.status(400).json({ message: 'WhatsApp number already exists' });
  }

  // Create a new contact
  const newContact = new WhatsappContact({
    whatsappNumber,
    fullName,
    email,
    phoneNumber,
  });

  await newContact.save();
  res.status(201).json({ message: 'WhatsApp contact added successfully', contact: newContact });
} catch (err) {
  console.error('Error adding WhatsApp contact:', err);
  res.status(500).json({ message: 'Server error' });
}
});

// Get all WhatsApp contacts
// Get all WhatsApp contacts
app.get('/api/admin/whatsapp/contacts', async (req, res) => {
try {
  const contacts = await WhatsappContact.find();
  res.json({ contacts });
} catch (err) {
  console.error('Error fetching WhatsApp contacts:', err);
  res.status(500).json({ message: 'Server error' });
}
});


// Update a WhatsApp contact
app.put('/api/admin/whatsapp/contact/:contactId', async (req, res) => {
const { contactId } = req.params;
const { whatsappNumber, fullName, email, phoneNumber } = req.body;

// Input validation
if (!whatsappNumber || !fullName || !email || !phoneNumber) {
  return res.status(400).json({ message: 'All fields are required' });
}

try {
  const updatedContact = await WhatsappContact.findByIdAndUpdate(
    contactId,
    { whatsappNumber, fullName, email, phoneNumber },
    { new: true }
  );

  if (!updatedContact) {
    return res.status(404).json({ message: 'Contact not found' });
  }

  res.json({ message: 'WhatsApp contact updated successfully', contact: updatedContact });
} catch (err) {
  console.error('Error updating WhatsApp contact:', err);
  if (err.code === 11000) {
    return res.status(400).json({ message: 'WhatsApp number must be unique' });
  }
  res.status(500).json({ message: 'Server error' });
}
});

// Delete a WhatsApp contact
app.delete('/api/admin/whatsapp/contact/:contactId', async (req, res) => {
const { contactId } = req.params;

try {
  const deletedContact = await WhatsappContact.findByIdAndDelete(contactId);

  if (!deletedContact) {
    return res.status(404).json({ message: 'Contact not found' });
  }

  res.json({ message: 'WhatsApp contact deleted successfully' });
} catch (err) {
  console.error('Error deleting WhatsApp contact:', err);
  res.status(500).json({ message: 'Server error' });
}
});
const taskSchema = new mongoose.Schema(
{
  name: { type: String, required: true },
  description: { type: String, required: true },
  reward: { type: Number, required: true },
  image: { type: String }, // URL to the task image
  completedCount: { type: Number, default: 0 }, 
  redirectLink: { type: String, required: true }, // New field for redirection link
  createdAt: { type: Date, default: Date.now },
},
{ timestamps: true }
);

const TaskModel = mongoose.model('Task', taskSchema);
// Route to create a new task
app.post('/api/tasks', async (req, res) => {
const { name, description, reward, image, redirectLink } = req.body;

// Validate required fields
if (!name || !description || !reward || !redirectLink) {
  return res.status(400).json({ error: 'All fields (name, description, reward, redirectLink) are required.' });
}

try {
  // Create a new task
  const newTask = new TaskModel({
    name,
    description,
    reward,
    image: image || '', // Default to empty string if no image is provided
    redirectLink,
  });

  // Save the task
  await newTask.save();

  res.status(201).json({ message: 'Task created successfully', task: newTask });
} catch (error) {
  console.error('Error creating task:', error);
  res.status(500).json({ error: 'Internal Server Error', details: error.message });
}
});
// Delete a Task
app.delete('/api/tasks/:taskId', async (req, res) => {
const { taskId } = req.params;

try {
  const deletedTask = await TaskModel.findByIdAndDelete(taskId);

  if (!deletedTask) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.status(200).json({ message: 'Task deleted successfully', taskId });
} catch (error) {
  console.error('Error deleting task:', error);
  res.status(500).json({ error: 'Internal Server Error', details: error.message });
}
});


// TaskTransaction Schema with username
const taskTransactionSchema = new mongoose.Schema(
{
  username: {
    type: String,
    required: true
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
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
  description: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  transactionType: {
    type: String,
    enum: ['credit', 'debit'],
    required: true
  }
},
{ timestamps: true }
);
const TaskTransaction = mongoose.model('TaskTransaction', taskTransactionSchema);
app.get('/api/tasks', async (req, res) => {
try {
  const tasks = await TaskModel.find();
  res.status(200).json({ tasks });
} catch (error) {
  console.error('Error fetching tasks:', error);
  res.status(500).json({ error: 'Internal Server Error', details: error.message });
}
});
// Transfer Pending Commission by Username
app.post('/api/users/transfer-commission/:username', async (req, res) => {
const { username } = req.params;

try {
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.pendingCommission === 0) {
    return res.status(400).json({ message: 'No pending commission to transfer' });
  }

  user.balance += user.pendingCommission;
  user.pendingCommission = 0;
  await user.save();

  res.status(200).json({ message: 'Pending commission transferred successfully' });
} catch (error) {
  console.error('Error transferring pending commission:', error);
  res.status(500).json({ message: 'Error transferring pending commission' });
}
});
// Transfer all pending commissions and update task statuses
app.post('/api/users/transfer-all-commissions', async (req, res) => {
try {
  // Find all users
  const users = await User.find();

  for (const user of users) {
    if (user.pendingCommission > 0) {
      // Transfer pending commission to balance
      user.balance += user.pendingCommission;
      user.pendingCommission = 0;

      // Update task transactions for the user
      await TaskTransaction.updateMany(
        { username: user.username, status: 'pending' },
        { status: 'approved' }
      );

      // Save the user
      await user.save();
    }
  }

  res.status(200).json({ message: 'All pending commissions transferred and tasks updated successfully.' });
} catch (error) {
  console.error('Error transferring pending commissions:', error);
  res.status(500).json({ error: 'Internal Server Error', details: error.message });
}
});




const PaymentAccountSchema = new mongoose.Schema({
platform: {
  type: String,
  required: true,
},
platformImage: {
  type: String,
  required: true,
},
accountTitle: {
  type: String,
  required: true,
},
accountNumber: {
  type: String,
  required: true,
  unique: true, // Ensure account numbers are unique
},
}, { timestamps: true });

const PaymentAccount = mongoose.model('PaymentAccount', PaymentAccountSchema);


// Get all payment accounts
app.get('/payment-accounts', async (req, res) => {
try {
  const accounts = await PaymentAccount.find();
  res.status(200).json(accounts);
} catch (error) {
  res.status(500).json({ message: 'Error fetching payment accounts', error });
}
});

// Multer storage configuration
const storage = multer.diskStorage({
destination: function (req, file, cb) {
  cb(null, '../uploads/account-images'); // Ensure this path exists or create it
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


app.post('/api/payment-accounts/upload', upload.single('platformImage'), async (req, res) => {
try {
  const { platform, accountTitle, accountNumber } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'Platform image is required.' });
  }

  // Construct the file path for the uploaded image
  const platformImagePath = req.file.path;

  // Create a new PaymentAccount document
  const newAccount = new PaymentAccount({
    platform,
    platformImage: platformImagePath,
    accountTitle,
    accountNumber
  });

  // Save the new document to MongoDB
  await newAccount.save();

  res.status(201).json({ message: 'Payment account created successfully.', account: newAccount });
} catch (err) {
  console.error('Error creating payment account:', err);
  res.status(500).json({ error: 'Internal server error.' });
}
});

// Update an existing payment account
app.put('/payment-accounts/:id', upload.single('platformImage'), async (req, res) => {
const { platform, accountTitle, accountNumber } = req.body;

try {
  // Find the existing account
  const existingAccount = await PaymentAccount.findById(req.params.id);

  if (!existingAccount) {
    return res.status(404).json({ message: 'Payment account not found' });
  }

  // Update fields
  existingAccount.platform = platform;
  existingAccount.accountTitle = accountTitle;
  existingAccount.accountNumber = accountNumber;

  // If a new image is uploaded, update the platformImage field
  if (req.file) {
    existingAccount.platformImage = req.file.path;
  }

  // Save updated account
  const updatedAccount = await existingAccount.save();

  res.status(200).json({
    message: 'Payment account updated successfully',
    account: updatedAccount,
  });
} catch (error) {
  res.status(500).json({ message: 'Error updating payment account', error });
}
});

// Delete a payment account
app.delete('/payment-accounts/:id', async (req, res) => {
try {
  const deletedAccount = await PaymentAccount.findByIdAndDelete(req.params.id);

  if (!deletedAccount) {
    return res.status(404).json({ message: 'Payment account not found' });
  }

  res.status(200).json({ message: 'Payment account deleted successfully' });
} catch (error) {
  res.status(500).json({ message: 'Error deleting payment account', error });
}
});



// ]--------------------||EndPoint to Handle salary||---------------------------[
// Salary Schema
const salarySchema = new mongoose.Schema(
{
  salaryAmount: { type: Number, required: true },
  claimDate: { type: Date, default: null },
  claimableAfter: { type: Date, required: true },
  status: { type: Number, default: null },
  directReferralCount: { type: Number, required: true, min: 0 },
  indirectReferralCount: { type: Number, required: true, min: 0 },
  transactionHistory: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      amount: { type: Number, required: true },
      description: { type: String, trim: true },
      type: { type: String, enum: ['credit', 'debit'], required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
},
{ timestamps: true }
);

// Define Salary model
const Salary = mongoose.model('Salary', salarySchema);

// Get all salary plans
app.get('/api/salaries', async (req, res) => {
try {
  const salaries = await Salary.find();
  res.status(200).json(salaries);
} catch (error) {
  res.status(500).json({ message: 'Error fetching salary plans', error });
}
});

// Add new salary plan
app.post('/api/salaries', async (req, res) => {
try {
  const { salaryAmount, claimableAfter, status, directReferralCount, indirectReferralCount, transactionHistory } = req.body;
  if (directReferralCount < 0 || indirectReferralCount < 0) {
    return res.status(400).json({ message: 'Referral counts cannot be negative' });
  }
  const newSalary = new Salary({ salaryAmount, claimableAfter, status, directReferralCount, indirectReferralCount, transactionHistory });
  await newSalary.save();
  res.status(201).json(newSalary);
} catch (error) {
  res.status(500).json({ message: 'Error adding salary plan', error });
}
});

// Update a salary plan
app.put('/api/salaries/:id', async (req, res) => {
try {
  const updatedSalary = await Salary.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!updatedSalary) return res.status(404).json({ message: 'Salary not found' });
  res.status(200).json(updatedSalary);
} catch (error) {
  res.status(500).json({ message: 'Error updating salary plan', error });
}
});

// Delete a salary plan
app.delete('/api/salaries/:id', async (req, res) => {
try {
  const deletedSalary = await Salary.findByIdAndDelete(req.params.id);
  if (!deletedSalary) return res.status(404).json({ message: 'Salary not found' });
  res.status(200).json({ message: 'Salary deleted successfully' });
} catch (error) {
  res.status(500).json({ message: 'Error deleting salary plan', error });
}
});

// Get a single salary plan by ID
app.get('/api/salaries/:id', async (req, res) => {
try {
  const salary = await Salary.findById(req.params.id);
  if (!salary) return res.status(404).json({ message: 'Salary not found' });
  res.status(200).json(salary);
} catch (error) {
  res.status(500).json({ message: 'Error fetching salary plan', error });
}
});
