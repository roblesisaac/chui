const mongoose = require('mongoose');

const user = {
  username: String,
  apps: [String]
};

const schm = {
  propName: String,
  propType: String,
  subSchema: String
};

const sheetSchema = new mongoose.Schema({
    "_init" : String,
    "db": {
      public: Boolean,
      schema: Array
    },
    "public" : Boolean, // to be replaced with db object
    "_schema" : [schm], // to be replaced with db object
    "htmlButton": String,
    "link" : String, // to be replaced with htmlButton
    "js": String,
    "name" : String,
    "siteId": String,
    "position": Number,
    "sort" : Number, // to be replaced with position
    "templates" : Array,
    "users": [user]
});

module.exports = mongoose.model('sheet', sheetSchema);
