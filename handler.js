try {
const Chain = require('./chain');
const models = {
  sheets: require('./models/sheets'),
  sites: require('./models/sites'), 
  users: require('./models/users')
};
const mongoose = require('mongoose');
const db = mongoose.connection;
mongoose.Promise = global.Promise;
let isConnected;
const fs = require('fs');
const tmplts = {};
if(!tmplts.index) {
  fs.readdir('./templates', function (err, data) {
    for (var i=0; i<data.length; i++) {
      var fileName = data[i],
          templateName = data[i].slice(0,-5);    
      tmplts[templateName] = fs.readFileSync('./templates/' + fileName, 'utf8');
    }
  });
}
const jwt = require('jsonwebtoken');
let token;

global.api = new Chain({
  input: function() {
    return {
      method: this.event.httpMethod.toLowerCase(),
      id: this.arg2,
      filter: {}
    };
  },
  steps: {
    hasId: function() {
      this.next(this.id !== undefined);
    },
    findById: function() {
      var self = this;
      this.model.findById(this.id, function(err, item) {
        if(err) return self.error(err);
        self.next(item);
      });
    },
    lookingUpSheets: function() {
      this.next(this.sheetName == "sheets");
    },
    addSiteId: function() {
      this.filter.siteId = "5d040cd9d1e17100079b8500";
      this.next();
    },
    getAllItems: function() {
      var self = this;
      this.model.find({siteId: this.siteId}, function(err, data){
        if(err) return self.error(err);
        self.next(data);
      }).limit(50);
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
    "getModelFromSheetName",
    {
      if: "routeMethod",
      get: [
        {
          if: "hasId",
          true: "findById",
          false: [
            { if: "lookingUpSheets", true: "addSiteId" }, 
            "getAllItems"
          ]
        }
      ],
      put: "updateItem",
      post: "postItem",
      delete: "deleteItem"
    }
  ]
});
global.getModelFromSheetName = new Chain({
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
    collectionExists: function() {
      this.modelIndex = mongoose.modelNames().indexOf(this.collectionName);
      this.next(this.modelIndex > -1);
    },
    relayModel: function() {
      this.model = mongoose.model(this.collectionName);
      this.next({
        collectionName: this.collectionName,
        index: this.modelIndex,
        schema: this.stringSchema,
        mongoose: {
          models: mongoose.modelNames(),
          version: mongoose.version 
        }
      });  
    },
    createModel: function() {
      var options = {
        strict: true,
        collection: this.collectionName 
      };
      this.model = mongoose.model(this.collectionName, new mongoose.Schema(this.schema, options));
      this.next(this.stringSchema);
    }
  },
  instructions: [
    {
      if: "sheetIsNative",
      true: "relayNativeModel",
      false: [
        "lookupSheet",
        function() {
          this.collectionName = this.siteId+'_'+this.sheetName+'_'+JSON.stringify(this.sheet._id);
          this.next();
        },
        "schema",
        {
          if: "collectionExists",
          true: [ "relayModel" ],
          false: [ "createModel" ]
        }
      ]
    }
  ]  
});
global.schema = new Chain({ // creates obj ready to convert into model
  input: function() {
    return {
      sheetName: this.arg1,
      types: { "string": String, "number": Number, "date": Date, "boolean": Boolean, "array": Array }
    };
  },
  steps: {
    forEachItemInSchema: function() {
      this.sheet.db = this.sheet.db || {};
      this.schema = this.sheet.db.schema || { noKeysDefined: "string"};
      this.stringSchema = Object.assign({}, this.schema);
      this.next(this.schema);
    },
    formatAllowed: function() {
      this.convert = this.types[this.value];
      this.next(this.convert !== undefined);
    },
    convertToFuncion: function() {
      this.obj[this.key] = this.convert;
      this.next();
    }
  },
  instructions: [
    "lookupSheet",
    "forEachItemInSchema", [
      { if: "formatAllowed", true: "convertToFuncion" }  
    ],
    function() {
      this.next(this.stringSchema);
    }
  ]
});
global.connectToDb = new Chain({
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
      mongoose.connect(this.tokens, { keepAlive: true }).then(function(database){
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
global.login = new Chain({
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
global.serve = new Chain({
  steps: {
    formatObject: function(res) {
      this.format = {
        statusCode: 200,
        body: res
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
        if(res.data[key] !== undefined) {
          var replacer = new RegExp("{{ "+key+" }}", "g"),
              replacement = res.data[key];
					self.format.body = self.format.body.replace(replacer, replacement);  
        }
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
    {
      if: "itNeedsHeaders",
      true: [
        "addHeaders",
        "replaceBody",
        {
          if: "thereAreVariables",
          true: "renderVariables"
        }
      ],
      false: "stringifyBody"
    },
    "initCallback"
  ]
});
global.scripts = new Chain({
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
global.loadLandingPage = new Chain({
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
        contentType: "text/html"
      });
    }
  },
  instructions: [ "showIndex" ]
});
global.port = new Chain({
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
      this.next(site == null);
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
          chain = global[this.chain];
      chain.import(this._memory._storage).start().then(function(memory){
        self._memory.import(memory);
        self.next(memory.last);
      }).catch(function(err){
        self.error(err);
      });
    },
    isVerbose: function() {
      this.next(this.query.verbose);
    },
    addDetails: function(last) {
      var index = Object.assign({}, this._memory._storage);
      delete index.callback;
      this.next(index);
    }
  },
  instructions: [
    connectToDb,
    "lookupSiteInDb",
    {
      if: "noSiteExists",
      true: "askToCreateSite",
      false: [
        "getSheetsForSite",
        {
          if: "urlHasAChain",
          true: "runChain",
          false: loadLandingPage
        }
      ]
    },
    {
      if: "isVerbose",
      true: "addDetails"
    },
    serve
  ]
});

module.exports.port = function(event, context, callback) {
  context.callbackWaitsForEmptyEventLoop = false;
  var params = event.pathParameters || {};
  port.import({
    event: event,
    callback: callback,
    chain: params.chain,
    context: context,
    headers: event.headers || {},
    siteName: params.site,
    arg1: params.arg1,
    arg2: params.arg2,
    query: event.queryStringParameters || {},
    body: JSON.parse(event.body || "{}"),
    domain: event.headers.Host,
    host: "https://"+event.headers.Host+"/dev/exhaustbarn"
  }).start().catch(function(error){
    callback(null, {
      statusCode: 200,
      body: error.stack,
      headers: {
        'Content-Type': "application/javascript"
      }
    });
  });
};
} catch (e) {
  module.exports.port = function(event, context, callback) {
    callback(null, {
      statusCode: 200,
      body: e.stack || e,
      headers: {
        'Content-Type': "application/javascript"
      }
    });    
  }
}
