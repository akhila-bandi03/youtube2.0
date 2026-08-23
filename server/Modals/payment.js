import mongoose from "mongoose";

const paymentschema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    planSelected: {
      type: String,
      enum: ["bronze", "silver", "gold", "premium"],
      required: true,
    },
    amountPaid: {
      type: Number,
      required: true,
    },
    paymentId: {            // razorpay_payment_id from Razorpay response
      type: String,
      required: true,
    },
    orderId: {              // razorpay_order_id used to create order
      type: String,
      required: true,
    },
    razorpaySignature: {    // stored for audit trail
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["success", "failed", "cancelled"],
      default: "success",
    },
    subscriptionStartDate: {
      type: Date,
      default: Date.now,
    },
    subscriptionExpiryDate: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1); // 30-day subscription
        return d;
      }
    }
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("payment", paymentschema);
