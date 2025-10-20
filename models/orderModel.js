import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    products: {
      type: [{ type: mongoose.ObjectId, ref: "Products" }],
      required: true,
    },
    payment: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    buyer: {
      type: mongoose.ObjectId,
      ref: "users",
      required: true
    },
    status: {
      type: String,
      default: "Not Process",
      enum: ["Not Process", "Processing", "Shipped", "delivered", "cancel"],
      required: true
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);