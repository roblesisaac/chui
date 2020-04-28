if(typeof global === "undefined") global = window;
global.l4 = global.l4 || {};
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
addMethodToArray("loop", function(o, vm){
  if(o.fn === undefined) return console.log("Please define fn.");
  if(this === undefined) return console.log("Please define array");
  
  o.i === undefined ? o.i = 0 : o.i++;
  if(!this[o.i]) {
    if(o.done) o.done(vm);
    return;
  }
  var self = this;
  o.fn(o.i, this[o.i], function(vm) {
    if(vm) vm.progress = ((o.i+1) / this.length) * 100; 
    setTimeout(function(){
      self.loop(o, vm);
    }, 0);
  });  
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

var Chain = {
  addStepsGlobally: function(stepsObject) {
    if(!stepsObject) return;
    for(var stepName in stepsObject) {
      Chain.steps[stepName] = Chain.steps[stepName] || stepsObject[stepName];
      global["_"+stepName] = global["_"+stepName] || stepsObject[stepName];
    }    
  },
  build: function(chainName, chainObj) {
    if(Array.isArray(chainObj)) chainObj = {order: chainObj};
    Chain.addStepsGlobally(chainObj.steps);
    Chain["_"+chainName] = chainObj;
    if(!global["_"+chainName]) {
      global["_"+chainName] = function(overRides) {
        Chain.run({
          input: chainObj.input || {},
          output: chainObj.output,
          order: chainObj.order,
          name: chainName,
          data: chainObj.data
        }, overRides);
      };
    }
  },
  currentStep: function(chain) {
    chain.stepNumber === undefined ? chain.stepNumber = 0 : chain.stepNumber++;
    if(!Array.isArray(chain.order)) chain.order = chain.order.split();
    var step = {
      chainName: chain.name,
      number: chain.stepNumber,
      name: chain.order[chain.stepNumber],
      input: chain.input || {},
      output: chain.output,
      blendInputs: function() {
        Object.assign(step.input, Chain["_"+step.name].input || {});
      },
      init: function(name) {
        name = name || this.name;
        var fn = Chain.steps[name];
        if(!fn) {
          console.log("Could not find", name);
          return;
        }
        try {
          if(this.input.error) {
            this.input.last = this.input.error;
            fn.bind(this.input)(this.input.error, this.input.next, this.input.vm);
          } else {
            fn.bind(this.input)(this.input.last, this.input.next, this.input.vm);  
          }
        }
        catch(err) {
          this.input.last = err.stack;
          this.input.error = err.stack;
          this.input.next.bind(this.input)(err.stack);
        }
      },
      incorporateResultSteps: function(result) {
        var fn;

        if(!step.name[result]) {
          fn = function(next) {
            next(chain);
          };
        } else {
          fn = function(next) {
            Chain.insertArrayIntoArray(chain.order, step.name[result], step.number,
            function(newArray) {
              next({
                name: chain.name,
                stepNumber: step.number-1,
                input: step.input,
                output: step.output,
                order: newArray
              });
            });            
          };
        }
        
        return {  then: fn  };
      },
      incorporateChainSteps: function() {
        return {
          then: function(next) {
            Chain.insertArrayIntoArray(chain.order, Chain["_"+step.name].order, step.number,
            function(newArray){
              next({
                name: chain.name,
                stepNumber: step.number-1,
                input: step.input,
                output: step.output,
                order: newArray
              }); 
            });  
          }
        };
      },
      isALoop: function() {
        return Array.isArray(step.name) || step.name.loop;
      },
      isIncremental: function() {
        return step.name.loop;
      },
      isConditional: function() {
        return step.name.if !== undefined;
      },
      isAChain: function() {
        return Chain["_"+step.name] !== undefined;
      },
      next: function(last) {
        step.input.last = last;
        Chain.iterate(chain);
      },
      resolveCondition: function(next) {
        if(typeof step.name.if === "boolean") {
          next(step.name.if);
        } else {
          step.input.next = next;
          step.init(step.name.if); 
        }
      }
    };
    
    step.input.next = step.next;
    
    return step;
  },
  runChainForItem: function(i, item, nxt) {
    Chain.run({
      input: {
        step: this,
        item: item,
        i: i,
        last: this.input.last
      },
      output: nxt,
      order: this.name.loop || this.name
    });      
  },
  insertArrayIntoArray: function(parent, child, index, next) {
    var copyOfArray = parent.slice();
    Array.prototype.splice.apply(copyOfArray, [index, 1].concat(child));
    if(next) next(copyOfArray);
  },
  iterate: function(chain) {
    let step = Chain.currentStep(chain);
    if(chain.data) {
      Object.assign(chain.input, chain.data.bind(step.input)());
    }
    if(!step.name) { // finished all steps
      var input = step.input;
      if(chain.output) {
        var output = chain.output.bind(input)(input.last, input.next, input.vm);
        if(chain.name) Chain[chain.name] = output || input;
      } else {
        if(chain.name) Chain[chain.name] = input;
      }
      return;
    }
    
    if(step.isConditional()) {
      step.resolveCondition(function(answer) {
        step.incorporateResultSteps(answer)
        .then(Chain.iterate);
      });
      return;
    }
    
    if(step.isAChain()) {
      step.blendInputs();
      Chain.run(step.name, {
        input: step.input,
        output: function(res) {
          Object.assign(chain.input, this);
          Chain.iterate(chain);
        }
      });
      // step.incorporateChainSteps().then(function(newChain){
      //   step.blendInputs();
      //   Chain.iterate(newChain);
      // });
      return;
    }
    
    if(step.isALoop()) {
      var data = step.name.data || step.input.last;
      
      if(step.isIncremental()) {
        data.loop({
          fn: Chain.runChainForItem.bind(step),
          done: function() { Chain.iterate(chain) }
        });
      } else {
        if(Array.isArray(data)) {
          
          for(let i in data) Chain.runChainForItem.bind(step)(i, data[i]);
          
          Chain.iterate(chain);
          
        } else if(typeof data === "object") {
          
          Object.loop(data, function(obj, key, value) {
            var input = {
                step: step,
                obj: obj,
                key: key,
                value: value            
            };
            Object.assign(input, step.input);
            Chain.run({
              input: input,
              order: step.name
            })
          });
          
          Chain.iterate(chain);
        }
      }
      
      return;
    }
    
    step.init();
    
    return step.input;
  },
  loop: function(order) {
    return {
      loop: order
    };
  },
  run: function(options, overRide) {
    var chain;
    if(options.name || typeof options === "string") {
      var chainName = options.name || options;
      var reference = Chain["_"+chainName];
      if(!reference) {
        console.log(options + " does not exist.");
        return;
      }
      
      if(overRide) {
        if(!overRide.input && !overRide.output) {
          Object.assign(options.input, overRide);
        } else {
          options = overRide;  
        }
      }
      chain = {
        input: options.input || reference.input || {},
        output: options.output || reference.output,
        order: options.order || reference.order,
        name: chainName,
        data: options.data || reference.data
      };
    } else if(Array.isArray(options)) {
      chain = { order: options };
      if(overRide) {
        if(!overRide.input && !overRide.output) {
          chain.input = overRide;
        } else {
          chain.input = overRide.input || {};
          chain.output =  chain.output;
        }
      }
    } else {
      chain = options;
    }
    if(chain.name) {
      Chain[chain.name] = Chain.iterate(chain);
    } else {
      Chain.iterate(chain);
    }
  },
  run2: function() {
    Chian.if("hasOverides", function(answer){
      Chain.route(answer, {
        true: function() {
          Chain.step("addOverides", function(){
            
          });
        },
        false: function() {
          
        }
      })  
    });
  },
  steps: {}
};

if(typeof module === "undefined") module = {};
module.exports = Chain;
