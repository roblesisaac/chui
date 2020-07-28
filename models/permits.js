const mongoose = require('mongoose');

var permitSchema = new mongoose.Schema({
  username: String,
  sheetName: String,
  sheetId: String,
  siteId: String,
  db: {
    methods: Array
  },
  ui: {
    apps: Array
  },
  permit: {
    methods: Array
  }
});

module.exports = mongoose.model('permit', permitSchema);

