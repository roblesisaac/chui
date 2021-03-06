const mongoose = require('mongoose');

var bugSchema = new mongoose.Schema({
    email: { type: String, unique: true, lowercase: true, trim: true },
    htmlButton: String,
    author: String,
    testNumber: Number,
    testString: String,
    testlastly: String
});

module.exports = mongoose.model('bugtests', bugSchema);

