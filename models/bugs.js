const mongoose = require('mongoose');

var bugSchema = new mongoose.Schema({
    email: { type: String, unique: true },
    htmlButton: String,
    author: String,
    testNumber: Number,
    testString: String
});

module.exports = mongoose.model('bugtests', bugSchema);

