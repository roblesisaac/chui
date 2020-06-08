"use strict";

try {
const Chain = require('./chain');
const models = {
  sheets: require('./models/sheets'),
  sites: require('./models/sites'), 
  users: require('./models/users')
};
const mongoose = require('mongoose');
const cookie = require('cookie');
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

global.protect = new Chain({
  input: function() {
    return {
      sheetName: this.arg1,
      token: this.query.token || this.headers.token,
      userid: this.query.userid || this.headers.userid
    };
  },
  steps: {
    authorizedAlready: function() {
      this.next(this.authorized === false);
    },
    sheetDbIsPublic: function() {
      this.next(this.sheet.db.public === true);
    },
    missingTokenOrId: function() {
      // this.next(false);
      this.next(!this.token || !this.userid);
    },
    alertMissing: function() {
      this.end("Missing tokens, you are.");
    },
    tokenIsValid: function(res, next) {
      var self = this;
    	models.users.findById(this.userid, function (err, user) {
    	  if(!user) return self.end("Not existing in archives, user "+ self.userid +" is.");
        jwt.verify(self.token, user.password, function (tokenErr, decoded) {
    			if(tokenErr) {
    				self.end("Ceased to be valid, this token has.");
    			} else {
    				next(true);
    			}
    		});
    	});
    },
    alertLoggedOut: function() {
      this.end("Logged out, you have become.");
    },
    alertThemToLogIn: function() {
      this.end("Log in first, you must.");
    },
    proceed: function() {
      this.next();
    }
  },
  instructions: [
    {
      if: "authorizedAlready",
      true: "proceed",
      false: [
        "lookupSheet",
        {
          if: "sheetDbIsPublic",
          true: "proceed",
          false: {
            if: "missingTokenOrId",
            true: "alertThemToLogIn",
            false: {
              if: "tokenIsValid", // todo
              true: "proceed",
              false: "alertLoggedOut"
            }
          }
        } 
      ]
    }
  ]
});
global.api = new Chain({
  input: function() {
    return {
      method: this.event.httpMethod.toLowerCase(),
      id: this.arg2,
      filter: {},
      nativeOptions: {
        token: String,
        userid: String,
        limit: Number,
        tailable: null,
        sort: String,
        skip: Number,
        maxscan: null,
        batchSize: null,
        comment: String,
        snapshot: null,
        readPreference: null,
        hint: Object,
        select: String
      },
      options: {
        limit: 50
      }
    };
  },
  steps: {
    addSiteIdToFilter: function(res, next) {
      this.filter.siteId = this.siteId;
      next();
    },
    addToOptions: function() {
      this.options[this.key] = this.nativeOptions[this.key](this.value);
      this.next();
    },
    addToFilter: function() {
      this.filter[this.key] = this.value;
      this.next();
    },
    convertToRegex: function() {
      this.value = this.value.replace(/\//g,'');
      this.value = { $regex: new RegExp(this.value) };
      this.next();
    },
    toRouteMethod: function(res, next) {
      next(this.method);
    },
    findById: function(res, next) {
      var self = this;
      this.model.findById(this.id, null, this.options, function(err, item) {
        if(err) return self.error(err);
        next(item);
      });
    },
    forEachQueryKey: function() {
      this.next(this.query);
    },
    getAllItems: function() {
      var self = this;
      this.model.find(this.filter, null, this.options, function(err, data){
        if(err) return self.error(err);
        self.next(data);
      });
    },
    hasId: function(res, next) {
      next(this.id !== undefined);
    },
    itIsANativeOption: function() {
      this.next(Object.keys(this.nativeOptions).indexOf(this.key) > -1);
    },
    keyValueIsRegex: function() {
      var firstIsSlash = this.value.charAt(0) == '/',
          lastIsSlash = this.value.charAt(this.value.length-1) == '/';
      this.next(firstIsSlash && lastIsSlash);
    },
    needsASiteId: function(res, next) {
      next(this.sheetName == "sheets");
    },
    updateItem: function() {
      var self = this;
      this.model.findByIdAndUpdate(this.id, this.body, { new: true }).then(function(data){
        self.next(data);
      });
    },
    postItem: function(res, next) {
      this.model.create(JSON.parse(this.event.body)).then(function(data){
        next(data);
      });
    }
  },
  instructions: [
    "protect",
    "model", // get model
    {
      switch: "toRouteMethod",
      get: [
        "forEachQueryKey", [
          {
            if: "itIsANativeOption",
            true: "addToOptions",
            false: [
              { if: "keyValueIsRegex", true: "convertToRegex" },
              "addToFilter"
            ]
          }  
        ],
        {
          if: "hasId",
          true: "findById",
          false: [
            { if: "needsASiteId", true: "addSiteIdToFilter" },
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
global.cookie = new Chain({
  input: function() {
    return {
      cookies: cookie.parse(this.cookie)
    };
  },
  steps: {
    noCookie: function() {
      this.lastVisit = this.cookito.get('LastVisit', { signed: true });
      this.next(!this.lastVisit);
    },
    alertFirstWelcome:  function() {
      this.next("First time here it is.");
    },
    alertWelcomeBack: function() {
      this.next("Welcome back. Last time was " + this.lastVisit);
    },
    setCookie: function() {
      var self = this;
      this.cookito.response.getHeader = function(key) {
        return self.headers[key];
      };
      this.next(this.cookito.response.getHeader("Set-Cookie") || "notCookie");
      // this.cookito.set('LastVisit', new Date().toISOString(), { signed: true });
    }
  },
  instructions: [
    function() {
      this.end(this.cookies);
    },
    {
      if: "noCookie",
      true: "alertFirstWelcome",
      false: "alertWelcomeBack"
    },
    "setCookie"
  ]
});
global.model = new Chain({
  input: function() {
    return {
      sheetName: this.arg1
    };
  },
  steps: {
    sheetNameIsNative: function() {
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
      var model = mongoose.model(this.collectionName);
      this.model = model;
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
      this.next({
        name: this.collectionName,
        schema: this.stringSchema
      });
    }
  },
  instructions: [
    "protect",
    {
      if: "sheetNameIsNative",
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
          true: "relayModel",
          false: "createModel"
        }
      ]
    }
  ]
});
global.schema = new Chain({ // gets schema obj from sheeet, ready to convert into model
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
    "protect",
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
    alertUserDoesntExist: function() {
      this.next("Not existing in archives, "+ this.user.username +" is.");
    },
    passwordAuthenticates: function(user) {
      var self = this;
			user.comparePassword(self.user.password, function(err, isMatch) {
			 // err ? self.next(err) : self.next(isMatch && isMatch === true);
			 self.next(isMatch && isMatch === true);
			});  
    },
    setCookies: function() {
      var sessionId = "Session::"+this.user.username;
      this.newCookie = cookie.serialize("SID", sessionId);
    },
    sendCredentials: function() {
      this.next({
  		  token: jwt.sign({
  		    _id: this.dbUser._id,
  		    username: this.dbUser.username,
  		    name: this.user.username,
  		    password: this.dbUser.password,
  		    cookie: this.newCookie
  		  }, this.dbUser.password, {	expiresIn: '15h' }),
  		  userid: this.dbUser._id
  		});
    },
    sayPasswordsDontMatch: function(res) {
      this.next("Unjust password, this is.");
    }
  },
  instructions: [
    "lookupUser",
    {
      if: "userDoesntExist",
      true: "alertUserDoesntExist",
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
    "protect",
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
        next(site);
      });
    },
    noSiteExists: function(site, next) {
      next(site == null);
    },
    askToCreateSite: function(res, next) {
      next({
        body: "<h1>" + this.siteName + " not found. Would you like to create one?</h1>", 
        contentType: "text/html"
      });
    },
    getSheetsForSite: function(site, next) {
      var self = this;
      models.sheets.find({
        siteId: self.site._id
      }).then(function(sheets) {
        self.sheets = sheets;
        next(sheets);
      });
    },
    urlHasAChain: function(res, next) {
      next(this.chain !== undefined);
    },
    runChain: function(res, next) {
      var self = this,
          chain = global[this.chain];
      chain.import(this._memory.storage).start().then(function(memory){
        self._memory.import(memory);
        self.next(memory.last);
      }).catch(function(err){
        self.error(err);
      });
    },
    isVerbose: function(res, next) {
      next(this.query.verbose);
    },
    addDetails: function(last, next) {
      var index = Object.assign({}, this._memory.storage);
      delete index.callback;
      next(index);
    }
  },
  instructions: [
    "connectToDb",
    "lookupSiteInDb",
    {
      if: "noSiteExists",
      true: "askToCreateSite",
      false: [
        "getSheetsForSite",
        {
          if: "urlHasAChain",
          true: "runChain",
          false: "loadLandingPage"
        }
      ]
    },
    {
      if: "isVerbose",
      true: "addDetails"
    },
    "serve"
  ]
});

module.exports.port = function(event, context, callback) {
  context.callbackWaitsForEmptyEventLoop = false;
  var params = event.pathParameters || {};
  global.port.import({
    arg1: params.arg1,
    arg2: params.arg2,
    body: JSON.parse(event.body || "{}"),
    callback: callback,
    chain: params.chain,
    context: context,
    cookie: event.headers.Cookie || "",
    domain: event.headers.Host,
    event: event,
    headers: event.headers || {},
    host: "https://"+event.headers.Host+"/dev/exhaustbarn",
    query: event.queryStringParameters || {},
    siteName: params.site
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
