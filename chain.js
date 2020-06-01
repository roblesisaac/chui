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
    this.build({ instructions: master });
  } else if(typeof master == "object") {
    this.build(master);
  } else {
    this.build({ instructions: [master] });
  }
}
Chain.prototype.build = function(master) {
  this._master = master;
  this.learn = master.learn;
  this.input = !master.input
              ? function() { return {}}
              : typeof master.input == "function"
              ? master.input
              : Array.isArray(master.input) || typeof master.input !== "object"
              ? function() {return {input: master.input}}
              : function() {return Object.assign({}, master.input)};
  this.instructions = !master.instructions
                      ? []
                      : Array.isArray(master.instructions)
                      ? master.instructions
                      : [master.instructions];
  if(master.steps) Object.assign(this.library.steps, master.steps);  
};
Chain.prototype.library = {steps:{}};
Chain.prototype.automate = function(number) {
  var instance = !this._parent // only instances have a _parent
            ? new Instance(this)
            : this,
      instructions = instance.instructions,
      step = instance.step(instructions.nextStepName(number)); // get next step in line or specific number

  if(instructions.completed()) {
    if(instance._parent.learn) Object.assign(instance._parent, instance.memory.storage);
    instance.resolve();
    return instance;
  }
  
  if(step._is("aChain")) {
    var nestedChain = step._name;
    instance.memory.import(nestedChain.input.bind(instance.memory.storage));
    instructions.insert(nestedChain.instructions);
    instance.automate();
    return instance;
  }
  
  if(step._is("aCondition")) {
    step._getAnswer(function(answer) {
      instance.memory.import(this);
      var switcher = step._name[answer];
      if(switcher) instructions.insert(switcher);
      instance.automate();
    });
    return instance;
  }
  
  if(step._is("aLoop")) {
    step.completeTheLoop({
      async: step._name.async,
      stepName: step._name,
      list: instance.memory.storage.last
    }).then(function() {
      instance.error
        ? instance.resolve()
        : instance.automate();
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
      if(instance.error) return reject(instance.error);
        
      resolve(instance.memory.storage);
    });
  });
};
Chain.prototype.import = function(overides) {
  var instance = !this._parent
                 ? new Instance(this, overides)
                 : this;
  instance.memory.import(overides);
  return instance;
};
    
function Instance(chain, overides) {
  this._parent = chain;
  this.input = chain.input;
  this.instructions = new Instructions(chain.instructions);
  this.memory = new Memory([chain.input.call(overides), overides]);
  this.memory.exclude(Object.keys(this.step()));
  this.resolved = false;
}
Instance.prototype = Object.create(Chain.prototype);
Object.defineProperty(Instance.prototype, 'constructor', { value: Instance, enumerable: false, writable: true });
Instance.prototype.step = function(stepName) {
  var instance = this,
      storage = this.memory.storage;
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
    _getAnswer: function(next) {
      var condition = stepName.if;
      if(typeof condition == "boolean") {
        return next(condition);
      }
      var data = Object.assign({}, storage, this, {next: next});
      this._method(instance.library.steps[condition], data);
    },
    input: function() {
      return instance.input.call(storage);
    },
    _is: function(condition) {
      var self = this;
      return {
        aChain: function(){
          var nestedChain = stepName;
          if(typeof stepName == "string") {
            typeof global == "undefined"
              ? nestedChain = window[stepName]
              : nestedChain = global[stepName];
          }
          if(nestedChain && nestedChain._master !== undefined) self._name = nestedChain;
          return self._name._master !== undefined;
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
      if(keyname) storage[keyname] = returned;
      instance.memory.import(this);
      storage.last = returned;
      instance.automate();
    },
    _memory: instance.memory,
    _method: function(step, data) {
      instance.memory.checkExpecting(instance.input);
      data = data || Object.assign({}, storage, this);
      step = step || instance.library.steps[stepName];
      var res = data.last,
          next = data.next || this.next,
          vm = instance.memory.vue;
      if(typeof stepName == "function") step = stepName;
      try {
        if(!step) return this.error("No step " + stepName);
        step.call(data, res, next, vm);
      } catch(err) {
        this.error(err);
      }
    }
  };
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
};

function Memory(data) {
  this.exclusions = [];
  this.expecting = [];
  this.storage = {};
  if(!Array.isArray(data)) data = [data];
  for(var i=0; i<data.length; i++) this.init(data[i]);
}
Memory.prototype.exclude = function(arr) {
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
Memory.prototype.checkExpecting = function(inputFn) {
  if(this.expecting.length==0) return;
  for(var i=0; i<this.expecting.length; i++) {
    var key = this.expecting[i],
        val = inputFn.call(this.storage)[key];
    if(val !== undefined) {
      this.storage[key] = val;
      var expectIndex = this.expecting.indexOf(key);
      this.expecting.splice(expectIndex, 1);   
    }
  }
}
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

if(typeof module === "undefined") module = {};
module.exports = Chain;
