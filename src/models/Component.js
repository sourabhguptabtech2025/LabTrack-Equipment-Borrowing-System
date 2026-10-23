const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Component name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      enum: [
        'Microcontrollers',
        'SBC / Single Board Computers',
        'Sensors & Modules',
        'Development Boards',
        'Test & Measurement',
        'Actuators & Motors',
        'General Accessories'
      ]
    },
    labRoom: {
      type: String,
      default: 'Lab 302 - Embedded Systems & IoT',
      trim: true
    },
    totalStock: {
      type: Number,
      required: [true, 'Total stock count is required'],
      min: [0, 'Total stock cannot be negative']
    },
    availableStock: {
      type: Number,
      required: [true, 'Available stock count is required'],
      min: [0, 'Available stock cannot be negative'],
      validate: {
        validator: function (val) {
          return val <= this.totalStock;
        },
        message: 'Available stock cannot exceed total stock'
      }
    },
    specifications: {
      type: String,
      default: 'Standard laboratory grade equipment'
    },
    description: {
      type: String,
      default: ''
    },
    imageUrl: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['Available', 'Low Stock', 'Out of Stock', 'Maintenance'],
      default: 'Available'
    }
  },
  {
    timestamps: true
  }
);

// Auto compute status before save
componentSchema.pre('save', function () {
  if (this.availableStock <= 0) {
    this.status = 'Out of Stock';
  } else if (this.availableStock <= Math.max(2, Math.floor(this.totalStock * 0.2))) {
    this.status = 'Low Stock';
  } else {
    this.status = 'Available';
  }
});

module.exports = mongoose.model('Component', componentSchema);
