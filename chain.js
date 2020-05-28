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
      console.log(fn)
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
    var val = obj[key];
    
    if(Array.isArray(val)) {
      for(var i=0; item=val[i]; i++) {
        typeof item !== "object"
          ? fn(val, i, item, parent)
          : Object.loop(item, fn, parent);
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
  this._master = format;
  this.learn = format.learn;
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
  if(format.steps) Object.assign(this.library.steps, format.steps);  
};
Chain.prototype.library = {steps:{}};
Chain.prototype.automate = function(number) {
  var instance = !this._parent // only instances have a _parent
            ? new Instance(this)
            : this,
      instructions = instance.instructions,
      step = instance.step(instructions.nextStepName(number)); // get next step in line or specific number

  if(instructions.completed()) {
    if(instance._parent.learn) Object.assign(instance._parent, instance.memory._storage);
    instance.resolve();
    return instance;
  }
  
  if(step._is("aChain")) {
    var nestedChain = step._name;
    instance.memory.import(nestedChain.input);
    instructions.insert(nestedChain.instructions);
    instance.automate();
    return instance;
  }
  
  if(step._is("aCondition")) {
    step._getAnswer(function(answer){
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
      list: instance.memory._storage.last
    }).then(function(loopChain){
      if(loopChain.error) {
        instance.error = loopChain.error;
        instance.resolve();
      } else {
        instance.automate();
      }
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
        resolve(instance.memory._storage); 
      }
    });
  });
};
Chain.prototype.import = function(overides) {
  var instance = !this._parent
                 ? new Instance(this)
                 : this;
  instance.memory.import(overides, true);
  return instance;
};
    
function Instance(master, overides) {
  this._parent = master;
  this.input = master.input;
  this.instructions = new Instructions(master.instructions);
  var exclusions = Object.keys(this.step());
  this.memory = new Memory([master.input.call(overides), overides], exclusions);
  this.resolved = false;
}
Instance.prototype = Object.create(Chain.prototype);
Object.defineProperty(Instance.prototype, 'constructor', { value: Instance, enumerable: false, writable: true });
Instance.prototype.step = function(stepName) {
  var self = this;
  return {
    _name: stepName,
    completeTheLoop: function(schema) {
      return new Promise(function(resolve, reject) {
        var nestedInstructions = schema.async ? schema.stepName.async : schema.stepName,
            loopChain = new Chain(nestedInstructions),
            list = schema.list,
            err,
            finished = function() { 
              console.log("ERR::",err);
              // resolve(err);
            };
        if(Array.isArray(list) || typeof list !== "object") {
          if(stepName.async) {
            list.loop(function(i, item, nxt) {
              loopChain.import(self.memory._storage)
                .import({i: i, item: item, list: list})
                .start()
                .then(nxt).catch(function(e){
                  console.log(e);
                  if(!err) err = e;
                });
            }).then(finished);
          } else {
            for(var i in list) {
              loopChain.import(self.memory._storage)
                .import({i: i, item: list[i], list: list})
                .start().catch(function(e) {
                  console.log(e);
                  if(!err) err = e;
                });
            }
            finished();
          }
        } else if(typeof list == "object") {
          Object.loop(list, function(obj, key, val) {
            loopChain.import(self.memory._storage)
              .import({obj:obj, key: key, value: val})
              .start().catch(function(e) {
                  if(!err) err = e;
                  console.log("amm",err)
              });
          });
          console.log("FIN::", err);
          finished();
        }
      });
    },
    error: function(e) {
      self.error = e;
      self.resolve();      
    },
    set: function(key, val) {
      self.memory._hardSet[key] = val;
    },
    _getAnswer: function(next) {
      var condition = stepName.if;
      if(typeof condition == "boolean") {
        return next(condition);
      }
      var data = Object.assign({}, self.memory._storage, this, {next: next});
      this._method(self.library.steps[condition], data);
    },
    input: function() {
      return self.input.call(self.memory._storage);
    },
    _is: function(condition) {
      return {
        aChain: function(){
          return (stepName && stepName._master) !== undefined;
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
      self.memory._storage.last = returned;
      self.automate(null);
    },
    _memory: self.memory,
    _method: function(step, data) {
      self.memory.import(this.input());
      var data = data || Object.assign({}, self.memory._storage, this),
          step = step || self.library.steps[stepName],
          res = data.last,
          next = this.next.bind(data),
          vm = self.memory.vue;
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

function Memory(data, exclusions) {
  this._exclusions = exclusions || [];
  this._expecting = [];
  this._hardSet = {};
  this._storage = {};
  if(!Array.isArray(data)) data = [data];
  for(i in data) this.init(data[i]);
}
Memory.prototype.init = function(data) {
  data = this.format(data);
  for(key in data) {
    var value = data[key];
    if(value === undefined) {
      this._expecting.push(key);
    } else {
      this._storage[key] = value;
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
         : Array.isArray(data) || typeof data !== "object"
         ? { input: data }
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
Memory.prototype.import = function(data, overide) {
  data = this.format(data);
  var nativeKeys = this._keys(this);
  for(var key in data) {
    if(overide || nativeKeys.isExpecting(key) || (nativeKeys.excludes(key) && nativeKeys.notInExclusions(key))) {
      this._storage[key] = data[key];
    }
  }
  if(overide) Object.assign(this._hardSet, data);
  Object.assign(this._storage, this._hardSet);
};

if(typeof module === "undefined") module = {};
module.exports = Chain;
