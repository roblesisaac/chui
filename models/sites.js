const mongoose = require('mongoose');

var siteSchema = new mongoose.Schema({
    name: String,
    userId: String,
    url: { type: String, unique: true }
});

module.exports = mongoose.model('site', siteSchema);
