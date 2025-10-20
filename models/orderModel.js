import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    products: {
      type: [{ type: mongoose.ObjectId, ref: "Products" }],
      required: true,
      validate: {
        validator: function(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'Products array must not be empty'
      }
    },
    payment: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      validate: {
        validator: function(value) {
          if (!value || typeof value !== 'object') return false;
          const hasErrors = 'errors' in value;
          const hasParams = 'params' in value;
          const hasMessage = 'message' in value;
          const hasSuccess = 'success' in value && typeof value.success === 'boolean';
          return hasErrors && hasParams && hasMessage && hasSuccess;
        },
        message: 'Payment must have errors, params, message, and success (boolean) fields'
      }
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