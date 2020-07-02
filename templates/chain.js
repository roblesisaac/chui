function addMethodToArray(name, fn) {
  Object.defineProperty(Array.prototype, name, {
    enumerable: false,
    writable: true,
    value: fn
  });
}
function itemMatches(item, filter) {
  var matches = [];
  for(var key in filter) if(filter[key] !== undefined) matches.push(filter[key] === item[key]);
  return matches.indexOf(false) === -1; 
}
addMethodToArray("find", function(filter){
  var match = [];
  for (var i = 0; i<this.length; i++) {
    if(itemMatches(this[i], filter)) match.push(this[i]);
  }
  return match;  
});
addMethodToArray("findOne", function(filter){
  var match = null;
  for (var i = 0; i<this.length; i++) {
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
  
  for(var key in obj) {
    if(obj[key] !== undefined) {
      var val = obj[key];
      
      if(Array.isArray(val)) {
        for(var i in val) {
          if(val[i] !== undefined) {
           var item = val[i];
           typeof item !== "object"
              ? fn(val, i, item, parent)
              : Object.loop(item, fn, parent);
          }
        }
      } else if(typeof val === "object") {
        Object.loop(val, fn, parent);
      } else {
        fn(obj, key, val, parent); 
      }
    }
  }
  
  return obj;
};
var obj = function(o) {
  for (var key in o) {
  	if(o[key] !== undefined) this[key] = o[key];
  }
};
obj.prototype.loop = Object.loop;
function loop(arr) {
  return { async: arr };
}

function Chain(master) {
  if(Array.isArray(master)) {
    this.build({ instruct: master });
  } else if(typeof master == "object") {
    this.build(master);
  } else {
    this.build({ instruct: [master] });
  }
}
Chain.prototype.format = {
  intoArray: function(instruct, args) {
    if(typeof instruct == "function") instruct = instruct.apply(this.library.steps, args);
    return Array.isArray(instruct)
      ? instruct
      : [instruct];
  }
};
Chain.prototype.build = function(master) {
  if(master.steps) Object.assign(this.library.steps, master.steps);
  this._master = master;
  this.learn = master.learn;
  this.input = !master.input
              ? function() { return {}}
              : typeof master.input == "function"
              ? master.input
              : Array.isArray(master.input) || typeof master.input !== "object"
              ? function() {return {input: master.input}}
              : function() {return JSON.parse(JSON.stringify(master.input))};
  this.instruct = master.instruct || [];
  for(var key in master) {
    if(master[key] && ["input", "steps", "learn", "instruct", "start"].indexOf(key)<0) {
      this[key] = this.addVariation(master, key);  
    }
  }
};
Chain.prototype.library = {
  steps:{
    call: function(stepName) {
      var args = [];
      for (var i=0; i<arguments.length; i++) {
        if(i > 0) args.push(arguments[i]);
      }
      return {
        stepName: stepName,
        args: args.length > 0 ? args : "res"
      };
    },
    end: function() {
      this.end(); 
    }
  }
};
Chain.prototype.addVariation = function(master, key) {
  var variation = master[key];
  return function() {
    var instruct = this.format.intoArray.apply(this, [variation, arguments]);
    return new Chain({
      input: master.input,
      instruct: instruct
    }).start();
  }
};
Chain.prototype.start = function(overwrites, number) {
  var self = !this._parent // only instances have a _parent
            ? new Instance(this)
            : this;
  if(overwrites) self.import(overwrites);
  return new Promise(function(resolve, reject) {
    self.automate(number).output(function(instance){
      if(instance.error) return reject(instance.error);
      resolve(instance.memory.storage);
    });
  });
};
Chain.prototype.import = function(overwrites, options) {
  var instance = !this._parent
                 ? new Instance(this, overwrites)
                 : this;
  if(options && options.exclude) instance.memory.exclude(options.exclude);
  instance.memory.import(overwrites);
  return instance;
};
    
function Instance(chain, overwrites) {
  this._parent = chain;
  this.input = chain.input;
  this.instructions = new Instructions(chain.instruct);
  this.memory = new Memory([chain.input.call(overwrites), overwrites]);
  this.memory.exclude(Object.keys(this.step()));
  this.resolved = false;
}
Instance.prototype = Object.create(Chain.prototype);
Instance.prototype.automate = function(number) {
  var instance = this,
      instructions = instance.instructions,
      storage = instance.memory.storage,
      stepName = instructions.nextStepName(number, instance), // next step in line or specific number
      step = instance.step(stepName);
      
  if(instructions.completed(instance)) {
    if(instance._parent.learn) Object.assign(instance._parent, storage);
    instance.resolve();
    return instance;
  }
  
  if(step._is("aChain")) {
    var nestedChain = step._name;
    nestedChain.import(storage).start()
      .then(instance.continue.bind(instance)).catch(step.error);
    return instance;
  }
  
  if(step._is("aCondition")) {
    step._getAnswer(function(answer) {
      instance.memory.import(this);
      new Chain({ instruct: step._name[answer] }).import(storage).start()
        .then(instance.continue.bind(instance)).catch(step.error);
    });
    return instance;
  }
  
  if(step._is("aLoop")) {
    step.completeTheLoop({
      async: step._name.async,
      stepName: step._name,
      list: storage.last
    }).then(function() {
      instance.error
        ? instance.resolve()
        : instance.automate();
    });
    return instance;
  }
  
  if(step._is("aDefinition")) {
    var definition = {},
        key = step._name.replace("define=>", ""),
        item = storage.item;
    definition[key] = item;
    instance.memory.import(definition);
    instance.automate();
    return instance;
  }
  
  step._method();
  return instance;
};
Object.defineProperty(Instance.prototype, 'constructor', { value: Instance, enumerable: false, writable: true });
Instance.prototype.step = function(stepName) {
  var instance = this,
      storage = this.memory.storage,
      end = function(res) {
        storage._endChain = true;
        storage.last = res;
        instance.resolve();
      };
  return {
    _name: stepName,
    completeTheLoop: function(schema) {
      return new Promise(function(resolve, reject) {
        var nestedInstructions = schema.async ? schema.stepName.async : schema.stepName,
            loopChain = new Chain(nestedInstructions),
            list = schema.list,
            err,
            finished = function() {
              resolve(err);
            },
            catchErr = function(e) {
              if(!instance.error) instance.error = e;
            };
        if(Array.isArray(list) || typeof list !== "object") {
          if(stepName.async) {
            list.loop(function(i, item, nxt) {
              loopChain.import(storage)
                .import({i: i, item: item, list: list})
                .start()
                .then(nxt).catch(catchErr);
            }).then(finished);
          } else {
            for(var i=0; i<list.length; i++) {
              loopChain.import(storage)
                .import({i: i, item: list[i], list: list})
                .start().catch(catchErr);
            }
            finished();
          }
        } else if(typeof list == "object") {
          Object.loop(list, function(obj, key, val) {
            loopChain.import(storage)
              .import({obj:obj, key: key, value: val})
              .start().catch(catchErr);
          });
          finished();
        }
      });
    },
    error: function(e) {
      instance.error = e;
      instance.resolve();      
    },
    resolve: end, end: end, done: end,
    _getAnswer: function(next) {
      var condition = stepName.if !== undefined
                      ? stepName.if
                      : stepName.switch;
      if(typeof condition == "boolean") return next(condition);
      this._method({ 
        stepName: condition,
        data: {next: next} 
      });
    },
    input: function() {
      return instance.input.call(storage);
    },
    _is: function(condition) {
      var self = this;
      return {
        aDefinition: function(){
          return stepName.includes && stepName.includes("define=>"); 
        },
        aChain: function(){
          var nested = stepName;
          if(typeof stepName == "string") nested = globalThis[stepName];
          if(nested && !!nested._master) {
            self._name = nested;
            return true;
          }
          return false;
        },
        aCondition: function() {
          return stepName.if !== undefined || stepName.switch !== undefined;
        },
        aLoop: function() {
          return Array.isArray(stepName) || stepName.async;
        }
      }[condition]();
    },
    next: function(returned, keyname) {
      if(keyname) this[keyname] = returned;
      instance.memory.import(this);
      if(arguments.length > 0 ) {
        storage.last = returned;
        storage.lastStepNameWithRes = stepName;
        storage.args = arguments;
      }
      instance.automate();
    },
    _memory: instance.memory,
    _method: function(options) {
      instance.memory.updateExpecting(instance.input);
      var data = Object.assign({}, storage, this, (options || {}).data),
          _stepName = options && options.stepName
                        ? options.stepName : stepName.stepName || stepName,
          step = typeof _stepName == "string"
                    ? instance.library.steps[_stepName]
                    : _stepName;
      if(!step) {
        this.error("<(-_-)> Not in archives, step " + _stepName + " is.");
        return;
      }
      var res = data.last,
          next = data.next || this.next,
          vm = instance.memory.vue;
      try {
        if(stepName.args) {
          var args = stepName.args == "res" ? storage.args : stepName.args;
          step.apply(data, args);
        } else {
          step.call(data, res, next.bind(data), vm, data.lastStepNameWithRes);
        }
      } catch(err) {
        this.error(err);
      }
    }
  };
};
Instance.prototype.continue = function(storage) {
  this.memory.import(storage);
  storage._endChain ? this.resolve() : this.automate();
};
Instance.prototype.resolve = function() {
  this.resolved = true;
  if(this.promise) this.promise(this);
};
Instance.prototype.output = function(fn) {
  if(!fn) return;
  
  this.resolved
    ? fn(this)
    : this.promise = fn;
};

function Instructions(instruct) {
  this.instruct = instruct;
  this.progress = -1;
}
Instructions.prototype.format = {
  intoArray: function(instruct) {
    if(typeof instruct == "function") instruct = instruct.call(this.library.steps, this.memory.storage);
    return Array.isArray(instruct) ? instruct : [instruct];
  }
};
Instructions.prototype.completed = function(instance) {
  return this.progress === (this.format.intoArray.call(instance, this.instruct).length);
};
Instructions.prototype.nextStepName = function(number, instance) {
  number === undefined ? this.progress++ : this.progress = number;
  return this.format.intoArray.call(instance, this.instruct)[this.progress];
};

function Memory(data) {
  this.exclusions = [];
  this.expecting = [];
  this.storage = {};
  if(!Array.isArray(data)) data = [data];
  for(var i=0; i<data.length; i++) this.init(data[i]);
}
Memory.prototype.exclude = function(arr) {
  if(!arr) return;
  if(!Array.isArray(arr)) arr = [arr];
  this.exclusions = this.exclusions.concat(arr);
};
Memory.prototype.init = function(data) {
  data = this.format(data);
  for(var key in data) {
    if(data[key] === undefined) {
      this.expecting.push(key);  
    } else {
      this.storage[key] = data[key];
    }
  }
};
Memory.prototype.updateExpecting = function(inputFn) {
  if(this.expecting.length==0) return;
  for(var i=0; i<this.expecting.length; i++) {
    var key = this.expecting[i],
        val = inputFn.call(this.storage)[key];
    if(!!val) {
      this.storage[key] = val;
      var expectIndex = this.expecting.indexOf(key);
      this.expecting.splice(expectIndex, 1);   
    }
  }
};
Memory.prototype.format = function(data) {
  return typeof data == "function"
         ? data()
         : !data
         ? {}
         : Array.isArray(data) || typeof data !== "object"
         ? { input: data }
         : data;
};
Memory.prototype.keys = function(obj) {
  var self = this,
      keys = Object.keys(obj);
  return {
    keys: keys,
    excludes: function(key) {
      return keys.indexOf(key) == -1; 
    },
    notInExclusions: function(key) {
      return self.exclusions.indexOf(key) == -1;
    }
  };
};
Memory.prototype.import = function(data) {
  data = this.format(data);
  var nativeKeys = this.keys(this);
  for(var key in data) {
    if(nativeKeys.excludes(key) && nativeKeys.notInExclusions(key)) {
      this.storage[key] = data[key];
    }
  }
};

if(!globalThis.module) globalThis.module = {};
module.exports = Chain;
