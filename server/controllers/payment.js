import "dotenv/config";
import Razorpay from "razorpay";
import Payment from "../Modals/payment.js";
import User from "../Modals/Auth.js";
import mongoose from "mongoose";
import crypto from "crypto";
import nodemailer from "nodemailer";

const getRazorpayInstance = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || "rzp_test_TQfU4peyTMHyWD";
  const key_secret = process.env.RAZORPAY_KEY_SECRET || "j4CuWAHjCc820pdy0CC4LXRo";
  return new Razorpay({ key_id, key_secret });
};

// Async email transport for invoice
const sendInvoiceEmail = async (userEmail, userName, invoice) => {
  try {
    let testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    const info = await transporter.sendMail({
      from: '"YourTubeIN Billing" <billing@yourtube.in>',
      to: userEmail,
      subject: `YourTubeIN - ${invoice.plan.toUpperCase()} Subscription Activated`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;">
          <h2 style="color: #4f46e5; text-align: center;">Subscription Activated!</h2>
          <p>Hi <strong>${userName}</strong>,</p>
          <p>Thank you for upgrading your experience. Here is your digital invoice receipt.</p>
          <hr />
          <p><strong>Plan Upgraded:</strong> ${invoice.plan.toUpperCase()}</p>
          <p><strong>Amount Paid:</strong> ₹${invoice.amount}.00</p>
          <p><strong>Transaction ID:</strong> ${invoice.transactionId}</p>
          <p><strong>Order ID:</strong> ${invoice.orderId}</p>
          <p><strong>Date:</strong> ${new Date(invoice.date).toLocaleString()}</p>
          <hr />
          <p style="text-align: center; color: #888; font-size: 12px;">© YourTubeIN 2026. All rights reserved.</p>
        </div>
      `,
    });

    console.log("Invoice email sent: %s", info.messageId);
    console.log("Invoice Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (err) {
    console.error("Invoice email delivery notice (non-fatal):", err);
  }
};

// 1. POST /api/payments/order
export const createOrder = async (req, res) => {
  const { amount, planSelected } = req.body;
  if (!amount || !planSelected) {
    return res.status(400).json({ error: "Amount and plan selected are required" });
  }

  try {
    const razorpay = getRazorpayInstance();
    const options = {
      amount: Math.round(Number(amount) * 100), // Amount in paisa
      currency: "INR",
      receipt: `rcpt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    return res.status(200).json(order);
  } catch (error) {
    console.error("Razorpay order error:", error);
    const errorMsg = error?.error?.description || error?.message || "Failed to create Razorpay order";
    return res.status(500).json({ error: errorMsg });
  }
};

// 2. POST /api/payments/verify
export const verifyPayment = async (req, res) => {
  const { 
    userId, 
    email, 
    name, 
    planSelected, 
    amountPaid, 
    razorpayPaymentId, 
    razorpayOrderId, 
    razorpaySignature 
  } = req.body;

  if (!planSelected || !amountPaid || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
    return res.status(400).json({ error: "Missing verification parameters" });
  }

  try {
    // 0. Verify HMAC Signature (Req #6, #9)
    const secret = process.env.RAZORPAY_KEY_SECRET || "j4CuWAHjCc820pdy0CC4LXRo";
    const generated = crypto
      .createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
      
    if (generated !== razorpaySignature) {
      return res.status(400).json({ error: "Invalid payment signature. Payment rejected." });
    }

    // 1. Find and update user in MongoDB by userId or email
    let updatedUser = null;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { plan: planSelected },
        { new: true }
      );
    }

    if (!updatedUser && email) {
      updatedUser = await User.findOneAndUpdate(
        { email },
        { plan: planSelected },
        { new: true }
      );
    }

    // Fallback: If user not found in DB, create user record so payment is never lost
    if (!updatedUser) {
      updatedUser = await User.create({
        email: email || `user_${Date.now()}@yourtube.in`,
        name: name || "Subscriber",
        plan: planSelected
      });
    }

    // 2. Save payment log (Req #8)
    const payment = new Payment({
      userId: updatedUser._id,
      planSelected,
      amountPaid: Number(amountPaid),
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      razorpaySignature: razorpaySignature,
      status: "success"
    });
    const savedPayment = await payment.save();

    const invoiceData = {
      transactionId: razorpayPaymentId,
      orderId: razorpayOrderId,
      amount: amountPaid,
      plan: planSelected,
      date: savedPayment.createdAt,
      userEmail: updatedUser.email,
      userName: updatedUser.name
    };

    // 3. Send Email Invoice asynchronously without blocking response
    sendInvoiceEmail(updatedUser.email, updatedUser.name, invoiceData).catch(console.error);

    // 4. Send back confirmation details & updated user
    return res.status(200).json({
      success: true,
      message: `Successfully upgraded to ${planSelected.toUpperCase()} plan!`,
      invoice: invoiceData,
      user: updatedUser
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({ error: "Failed to verify transaction and update plan" });
  }
};
