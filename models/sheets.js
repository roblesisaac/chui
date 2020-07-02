const mongoose = require('mongoose');


const sheetSchema = new mongoose.Schema({
  "name": String,
  "htmlButton": String,
  "onStart": String,
  "sort": Number,
  "siteId": String,
  "author": String,
  "db": {
      "schema": {}
  },
  "ui": {
      "js": String,
      "html": String,
      "blocks": [{
          "sort": Number,
          "span": Number,
          "html": String,
          "css": String,
          "javascript": String
      }]
  }
});

module.exports = mongoose.model('sheet', sheetSchema);
