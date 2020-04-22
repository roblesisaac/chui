// const AWS = require('aws-sdk');
// // http or https
// const http = require('http');
// const agent = new http.Agent({
//   keepAlive: true
// });

// AWS.config.update({
//   httpOptions: {
//     agent
//   }
// });
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

Chain.build("api", {
  steps: {
    getModelNameFromSheet: function() {
      
    }
  },
  order: [
    "lookupSheet",
    "getModelNameFromSheet",
    {
      if: "modelAlreadyExists"
    }
  ]
});
Chain.build("connectToDb", {
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
  input: {
    tokens: process.env.DB
  },
  order: [
    {
      if: "alreadyConnected",
      true: "promiseResolve",
      false: "connect"
    }
  ]
});
Chain.build("login", {
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
  order: [
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
Chain.build("serve", {
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
        self.format.body = self.format.body.replace(new RegExp("{{ "+key+" }}", "g"), res.data[key]);
      }
      this.next(res);
    },
    stringifyBody: function() {
      this.format.body = JSON.stringify(this.format.body);
      this.next();
    },
    initCallback: function() {
      this.context.done(null, {"Cookie": "cookieString"});
      this.callback(null, this.format);
    }
  },
  order: [
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
Chain.build("scripts", {
  input: {
    css: "text/css",
    html: "text/html",
    javascript: "application/javascript",
    defaultTypes: ["text/css", "text/html", "application/javascript"]
  },
  steps: {
    lookupSheet: function() {
      var self = this;
      this.sheetName = this.arg1;
      this.scriptSheet = this.sheets.findOne({
        name: self.sheetName,
        siteId: self.siteId
      });
      this.next(this.scriptSheet);
    },
    noSheetFound: function() {
      this.next(this.scriptSheet === null);  
    },
    sayNoSheetFound: function() {
      this.next({
        body: "<h1>No " + this.sheetName + " found...</h1>",
        contentType: "html"
      });
    },
    noScriptSpecified: function() {
      this.script = this.arg2;
      this.next(this.script === undefined);
    },
    loadJavascript: function() {
      this.next({
        body: this.scriptSheet.js,
        contentType: "application/javascript"
      });
    },
    loadSpecificScriptText: function(findOne) {
      var self = this,
          template = this.scriptSheet.templates.findOne({
            name: self.script
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
  order: [
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
Chain.build("loadLandingPage", {
  steps: {
    showIndex: function() {
      this.next({
        data: {
          host: this.host,
          siteName: this.site.url,
          token: token,
          username: this.username || "public"
        },
        body: tmplts.index,
        contentType: "html"
      });
    }
  },
  order: [
    "showIndex"
  ]
});
Chain.build("port", {
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
    }
  },
  order: [
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
  _port({
    event: event,
    context: context,
    callback: callback,
    siteName: params.site,
    chain: params.chain,
    arg1: params.arg1,
    arg2: params.arg2,
    query: event.queryStringParameters || {},
    body: JSON.parse(event.body || "{}"),
    domain: event.headers.Host,
    host: "https://"+event.headers.Host+"/dev/exhaustbarn"
  });
};
