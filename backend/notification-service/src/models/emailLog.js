const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  emailId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'retry'],
    required: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for querying by status and date
emailLogSchema.index({ status: 1, processedAt: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
