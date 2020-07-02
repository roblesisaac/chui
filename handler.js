"use strict";

try {
const Chain = require("./templates/chain");
var models = {
  sheets: require("./models/sheets"),
  sites: require("./models/sites"), 
  users: require("./models/users"),
  bugtests: require("./models/bugs")
};
const permits = require("./models/permits");
const mongoose = require("mongoose");
const cookie = require("cookie");
let isConnected;
const fs = require("fs");
const tmplts = {};
if(!tmplts.index) {
  fs.readdir("./templates", function (err, data) {
    if(err) return;
    for (var i=0; i<data.length; i++) {
      var fileName = data[i],
          templateName = data[i].split(".")[0],
          fileType = data[i].split(".")[1],
          text = fs.readFileSync("./templates/" + fileName, "utf8");
      tmplts[fileName] = text;
      if(fileType == "html") tmplts[templateName] = text;
    }
  });
}
const jwt = require("jsonwebtoken");
const loop = function(arr) {
  return { async: arr };
};

global.checkDbPermit = new Chain({
  steps: {
    permitExcludesMethodForDb: function() {
      this.next(this.permit.db.methods.indexOf(this._eventMethod) == -1);
    }
  },
  instruct: [
    "getUserPermitForSheet",
    { if: "permitExcludesMethodForDb", true: "alertPermitExcludesMethod" }
  ]
});
global.connectToDb = new Chain({
  input: {
    tokens: process.env.DB
  },
  steps: {
    alreadyConnected: function() {
      this.next(!!isConnected);
    },
    connect: function() {
      var self = this,
          options = {
            useCreateIndex: true,
            autoIndex: true,
            keepAlive: true
          };
      mongoose.connect(this.tokens, options).then(function(database){
        isConnected = database.connections[0].readyState;
        self.next();
      });
    },
    promiseResolve: function() {
      Promise.resolve();
      this.next();
    }
  },
  instruct: {
    if: "alreadyConnected",
    true: "promiseResolve",
    false: "connect"
  }
});
global.cookie = new Chain({
  instruct: [function() {
    this.end(this._cookies);
  }]
}); // remove
global.db = new Chain({
  input: function() {
    return {
      id: this._arg2,
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
    findById: function(res, next) {
      var self = this;
      this.model.findById(this.id, null, this.options, function(err, item) {
        if(err) return self.error(err);
        next(item);
      });
    },
    forEachQueryKey: function() {
      this.next(this._query);
    },
    getAllItems: function() {
      var self = this;
      this.model.find(this.filter, null, this.options, function(err, data){
        if(err) return self.error(err);
        self.next(data);
      });
    },
    hasId: function(res, next) {
      next(!!this.id);
    },
    ensureIndex: function() {
      if(this.sheetName == "bugtests") {
        var self= this;
        this.model.ensureIndexes(function(){
          self.model.init().then(function(){
            self.next();
          });
        });
      } else {
        this.next();
      }
    },
    isANativeOption: function() {
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
    toRouteMethod: function(res, next) {
      next(this._eventMethod);
    },
    updateItem: function() {
      var self = this;
      this.model.findByIdAndUpdate(this.id, this._body, { new: true }).then(function(data){
        self.next(data);
      });
    },
    postItem: function(res, next) {
      var self = this;
      this.model.create(this._body, function(err, data){
        if(err) return self.end(err);
        next(data);
      });
    }
  },
  instruct: [
    "checkDbPermit",
    "model",
    "ensureIndex",
    {
      switch: "toRouteMethod",
      get: [
        "forEachQueryKey", [
          {
            if: "isANativeOption",
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
global.getSheetForEachPermit = new Chain({
  input: {
    sheets: []
  },
  steps: {
    appendToSheets: function(sheet) {
      this.sheets.push(sheet);
      this.next();
    },
    grabUserPermitsForSite: function() {
      this.next(this.permits);
    },
    lookupCorrespondingSheet: function() {
      var self = this;
      models.sheets.findOne({
        siteId: this.siteId,
        name: this.permit.sheetName
      }, function(err, sheet){
        if(err) return self.error(err);
        self.next(sheet);
      });
    },
    lookupPublicPermitsForSite: function() {
      var self = this;
      permits.find({
        siteId: this.siteId,
        username: this.user.username
      }, function(err, permits){
        if(err) return self.error(err);
        self.next(permits, "permits");
      });
    },
    permitAllowsHtml: function() {
      var isAll = this.permit.ui.apps.indexOf("all") > -1,
          isHtml = this.permit.ui.apps.indexOf("html") > -1;
      this.next(isAll || isHtml);
    }
  },
  instruct: [
    "grabUserPermitsForSite",
    loop([
      "define=>permit",
      { 
        if: "permitAllowsHtml",
        true: [
          "lookupCorrespondingSheet",
          "appendToSheets"
        ]
      }
    ])  
  ]
});
global.getUserPermitForSheet = new Chain({
  input: function() {
    return {
      sheetName: this._arg1 || "sheets",
      id: this._arg2
    };
  },
  steps: {
    alertNoPermitExists: function() {
      this.end("<(-_-)> Not found in archives, your permit is.");
    },
    lookupPermit: function() {
      var self = this,
          filters = {
            siteId: this.siteId,
            username: this.user.username,
            sheetName: this.sheetName,
          };
      permits.findOne(filters, function(error, permit) {
        if(error) return self.error(error);
        self.next(permit, "permit");
      });
    },
    noPermitExists: function() {
      this.next(!this.permit);
    }
  },
  instruct: [
    "lookupPermit",
    { if: "noPermitExists", true: "alertNoPermitExists" } 
  ]
});
global.grabSheet = new Chain({
  input: function() {
    return {
      sheetName: this._arg1
    };
  },
  steps: {
    alertNoSheetFound: function() {
      this.error("Not existing in archives, sheet " + this.sheetName + " is. Or Prohibited, you are.");
    },
    lookupAndDefineSheet: function() {
      var self = this;
      this.sheet = this.sheets.findOne({
        name: self.sheetName
      });
      this.next(!!this.sheet);
    },
    noSheetFound: function() {
      this.next(this.sheet === null);  
    }
  },
  instruct: [
    "lookupAndDefineSheet",
    {
      if: "noSheetFound",
      true: "alertNoSheetFound"
    }    
  ]
});
global.login = new Chain({
  input: function() {
    return {
      username: this._body.username
    };
  },
  steps: {
    alertPasswordsDontMatch: function(res) {
      this.next("<(-_-)> Unjust password, this is.");
    },
    alertUserDoesntExist: function() {
      this.next("<(-_-)> Not existing in archives user, "+ this.username +" is.");
    },
    createCookies: function() {
      var tokenContent = {
    		    _id: this.user._id,
    		    username: this.user.username,
    		    password: this.user.password,
    		    cookie: this.newCookie
          },
          cookieOptions = { secure: true, sameSite: "none", httpOnly: true, maxAge: 60*30, domain: this._domain, path: "/" },
      		secret = this.user.password;
      this.token = jwt.sign(tokenContent, secret, {	expiresIn: '30m' });
      this.cookieToken = cookie.serialize("token", String(this.token), cookieOptions);
      this.cookieUserId = cookie.serialize("userid", String(this.user._id), cookieOptions);
      this.cookiePermits = cookie.serialize("permits", JSON.stringify(this.permits), cookieOptions);
      this.next();
    },
    getUserPermitsForSite: function() {
      var self = this;
      permits.find({
        siteId: this.siteId,
        username: this.user.username
      }, function(err, permits){
        if(err) return self.error(err);
        self.next(permits, "permits");
      });
    },
    lookupUser: function() {
      var self = this;
      models.users.findOne({username: this.username}, function(err, user){
        if(err) return self.error(err);
        self.next(user, "user");
      });
    },
    passwordAuthenticates: function(user) {
      var self = this;
			user.comparePassword(this._body.password, function(err, isMatch) {
			 err ? self.error(err) : self.next(!!isMatch && isMatch === true);
			});  
    },
    sendCredentials: function() {
      var self = this;
      this.next({
        statusCode: 200,
  			body: {
  			    domain: self._domain,
  			    user: this.cookieUserId.concat(";", this.cookieToken)
  			},
  			headers: {
        	"Access-Control-Allow-Origin" : "*",
        	"Access-Control-Allow-Credentials" : true
  			},
  			multiValueHeaders: {
          "Set-Cookie": [ this.cookieToken, this.cookieUserId, this.cookiePermits, this.cookieSheets ]
  			}
  		});
    },
    userDoesntExist: function(user) {
      this.next(!user);
    }
  },
  instruct: [
    "lookupUser",
    {
      if: "userDoesntExist",
      true: "alertUserDoesntExist",
      false: [
        {
          if: "passwordAuthenticates",
          true: [
            "getUserPermitsForSite",
            "createCookies",
            "sendCredentials"
          ],
          false: "alertPasswordsDontMatch"
        }
      ]
    }
  ]
});
global.logout = new Chain({
  steps: {
    createLogoutCookies: function() {
      var cookieOptions = { secure: true, httpOnly: true, maxAge: 0, domain: this._domain, path: "/" };
      this.cookieToken = cookie.serialize("token", "", cookieOptions);
      this.cookieUserId = cookie.serialize("userid", "", cookieOptions);
      this.cookiePermits = cookie.serialize("permits", "", cookieOptions);
      this.next();     
    },
    sendLogout: function() {
      this.next({
        statusCode: 200,
  			body: {
  			    success: true,
  			    message: "<(-_-)> Logged out, you have become;"
  			},
  			headers: {
        	"Access-Control-Allow-Origin" : "*",
        	"Access-Control-Allow-Credentials" : true
  			},
  			multiValueHeaders: {
          "Set-Cookie": [ this.cookieToken, this.cookieUserId, this.cookiePermits, this.cookieSheets ]
  			}
  		});   
    }
  },
  instruct: [
    "createLogoutCookies",
    "sendLogout"
  ]
});
global.model = new Chain({
  input: function() {
    return {
      sheetName: this._arg1
    };
  },
  steps: {
    collectionExists: function() {
      this.modelIndex = mongoose.modelNames().indexOf(this.collectionName);
      this.next(this.modelIndex > -1);
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
    relayNativeModel: function() {
      this.model = models[this.sheetName];
      this.next(this.model);
    },
    sheetNameIsNative: function() {
      this.next(!!models[this.sheetName]);
    }
  },
  instruct: [
    "checkDbPermit",
    {
      if: "sheetNameIsNative",
      true: "relayNativeModel",
      false: [
        "grabSheet",
        function() {
          this.collectionName = this.siteId+"_"+this.sheetName+"_"+JSON.stringify(this.sheet._id);
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
global.permits = new Chain({
  input: function() {
    return {
      sheetName: this._arg1 || "sheets",
      id: this._arg2
    };
  },
  steps: {
    alertPermitExcludesMethod: function() {
      this.end("<(-_-)> Method is prohibited, your permit says.");
    },
    alertNoUsernameSpecified: function() {
      this.end("<(-_-)> First specify a username for your permit, you must.");
    },
    alertPermitAlreadyExists: function() {
      this.end("<(-_-)> Already in archives, " + this._body.username + "'s permit is.");
    },
    deletePermit: function() {
      var self = this;
      permits.findByIdAndRemove(this.id).then(function(deleted){
        self.next({
          message: "<(-_-)> Erased from archives, permit has become.",
          body: deleted
        });
      });
    },
    getPermissions: function() {
      var self = this;
      permits.find({
        siteId: this.siteId,
        sheetName: this.sheetName
      }, function(err, permits){
        if(err) return self.error(err);
        self.next(permits);
      });
    },
    noUsernameSpecified: function() {
      this.next(!this._body.username);
    },
    permitAlreadyExists: function() {
      var self = this;
      permits.findOne({
        username: this._body.username,
        siteId: this.siteId,
        sheetName: this.sheetName
      }).then(function(permit){
        self.next(!!permit);
      });
    },
    permitExcludesMethodForPermit: function() {
      this.next(this.permit.permit.methods.indexOf(this._eventMethod) == -1);
    },
    postNewPermit: function() {
      var self = this,
          defaults = {
            methods: { methods: ["get", "put", "post", "delete"] },
            ui: { apps: ["all"] }
          },
          body = {
            username: this._body.username,
            siteId: this.siteId,
            sheetName: this.sheetName,
            db: this._body.db || defaults.methods,
            ui: this._body.ui || defaults.ui,
            permit: this._body.permit || defaults.methods
          };
      permits.create(body, function(err, newPermit){
        if(err) return self.error(err);
        self.next(newPermit);
      });
    },
    updatePermit: function() {
      var self = this;
      permits.findByIdAndUpdate(this.id, this._body, { new: true }, function(err, updatedPermit){
        if(err) return self.error(err);
        self.next(updatedPermit);
      });
    }
  },
  instruct: [
    "getUserPermitForSheet",
    { if: "permitExcludesMethodForPermit", true: "alertPermitExcludesMethod" },
    {
      switch: "toRouteMethod",
      get: "getPermissions",
      post: [
        { if: "noUsernameSpecified", true: "alertNoUsernameSpecified" },
        { if: "permitAlreadyExists", true: "alertPermitAlreadyExists" },
        "postNewPermit"
      ],
      put: "updatePermit",
      delete: "deletePermit"
    }
  ]
});
global.schema = new Chain({
  describe: "gets schema obj from sheeet, ready to convert into model",
  input: function() {
    return {
      sheetName: this._arg1,
      types: { "string": String, "number": Number, "date": Date, "boolean": Boolean, "array": Array }
    };
  },
  steps: {
    convertToFuncion: function() {
      this.obj[this.key] = this.convert;
      this.next();
    },
    formatAllowed: function() {
      this.convert = this.types[this.value];
      this.next(!!this.convert);
    },
    forEachItemInSchema: function() {
      this.sheet.db = this.sheet.db || {};
      this.schema = this.sheet.db.schema || { noKeysDefined: "string"};
      this.stringSchema = Object.assign({}, this.schema);
      this.next(this.schema);
    }
  },
  instruct: [
    "checkDbPermit",
    "grabSheet",
    "forEachItemInSchema", [
      { if: "formatAllowed", true: "convertToFuncion" }  
    ],
    function() {
      this.next(this.stringSchema);
    }
  ]
});
global.serve = new Chain({
  input: {
		types: {
			css: "text/css",
			html: "text/html",
			js: "application/javascript",
			javascript: "application/javascript",
			default: "application/javascript"
		},
		format: { 
		  statusCode: 200,
		  headers:{
        "Access-Control-Allow-Origin": "*"
		  }
		}
  },
  steps: {
    addContentTypeToHeaders: function(res) {
      this.format.headers["Content-Type"] = res.type || res["Content-Type"];
      this.next(res.body || "Empty, your body content is.");
    },
    addBodyToFormatObj: function(res) {
      this.format.body = res;
      this.next();
    },
    assignCustomHeaders: function(res) {
      this.format.headers = res.headers;
      this.next(res.body);
    },
    assignFullyCustomResonse: function(res) {
      this.format = res;
      this.next();
    },
    bodyIsNotString: function() {
      this.next(typeof this.format.body !== "string");
    },
    formatContentType: function(res) {
    	var type = this.types[res.type] || res.type;
    	res.type = type || this.types.default;
    	this.next();
    },
    formatObject: function(res) {
      this.format = {
        statusCode: 200,
        body: res
      };
      this.next(res);
    },
    hasCustomHeaders: function(res) {
      this.next(!!res.headers);    
    },
    initCallback: function() {
      this._callback(null, this.format);
    },
    isFullyCustom: function(res) {
      this.next(!!res.statusCode);
    },
    itDoesntHaveFormatting: function(res) {
      var hasId = !!res._id; // if is hasId it doesnt have formatting
      this.next(hasId || (!res.type && !res.headers));
    },
    renderVariables: function(res) {
      for(var key in res.data) {
        if(!!res.data[key]) {
          var replacer = new RegExp("{{ "+key+" }}", "g"),
              replacement = res.data[key];
          if(typeof replacement !== "string") replacement = JSON.stringify(replacement);
					res.body = res.body.replace(replacer, replacement);  
        }
      }
      this.next(res);
    },
    stringifyBody: function() {
      this.format.body = JSON.stringify(this.format.body);
      this.next();
    },
    thereAreVariables: function(res) {
      this.next(!!res.data);
    }
  },
  instruct: [
  	{
  	  if: "itDoesntHaveFormatting",
  	  true: "addBodyToFormatObj",
  	  false: [
  	    {
  	      if: "isFullyCustom",
  	      true: "assignFullyCustomResonse",
  	      false: [
  	        "formatContentType",
  	        { if: "thereAreVariables", true: "renderVariables" },
            {
      	      if: "hasCustomHeaders",
      	      true: [ "assignCustomHeaders", "addBodyToFormatObj" ],
      	      false: [ "addContentTypeToHeaders", "addBodyToFormatObj" ]
      	    }         
          ]
  	    }
      ]
  	},
    { if: "bodyIsNotString", true: "stringifyBody" },
  	"initCallback"
  ]
});
global.renderLandingPage = new Chain({
  steps: {
    showIndex: function() {
      this.next({
        data: {
          domain: this._domain,
          host: this._host,
          cookie: this._cookie,
          siteName: this._siteName,
          sheets: this.sheets,
          username: this.user.username,
          user: this.user
        },
        body: tmplts.index,
        type: "text/html"
      });
    }
  },
  instruct: "showIndex"
});
global.renderUserLibrary = new Chain({
  input: {
    userSites: []
  },
  steps: {
    appendToUserSites: function(userSite) {
      this.userSites.push(userSite);
      this.next();
    },
    getAllPermitsForUser: function() {
      var self = this;
      permits.find({
        username: this.user.username
      }, function(err, permits){
        if(err) return self.error(err);
        self.userPermits = permits;
        self.next();
      });
    },
    getUniqueSiteIds: function() {
      var uniqueSiteIds = [];
      for(var i=0; i<this.userPermits.length; i++) {
        var permit = this.userPermits[i];
        if(uniqueSiteIds.indexOf(permit.siteId) == -1) {
          uniqueSiteIds.push(permit.siteId);
        }
      }
      this.next(uniqueSiteIds);
    },
    getUserSite: function() {
      var self = this;
      models.sites.findById(this.userSiteId, function(err, userSite) {
        if(err) return self.error(err);
        self.next(userSite, "userSite");
      });
    },
    renderLibrary: function() {
      this.next({
        body: tmplts.library,
        type: "html",
        data: {
          domain: this._domain,
          host: this._host,
          username: this.user.username,
          user: this.user,
          userSites: this.userSites,
          siteName: "<(-_-)> Archives, of yours"
        }
      });
    }
  },
  instruct: [
    "getAllPermitsForUser",
    "getUniqueSiteIds", loop([
      "define=>userSiteId",
      "getUserSite",
      "appendToUserSites"
    ]),
    "renderLibrary"
  ]
});
global.signup = new Chain({
  input: function() {
    return {
      newUser: this._body
    };
  },
  steps: {
    saveUserToDb: function() {
      var self = this;
      models.users.create(this.newUser, function(err, newUser){
        if(err) return self.error(err);
        self.next(newUser);
      });
    }
  },
  instruct: [
    "saveUserToDb" // , sendConfirmationEmail
  ]
});
global.scripts = new Chain({
  input: function() {
    return {
      sheetName: this._arg1,
      scriptName: this._arg2
    };
  },
  steps: {
    renderJavascript: function() {
      this.next({
        body: this.sheet.ui.js,
        type: "javascript"
      });
    },
    renderSpecificScriptText: function() {
      var self = this,
          template = this.sheet.ui.temptates.findOne({
            name: self.scriptName
          });
      this.template = template || {};
      this.next({
        body:  template.text,
        type: template.type || "javascript"
      });
    },
    noScriptSpecified: function() {
      this.next(this.scriptName === undefined);
    },
    renderFileScript: function() {
      this.end({
        body: this.fileText,
        type: this.fileType,
        data: {
          domain: this._domain,
          host: this._host,
          cookie: this._cookie,
          siteName: this._siteName,
          sheets: this.sheets,
          username: this.user.username,
          user: this.user,
          userid: this.user._id
        }
      });
    },
    sheetNameIsFileScript: function() {
      this.fileType = this.sheetName.split(".")[1];
      this.fileName = this.sheetName.split(".")[0];
      this.fileText = tmplts[this.sheetName];
      this.next(!!this.fileType && !!this.fileText);
    }
  },
  instruct: [
    { if: "sheetNameIsFileScript",  true: "renderFileScript"  },
    "grabSheet",
    {
      if: "noScriptSpecified",
      true: "renderJavascript",
      false: "renderSpecificScriptText"
    }
  ]
});
global.port = new Chain({
  input: function() {
    return {
      permits: JSON.parse(this._cookies.permits || "[]"),
      sheets: [],
      user: {
        username: "public"
      }
    };
  },
  steps: {
    addDetails: function(last, next) {
      var index = Object.assign({}, this._memory.storage);
      delete index._callback;
      next(index);
    },
    isVerbose: function(res, next) {
      next(this._query.verbose);
    },
    loadUser: function() {
      var self = this;
      this.userid = this._cookies.userid;
      models.users.findById(this.userid, function(err, user){
        if(err) return self.error(err);
        if(!user) return self.error("<(-_-)> Not existing in archives, user "+ self.userid +" is.");
        self.user = user;
        self.next();
      });
    },
    loggedOut: function() {
      var self = this;
      jwt.verify(this._cookies.token, this.user.password, function (tokenErr, decoded) {
  			self.next(!!tokenErr);
  		});
    },
    lookupSiteInDb: function(res, next) {
      var self = this;
      models.sites.findOne({
        name: self._siteName
      }).then(function(site){
        if(site) {
          self.site = site;
          self.siteId = site.id; 
        }
        next(site);
      });
    },
    noSiteExists: function(site, next) {
      next(!site);
    },
    noSiteSpecified: function() {
      this.next(!this._siteName);
    },
    renderLoggedOut: function() {
      this.next({
        body: tmplts.login,
        type: "html",
        data: {
          siteName: "<(-_-)> Login, you must.",
          domain: this._domain,
          host: this._host,
          username: this.user.username,
          user: this.user
        }
      });
    },
    renderNoSiteExists: function(res, next) {
      next({
        body: "<h1><(-_-)> Not Existing In Archives Site, " + this._siteName + " Is.</h1>", 
        type: "text/html"
      });
    },
    renderNoPermitsExistForSite: function() {
      this.next({
        body: "<(-_-)> Enter this site you will, when permits for it you have.",
        type: "html"
      });
    },
    renderWelocomeToUiSheet: function() {
      this.next({
        body: tmplts.login,
        type: "html",
        data: {
          siteName: "<(-_-)> Welcome, you are.",
          domain: this._domain,
          host: this._host,
          username: this.user.username,
          user: this.user
        }
      });
    },
    runChain: function(res, next) {
      var self = this,
          chainName = this._chain,
          chain = global[chainName];
      if(!chain) return this.error("<(-_-)> Not existing in archives, chain " + chainName + " is.");
      chain.import(this._memory.storage).start().then(function(memory){
        memory._endChain = false;
        self._memory.import(memory);
        self.next(memory.last);
      }).catch(function(err){
        self.error(err);
      });
    },
    urlHasAChain: function(res, next) {
      next(!!this._chain);
    },
    userHasCookies: function() {
      this.next(!!this._cookies.userid);
    },
    userHasNoPermitsForSite: function() {
      this.next(this.permits.length == 0);
    },
    userIsPublic: function() {
      this.next(this.user.username == "public");
    }
  },
  instruct: [
    "connectToDb",
    {
      if: "userHasCookies",
      true: [
        "loadUser",
        { if: "loggedOut", true: ["renderLoggedOut", "serve"] }
      ]
    },
    {
      if: "noSiteSpecified",
      true: [
        {
          if: "userIsPublic",
          true: "renderWelocomeToUiSheet",
          false: "renderUserLibrary"
        },
        "serve"
      ]
    },
    "lookupSiteInDb",
    { if: "noSiteExists", true: [ "renderNoSiteExists", "serve" ] },
    {
      if: "userHasNoPermitsForSite",
      true: [
        "lookupPublicPermitsForSite",
        { if: "userHasNoPermitsForSite", true: [ "renderNoPermitsExistForSite", "serve" ] }
      ]
    },
    "getSheetForEachPermit",
    {
      if: "urlHasAChain",
      true: "runChain",
      false: "renderLandingPage"
    },
    { if: "isVerbose", true: "addDetails" },
    "serve"  
  ]
});

module.exports.port = function(event, context, callback) {
  context.callbackWaitsForEmptyEventLoop = false;
  var params = event.pathParameters || {};
  global.port.import({
    _arg1: params.arg1,
    _arg2: params.arg2,
    _body: JSON.parse(event.body || "{}"),
    _callback: callback,
    _chain: params.chain,
    _context: context,
    _cookie: event.headers.Cookie || "not having cookie, you are.",
    _cookies: cookie.parse(event.headers.Cookie || "{}") || "not having cookie, you are.",
    _domain: event.requestContext.domainName,
    _event: event,
    _headers: event.headers || {},
    _host: "https://"+event.headers.Host+"/dev/"+(params.site || ""),
    _eventMethod: event.httpMethod.toLowerCase(),
    _query: event.queryStringParameters || {},
    _siteName: params.site
  }).start().catch(function(error){
    callback(null, {
      statusCode: 200,
      body: error.stack || error
    });
  });
};
} catch (e) {
  module.exports.port = function(event, context, callback) {
    callback(null, {
      statusCode: 200,
      body: e.stack || e
    });    
  };
}
