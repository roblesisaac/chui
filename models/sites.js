const mongoose = require('mongoose');

var siteSchema = new mongoose.Schema({
    name: { type: String, unique: true },
    htmlButton: String,
    author: String
});

module.exports = mongoose.model('site', siteSchema);
