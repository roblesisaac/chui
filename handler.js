const Chain = require('./chain');
const loop = Chain.loop;
const models = { 
  sheets: require('./models/sheets'),
  sites: require('./models/sites'), 
  users: require('./models/users')
};
const mongoose = require('mongoose');
const db = mongoose.connection;
mongoose.Promise = global.Promise;
let isConnected;
const sessionModels = {};
const fs = require('fs');
const tmplts = {};
if(!tmplts.index) {
  fs.readdir('./templates', function (err, data) {
    for (i=0; i<data.length; i++) tmplts[data[i].slice(0,-5)] = fs.readFileSync('./templates/' + data[i], 'utf8');
  });
}
const jwt = require('jsonwebtoken');
let token;

const schema = new Chain({
  input: {
    types: { 
      "string": "Strings",
      "number": "Numbers",
      "date": "Dates",
      "boolean": "Booleans",
      "array": "Arrays"
    }
  },
  steps: {
    forEachItemInSchema: function() {
      this.schema = {
        customer: {
          name: "string",
          phone: "number",
          email: "string"
        },
        parts: [
          {
            sku: "string",
            info: "string",
            price: "number"
          }  
        ],
        street: "string",
        zip: "string",
        test: ["hshf",2,3,4]
      };
      this.next(this.schema);
    },
    formatAllowed: function() {
      this.convert = this.types[this.value];
      this.next(this.convert !== undefined);
    },
    convertToFuncion: function() {
      this.obj[this.key] = this.convert;
      this.next();
    },
    relayObj: function() {
      this.next(this.schema);
    }
  },
  instructions: [
    "forEachItemInSchema",
    [
      {
        if: "formatAllowed",
        true: "convertToFuncion"
      }  
    ],
    "relayObj"
  ]
});
const api = new Chain({
  input: function() {
    return {
      method: this.event.httpMethod.toLowerCase(),
      id: this.arg2
    };
  },
  steps: {
    relayData: function() {
      var self = this;
      this.model.find({
        siteId: self.siteId
      }).then(function(data) {
        self.data = data;
        self.next(data);
      });
    },
    routeMethod: function() {
      this.next(this.method);
    },
    sayId: function() {
      this.next(this.body);  
    },
    updateItem: function() {
      var self = this;
      this.model.findByIdAndUpdate(this.id, this.body, { new: true }).then(function(data){
        self.next(data);
      });
    }
  },
  instructions: [
    "getDbSchema",
    {
      if: "routeMethod",
      get: "relayData",
      put: "updateItem",
      post: "sayMethod",
      delete: "sayMethod"
    }
  ]
});
const getDbSchema = new Chain({
  input: function() {
    return {
      sheetName: this.arg1
    };
  },
  steps: {
    sheetIsNative: function() {
      this.next(models[this.sheetName] !== undefined);
    },
    relayNativeModel: function() {
      this.model = models[this.sheetName];
      this.next(this.model);
    },
    relaySheetSchemaObj: function() {
      this.sheet.db = this.sheet.db || {};
      this.sheet.db.schema = this.sheet.db.schema || { skus: "number"};
      
      this.schema = this.sheet.db.schema;
      this.next(this.schema);
    }
  },
  instructions: [
    {
      if: "sheetIsNative",
      true: "relayNativeModel",
      false: [
        "lookupSheet",
        "relaySheetSchemaObj",
        "buildSchema"
      ]
    }
  ]  
});
const buildSchema = new Chain({
  input: function() {
    return {
      schema: this.schema || { skus: "number" },
      types: { 
        "string": "Strings",
        "number": "Numbers",
        "date": "Dates",
        "boolean": "Booleans",
        "array": "Arrays"
      }
    };
  },
  steps: {
    forEachItemInSchema: function() {
      this.schema = {
        customer: {
          name: "string",
          phone: "number",
          email: "string"
        },
        parts: [
          {
            sku: "string",
            info: "string",
            price: "number"
          }  
        ],
        street: "string",
        zip: "string",
        test: ["hshf",2,3,4]
      };
      this.next(this.schema);
    },
    formatAllowed: function() {
      this.convert = this.types[this.value];
      this.next(this.convert !== undefined);
    },
    convertToFuncion: function() {
      this.obj[this.key] = this.convert;
      this.next();
    },
    relayObj: function() {
      this.next(this.schema);
    }
  },
  instructions: [
    "forEachItemInSchema",
    [
      {
        if: "formatAllowed",
        true: "convertToFuncion"
      }  
    ],
    "relayObj"
  ]
});
const connectToDb = new Chain({
  input: {
    tokens: process.env.DB
  },
  steps: {
    alreadyConnected: function() {
      this.next(isConnected !== undefined);
    },
    promiseResolve: function() {
      Promise.resolve();
      this.next();
    },
    connect: function() {
      var self = this;
      mongoose.connect(this.tokens).then(function(database){
        isConnected = database.connections[0].readyState;
        self.next();
      });
    }
  },
  instructions: [
    {
      if: "alreadyConnected",
      true: "promiseResolve",
      false: "connect"
    }
  ]
});
const login = new Chain({
  steps: {
    lookupUser: function() {
      var self = this;
      this.user = this.body;
      models.users.findOne({username: this.user.username}).then(function(user){
        self.dbUser = user;
        self.next(user);
      });
    },
    userDoesntExist: function(user) {
      this.next(user===null);
    },
    askToCreateUser: function() {
      this.next("No user " + this.user.username + " exists? Create one?");
    },
    passwordAuthenticates: function(user) {
      var self = this;
			user.comparePassword(self.user.password, function(err, isMatch) {
			  self.next(isMatch && isMatch === true);
			});  
    },
    sendCredentials: function() {
      this.next({
  		  token: jwt.sign({
  		    _id: this.dbUser._id,
  		    username: this.dbUser.username,
  		    name: this.dbUser.name,
  		    password: this.dbUser.password
  		  }, this.dbUser.password, {	expiresIn: '15h' }),
  		  userid: this.dbUser._id
  		});
    },
    sayPasswordsDontMatch: function(user) {
      this.next("Wrong password.");
    }
  },
  instructions: [
    "lookupUser",
    {
      if: "userDoesntExist",
      true: "askToCreateUser",
      false: [
        {
          if: "passwordAuthenticates",
          true: "sendCredentials",
          false: "sayPasswordsDontMatch"
        }
      ]
    }
  ]
});
const serve = new Chain({
  steps: {
    formatObject: function(res) {
      this.format = {
        statusCode: 200,
        body: JSON.stringify("res");
      };
      this.next(res);
    },
    itNeedsHeaders: function(res) {
      this.next(res.contentType !== undefined);
    },
    addHeaders: function(res) {
      this.format.headers = {
        'Content-Type': res.contentType 
      };
      this.next(res);
    },
    replaceBody: function(res) {
      this.format.body = res.body || "No text in body?";
      this.next(res);
    },
    thereAreVariables: function(res) {
      this.next(res.data !== undefined);
    },
    renderVariables: function(res) {
      var self = this;
      for(var key in res.data) {
        self.format.body = self.format.body.replace(new RegExp("{{ "+key+" }}", "g"), res.data[key]);
      }
      this.next(res);
    },
    noErrors: function() {
      this.next(!this.error);
    },
    stringifyBody: function() {
      this.format.body = JSON.stringify(this.format.body);
      this.next();
    },
    initCallback: function() {
      this.callback(null, this.format);
    }
  },
  instructions: [
    "formatObject",
    // {
    //   if: "itNeedsHeaders",
    //   true: [
    //     "addHeaders",
    //     "replaceBody",
    //     {
    //       if: "thereAreVariables",
    //       true: "renderVariables"
    //     }
    //   ],
    //   false: {
    //     if: "noErrors",
    //     true: "stringifyBody"
    //   }
    // },
    "initCallback"
  ]
});
const scripts = new Chain({
  input: function() {
    return {
      sheetName: this.arg1,
      scriptName: this.arg2,
      css: "text/css",
      html: "text/html",
      javascript: "application/javascript",
      defaultTypes: ["text/css", "text/html", "application/javascript"]
    };
  },
  steps: {
    lookupSheet: function() {
      var self = this;
      this.sheet = this.sheets.findOne({
        name: self.sheetName,
        siteId: self.siteId
      });
      this.next(this.sheet);
    },
    noSheetFound: function() {
      this.next(this.sheet === null);  
    },
    sayNoSheetFound: function() {
      this.next({
        body: "<h1>No " + this.sheetName + " found...</h1>",
        contentType: "html"
      });
    },
    noScriptSpecified: function() {
      this.next(this.scriptName === undefined);
    },
    loadJavascript: function() {
      this.next({
        body: this.sheet.js,
        contentType: "application/javascript"
      });
    },
    loadSpecificScriptText: function(findOne) {
      var self = this,
          template = this.sheet.templates.findOne({
            name: self.scriptName
          });
      this.template = template || {};
      this.next({
        body:  template.text
      });
    },
    appendContentType: function(res) {
      var contentType = this[this.template.contentType] || this.template.contentType;
      if(this.defaultTypes.indexOf(contentType) === -1) contentType = "text/html";
      res.contentType = contentType;
      this.next(res);
    }
  },
  instructions: [
    "lookupSheet",
    {
      if: "noSheetFound",
      true: "sayNoSheetFound",
      false: {
          if: "noScriptSpecified",
          true: "loadJavascript",
          false: ["loadSpecificScriptText", "appendContentType"]
        }
    }
  ]
});
const loadLandingPage = new Chain({
  steps: {
    showIndex: function() {
      this.next({
        data: {
          host: this.host,
          siteName: this.site.url,
          token: token,
          cookie: this.headers.Cookie || "No Cookie",
          username: this.username || "public"
        },
        body: tmplts.index,
        contentType: "html"
      });
    }
  },
  instructions: [ "showIndex" ]
});
const port = new Chain({
  steps: {
    lookupSiteInDb: function(res, next, vm) {
      var self = this;
      models.sites.findOne({
        name: self.siteName
      }).then(function(site){
        self.site = site;
        self.siteId = site.id;
        self.next(site);
      });
    },
    noSiteExists: function(site) {
      this.next(site === null);
    },
    askToCreateSite: function() {
      this.next({
        body: "<h1>" + this.siteName + " not found. Would you like to create one?</h1>", 
        contentType: "text/html"
      });
    },
    getSheetsForSite: function(site) {
      var self = this;
      models.sheets.find({
        siteId: self.site._id
      }).then(function(sheets) {
        self.sheets = sheets;
        self.next(sheets);
      });
    },
    urlHasAChain: function() {
      this.next(this.chain !== undefined);
    },
    runChain: function() {
      var self = this,
          pass = {};
      Object.assign(pass, self, Chain["_"+this.chain].input);
      Chain.run(this.chain, {
        input: pass,
        output: function(res) {
          self.next(res); 
        }
      });
    },
    isVerbose: function() {
      this.next(this.query.verbose);
    },
    addDetails: function(last) {
      var index = {};
      Object.assign(index, this);
      this.next(index);
    },
    servey: function() {
      this.callback(null, {
        statusCode: 200,
        body: JSON.stringify("server");
      })
    }
  },
  instructions: [
    //"connectToDb",
    // "lookupSiteInDb",
    // {
    //   if: "noSiteExists",
    //   true: "askToCreateSite",
    //   false: [
    //     "getSheetsForSite",
    //     {
    //       if: "urlHasAChain",
    //       true: "runChain",
    //       false: "loadLandingPage"
    //     }
    //   ]
    // },
    // {
    //   if: "isVerbose",
    //   true: "addDetails"
    // },
    "servey"
  ]
});

module.exports.port = function(event, context, callback) {
  context.callbackWaitsForEmptyEventLoop = false;
  var params = event.pathParameters || {};
  port.import({ callback: callback }).start();
};
