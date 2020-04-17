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
addMethodToArray('find', function(filter){
  var match = [];
  for (i = 0; i<this.length; i++) {
    if(itemMatches(this[i], filter)) match.push(this[i]);
  }
  return match;  
});
addMethodToArray('findOne', function(filter){
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

var Chain = {
  addStepGlobally: function(stepName, fn) {
    Chain.steps[stepName] = Chain.steps[stepName] || fn;
    global["_"+stepName] = global["_"+stepName] || fn;
  },
  addStepsGlobally: function(stepsObject) {
    if(!stepsObject) return;
    if(stepsObject.name) {
      Chain.addStepGlobally(stepsObject.name, stepsObject.fn);
    }
    for(var stepName in stepsObject) {
      Chain.addStepGlobally(stepName, stepsObject[stepName]);
    }    
  },
  build: function(chainName, chainObj) {
    if(Array.isArray(chainObj)) chainObj = {order: chainObj};
    Chain.addStepsGlobally(chainObj.steps);
    Chain["_"+chainName] = chainObj;
    global["_"+chainName] = global["_"+chainName] || function(overRides) {
      Chain.run({
        input: chainObj.input || {},
        output: chainObj.output,
        order: chainObj.order,
        name: chainName
      }, overRides);
    };
  },
  currentStep: function(chain) {
    chain.stepNumber === undefined ? chain.stepNumber = 0 : chain.stepNumber++;
    if(chain.order.split) chain.order = chain.order.split(); // make sure its array
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
        fn.bind(this.input)(this.input.last, this.input.next, this.input.vm);
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
        return !step.name.split || step.name.loop;
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
  forEachItem: function(i, item, nxt) {
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
      step.resolveCondition(function(conditionResult) {
        step.incorporateResultSteps(conditionResult)
        .then(Chain.iterate);
      });
      return;
    }
    
    if(step.isAChain()) {
      step.incorporateChainSteps().then(function(newChain){
        step.blendInputs();
        Chain.iterate(newChain);
      });
      return;
    }
    
    if(step.isALoop()) {
      var data = step.name.data || step.input.last;
      
      if(step.isIncremental()) {
        Chain.plyLoop(data, {
          fn: Chain.forEachItem.bind(step),
          done: function() { Chain.iterate(chain) }
        });
      } else {
        for(let i in data) Chain.forEachItem.bind(step)(i, data[i]);
        Chain.iterate(chain);
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
  plyLoop: function(arr, o, vm) {
    if(o.fn === undefined) return console.log("Please define fn.");
    if(arr === undefined) return console.log("Please define array");
    
    o.i === undefined ? o.i = 0 : o.i++;
    if(!arr[o.i]) {
      if(o.done) o.done(vm);
      return;
    }
    o.fn(o.i, arr[o.i], function(vm) {
      if(vm) vm.progress = ((o.i+1) / arr.length) * 100; 
      setTimeout(function(){
        Chain.plyLoop(arr, o, vm);
      }, 0);
    });
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
        name: chainName
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
  steps: {}
};

module.exports = Chain;
