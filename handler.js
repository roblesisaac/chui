function addMethodToArray(name, fn) {
  Object.defineProperty(Array.prototype, name, {
    enumerable: false,
    writable: true,
    value: fn
  });  
}
function itemMatches(item, filter) {
  var matches = [];
  for(var key in filter) matches.push(filter[key] === item[key]);
  return matches.indexOf(false) === -1; 
}
addMethodToArray("find", function(filter){
  var match = [];
  for (i = 0; i<this.length; i++) {
    if(itemMatches(this[i], filter)) match.push(this[i]);
  }
  return match;  
});
addMethodToArray("findOne", function(filter){
  var match = null;
  for (i = 0; i<this.length; i++) {
    if(itemMatches(this[i], filter)) {
      match = this[i];
      match.i = i;
      i = this.length;
    }
  }
  return match;
});
addMethodToArray("loop", function(fn, o) {
  if(fn === undefined) return console.log("Please define fn.");
  if(this === undefined) return console.log("Please define array");
  o = o || {
    then: function(fn) {
      if(!this.resolve) this.resolve = fn;
    }
  };
  o.i === undefined ? o.i = 0 : o.i++;
  if(!this[o.i]) {
    if(o.resolve) o.resolve();
    return;
  }
  var self = this;
  fn(o.i, this[o.i], function() {
    setTimeout(function(){
      self.loop(fn, o);
    }, 0);
  });
  return o;
});
if(!Object.loop) Object.loop = function(obj, fn, parent) {
  parent = parent || obj;
  
  for(let key in obj) {
    let val = obj[key];
    
    if(Array.isArray(val)) {
      for(var i in val) {
        var item = val[i];
        if(typeof item !== "object") {
          fn(val, i, item, parent);
        } else {
          Object.loop(item, fn, parent); 
        }
      }
    } else if(typeof val === "object") {
      Object.loop(val, fn, parent);
    } else {
      fn(obj, key, val, parent); 
    }
  }
  
  return obj;

};
var obj = function(o) {
  for (var key in o) this[key] = o[key];
};
obj.prototype.loop = Object.loop;

function loop(arr) {
  return { async: arr };
}

function Chain(format) {
  if(Array.isArray(format)) {
    this.build({ instructions: format });
  } else if(typeof format == "object") {
    this.build(format);
  } else {
    this.build({ instructions: [format] });
  }
}
Chain.prototype.build = function(format) {
  this.input = !format.input
               ? function() { return {}}
               : typeof format.input == "function"
               ? format.input
               : Array.isArray(format.input) || typeof format.input !== "object"
               ? function() {return {input: format.input}}
               : function() {return Object.assign({}, format.input)};
  this.instructions = !format.instructions
                      ? []
                      : Array.isArray(format.instructions)
                      ? format.instructions
                      : [format.instructions];
  this._master = format;
  this.steps = format.steps || {};
  this.learn = format.learn;
  if(format.steps) Object.assign(this.library.steps, format.steps);  
};
Chain.prototype.library = {steps:{}};
Chain.prototype.automate = function(number, instance) {
  instance = this._parent // only instances have a _parent
             ? this
             : new Instance(this);
  
  var instructions = instance.instructions,
      step = instance.step(instructions.nextStepName(number));
      
  if(instructions.completed()) {
    if(instance._parent.learn) Object.assign(instance._parent, instance.memory.clean());
    instance.resolve();
    return instance;
  }
  
  if(step._is("aChain")) {
    var chain = step._chain(step._name);
    instance.memory.import(chain.input);
    instructions.insert(chain.instructions);
    instance.automate();
    return instance;
  }
  
  if(step._is("aCondition")) {
    step._getAnswer(function(answer){
      var switcher = step._name[answer];
      instructions.insert(switcher);
      instance.automate();
    });
    return instance;
  }
  
  if(step._is("aLoop")) {
    step.completeTheLoop({
      async: step._name.async,
      stepName: step._name,
      list: instance.memory.last
    }).then(function(){
      instance.automate();
    });
    return instance;
  }
  
  step._method();
  return instance;
};
Chain.prototype.start = function(number) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.automate(number).output(function(instance){
      if(instance.error) {
        reject(instance.error);
      } else {
        resolve(instance.memory.clean());
      }
    });
  });
};
Chain.prototype.import = function(overides) {
  var instance = new Instance(this, overides);
  return instance;
};
    
