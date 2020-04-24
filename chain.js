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
        name: chainName,
        data: chainObj.data
      }, overRides);
    };
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
          if(chain.error) {
            Chain.steps.error.bind(this.input)(chain.error, this.input.next, this.input.vm);
          } else {
            fn.bind(this.input)(this.input.last, this.input.next, this.input.vm);  
          }
        }
        catch(err) {
          chain.order.push("error");
          chain.error = err;
          chain.stepNumber = chain.order.length-2;
          this.input.next.bind(this.input)(err);
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
  runEachItem: function(i, item, nxt) {
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
      step.resolveCondition(function(conditionResult) {
        step.incorporateResultSteps(conditionResult)
        .then(Chain.iterate);
      });
      return;
    }
    
    if(step.isAChain()) {
      step.blendInputs();
      // Chain.run(step.name, {
      //   input: step.input,
      //   output: function(res) {
      //     Object.assign(chain.input, {last: res});
      //     Chain.iterate(chain);
      //   }
      // });
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
          fn: Chain.runEachItem.bind(step),
          done: function() { Chain.iterate(chain) }
        });
      } else {
        if(Array.isArray(data)) {
          
          for(let i in data) Chain.runEachItem.bind(step)(i, data[i]);
          
          Chain.iterate(chain);
          
        } else if(typeof data === "object") {
          
          Chain.objLoop(data, function(obj, key, value) {
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
  objLoop: function(obj, fn, parent) {
    parent = parent || obj;
    
    for(var key in obj) {
      let val = obj[key];
      
      if(Array.isArray(val)) {
        for(var i in val) {
          var item = val[i];
          if(typeof item !== "object") {
            fn(val, i, item, parent);
          } else {
            Chain.objLoop(item, fn, parent); 
          }
        }
      } else if(typeof val === "object") {
        Chain.objLoop(val, fn, parent);
      } else {
        fn(obj, key, val, parent); 
      }
    }
    
    return obj;

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
  steps: {
    error: function() {
      console.log(this.last);
      this.next(this.last);
    }
  }
};
