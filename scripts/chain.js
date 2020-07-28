function Chain(master) {
  if(Array.isArray(master)) {
    this.build({ instruct: master });
  } else if(typeof master == "object") {
    this.build(master);
  } else {
    this.build({ instruct: [master] });
  }
}
Chain.prototype.addStepsToLibrary = function(master) {
  if(master.steps) Object.assign(this.library.steps, master.steps);
};
Chain.prototype.format = { 
  intoArray: function(instruct, args) {
    if(typeof instruct == "function") instruct = instruct.apply(this.library.steps, args);
    return Array.isArray(instruct)
      ? instruct
      : [instruct];
  },
  intoFunction: function(input) {
    return !input
      ? function() { return {}}
      : typeof input == "function"
      ? input
      : Array.isArray(input) || typeof input !== "object"
      ? function() {return {input: input}}
      : function() {return JSON.parse(JSON.stringify(input))};  
  }
};
Chain.prototype.build = function(master) {
  this.addStepsToLibrary(master);
  this._master = master;
  
  this.learn = master.learn || master.state;
  var _input = this.format.intoFunction(master.input || master.state),
      _state = this.format.intoFunction(master.state);
      
  this.input = master.input && master.state
                ? function() {
                    return Object.assign({}, _input.call(this), (master._parent || _state.call(this)));
                  }
                : _input;
  this.state = _state;
  if(this.learn === true) {
    Object.assign(this, this.input());
  }
  if(master.state && master.state !== true && !master._parent) {
    Object.assign(this, _state());
  }
  
  this.instruct = master.instruct || [];
  for(var key in master) {
    if(master[key]) {
      var notNative = ["input", "state", "learn", "steps", "instruct", "start", "_parent"].indexOf(key)<0;
      if(notNative) this[key] = this.addVariation(master, key);  
    }
  }
};
Chain.prototype.addVariation = function(master, key) {
  var variation = master[key],
      _parent = this;
  return function() {
    var instruct = this.format.intoArray.call(this, variation, arguments),
        hasArguments = typeof variation == "function" && arguments.length>0,
        importData = {};
    
    if(hasArguments) importData = this.getArgsKeysAndValues(variation, arguments);
    
    return new Chain({
      _parent: _parent,
      input: _parent._master.input,
      state: _parent._master.state,
      instruct: instruct
    }).import(importData).start();
  };
};
Chain.prototype.getArgsKeysAndValues = function(fn, args) {
  var argNames = fn.toString().match(/\(.*?\)/)[0].replace(/[()\s]/g,'').split(','),
      data = {};
  for(var i=0; i<argNames.length; i++) {
    data[argNames[i]] = args[i];
  }
  return data;
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
  var instance = this._parent
                 ? this
                 : new Instance(this, overwrites);
  if(options && options.exclude) instance.memory.exclude(options.exclude);
  instance.memory.import(overwrites);
  return instance;
};
    
function Instance(chain, overwrites) {
  this._parent = chain._master._parent || chain;
  this.input = chain.input;
  this.instructions = new Instructions(chain.instruct);
  this.memory = new Memory([chain.input.call(overwrites), overwrites]);
  this.memory.exclude(Object.keys(this.step()));
  this.resolved = false;
}
Instance.prototype = Object.create(Chain.prototype);
Instance.prototype.learnWhatsTaught = function(instance, storage) {
  var _parent = instance._parent,
      _state = instance._parent.state();
  if(_parent.learn === true) {
    Object.assign(_parent, storage);
  } else if(!!_state) {
    for(var prop in storage) {
      var propIsInState = Object.keys(_state).indexOf(prop) > -1;
      if(propIsInState) _parent[prop] = storage[prop];
    }
  }
};
Instance.prototype.automate = function(number) {
  var instance = this,
      instructions = instance.instructions,
      storage = instance.memory.storage,
      stepName = instructions.nextStepName(number, instance), // next step in line or specific number
      step = instance.step(stepName);
      
  if(instructions.completed(instance)) {
    instance.learnWhatsTaught(instance, storage);
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
            if(list.length === 0 || !list) return finished();
            list.loop(function(i, item, nxt) {
              loopChain.import(storage)
                .import({i: i, item: item, list: list})
                .start()
                .then(nxt).catch(catchErr);
            }).then(finished);
          } else {
            if(!list) return finished();
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