function Instance(master, overides) {
  this._parent = master;
  this.input = master.input;
  this.instructions = new Instructions(master.instructions);
  var exclusions = Object.keys(this.step());
  this.memory = new Memory([master.input, overides], exclusions);
  this.resolved = false;
}
Instance.prototype = Chain.prototype;
Instance.prototype.step = function(stepName) {
  var self = this;
  return {
    _chain: function(chainName) {
      return typeof chainName == "string"
            ? global[chainName]
            : chainName;
    },
    _name: stepName,
    completeTheLoop: function(schema) {
      return new Promise(function(resolve, reject) {
        var steps = schema.async ? schema.stepName.async : schema.stepName,
            chain = new Chain(steps),
            list = schema.list,
            iteration = function(i, item, list) {
              chain.input = function() {
                return Object.assign({}, { i: i, item: item, list: list }, self.memory);
              }             
            },
            finished = function() {
              chain.error ? reject(chain.error) : resolve();
            };
        if(stepName.async) {
          list.loop(function(i, item, next) {
            iteration(i, item, list);
            chain.start().then(next);
          }).then(finished);
        } else {
          for(let i in list) {
            iteration(i, list[i], list);
            chain.start();              
          }
          finished();
        }
      });
    },
    set: function(key, val) {
      self.memory._set[key] = val;
    },
    _getAnswer: function(next) {
      var condition = stepName.if;
      if(typeof condition == "boolean") {
        return next(condition);
      }
      var data = Object.assign({}, self.memory, this, {next: next});
      this._method(self.library.steps[condition], data);
    },
    input: function() {
      return self.input.call(self.memory);
    },
    _is: function(condition) {
      return {
        aChain: function(){
          return (stepName && stepName._master || (global[stepName] && global[stepName]._master)) !== undefined;
        },
        aCondition: function() {
          return stepName.if;
        },
        aLoop: function() {
          return Array.isArray(stepName) || stepName.async;
        }
      }[condition]();
    },
    next: function(returned, keyname) {
      if(keyname) this.set(keyname, returned);
      self.memory.import(this);
      self.memory.last = returned;
      self.automate(null, self);
    },
    _memory: self.memory,
    _method: function(step, data) {
      self.memory.import(this.input());
      var data = data || Object.assign({}, self.memory, this),
          step = step || self.library.steps[stepName],
          res = self.memory.last,
          next = this.next.bind(data),
          vm = self.memory.vue;
      if(typeof stepName == "function") step = stepName;
      try {
        step.call(data, res, next, vm);
      } catch(err) {
        self.error = err;
        self.resolve();
      }
    }
  } 
};
Instance.prototype.resolve = function() {
  this.resolved = true;
  if(this.promise) this.promise(this);
}
Instance.prototype.output = function(fn) {
  if(!fn) return;
  
  this.resolved
    ? fn(this)
    : this.promise = fn;
};

function Instructions(array) {
  this.array = array.slice();
  this.progress = -1;
}
Instructions.prototype.completed = function() {
  return this.progress === (this.array.length);
};
Instructions.prototype.nextStepName = function(number) {
  number == undefined
    ? this.progress++  
    : this.progress = number;
  return this.array[this.progress];
};
Instructions.prototype.insert = function(stepsArray) {
  this.array.splice.apply(this.array, [this.progress+1, 0].concat(stepsArray));
}

function Memory(data, exclusions) {
  this._exclusions = (exclusions || []).concat("_exclusions", "_expecting", "_keys", "_set");
  this._expecting = [];
  this._set = {};
  if(!Array.isArray(data)) data = [data];
  for(i in data) this.init(data[i]);
}
Memory.prototype.clean = function() {
  var cleaned = {},
      exclusions = this._exclusions;
  for(var key in this) {
    if(exclusions.indexOf(key) < 0 && !this.__proto__[key]) cleaned[key] = this[key];
  }
  return cleaned;
};
Memory.prototype.init = function(data) {
  data = this.format(data);
  for(key in data) {
    var value = data[key];
    if(value === undefined) {
      this._expecting.push(key);
    } else {
      this[key] = value;
      var expectIndex = this._expecting.indexOf(key);
      if(expectIndex > -1) this._expecting.splice(expectIndex, 1);
    }
  }
};
Memory.prototype.format = function(data) {
  return typeof data == "function"
         ? data()
         : !data
         ? {}
         : data;
};
Memory.prototype._keys = function(obj) {
  var self = this,
      keys = Object.keys(obj);
  return {
    keys: keys,
    excludes: function(key) {
      return keys.indexOf(key) == -1; 
    },
    notInExclusions: function(key) {
      return self._exclusions.indexOf(key) == -1;
    },
    isExpecting: function(key) {
      return self._expecting.indexOf(key) > -1;
    }
  }
};
Memory.prototype.import = function(data) {
  data = this.format(data);
  var nativeKeys = this._keys(this);
  for(var key in data) {
    if(nativeKeys.isExpecting(key) || (nativeKeys.excludes(key) && nativeKeys.notInExclusions(key))) {
      this[key] = data[key];
    }
  }
  Object.assign(this, this._set);
}

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
      this.formats = {
        statusCode: 200,
        body: JSON.stringify("res")
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
      // this.callback(null, this.format);
      this.callback(null, {
        statusCode: 200,
        body: JSON.stringify("test7")
      });
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
    serves: function() {
      this.next();
    }
  },
  instructions: [
    // "connectToDb",
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
    "formatObject",
    "initCallback"
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
    callback(null, JSON.stringify(error));
  });
};
