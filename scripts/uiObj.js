const uiObjRender = {
  mouseEvents: function(Type, prop) {
    prop = prop || '';
    return `
    @mouseover.passive="renderTools('show', '${Type}', ${prop})"
    @mouseleave.passive="renderTools('hide', '${Type}', ${prop})"
    `;
  }, 
  title: function() {
    return `
      <a ${uiObjRender.mouseEvents("Title")} class="grid-x align-middle colorBlue bold p5B">
        <div @click="open=!open" class="cell shrink">
          <span style="margin-left:-5px" class="material-icons bgClear button noHover p0L p5T p5R p5B" v-html="arrow"></span>
        </div>
        <div class="cell shrink proper p5R">{{  title }} <small class="colorGrey proper">{{ type }}</small></div>
        ${uiObjRender.titleTools()}
      </a>
    `;
  },
  titleTools: function() {
    return `
      <div v-show="!locked && showingTitleTools" class="cell auto">
        <div class="cell grid-x align-middle">
          <div class="cell shrink p5R">
            <a @click="addFieldToObj" class="button material-icons">add_circle_outline</a>
          </div>
          <div v-if="canDuplicate()" class="cell shrink p5R">
            <a @click="duplicate" class="material-icons button">library_add</a>
          </div>
          <div class="cell shrink p5R">
            <a @click="removeObj(objTitle)" class="material-icons button">delete_forever</a>
          </div>
          <div v-if="!objTitle && history.length>0 && version>0" class="cell shrink p5R">
            <a @click="historyAdjust('undo')" class="material-icons button">history</a>
          </div>
          <div v-if="!objTitle && history.length>0 && version<history.length-1" class="cell shrink p5R">
            <a @click="historyAdjust('redo')" class="material-icons button">update</a>
          </div>
          <div class="cell shrink">
            <select @change="changeObjType" class="proper" v-model="objType">
              <option>array</option>
              <option>object</option>
              <option>string</option>
              <option>number</option>
            </select>
          </div>
        </div>
      </div>
    `;
  },
  propSection: function() {
    return `
      <div v-else ${uiObjRender.mouseEvents("Prop", "prop")} class="cell small-12">
        <div class="grid-x align-middle">
          <div class="cell shrink bold proper p5R">
            <a @click="renderTools('show', 'PropName', prop);
                newPropName=prop;" :data-id="dataId(prop)"
                :style="invisible(prop)"
                class="colorBlack">
              {{ prop }}:
            </a>
            <input @blur="renameProp(prop)" @keyup.enter="renameProp(prop)"
                   v-show="editingThisPropName(prop)" 
                   :style="propStyleOnEdit(prop)" 
                   v-model="newPropName"
                   type="text">
          </div>
          <div class="cell auto">
            <input :type="typeIs(value, 'forSelect')" v-model="obj[prop]" @dblclick="launchAce(prop)" />
          </div>
          ${uiObjRender.propTools()}
        </div>
      </div>
    `;
  },
  propTools: function() {
    return `
      <div v-show="!locked && editingThisProp(prop)" class="cell shrink">
        <div class="grid-x align-middle">
          <div class="cell shrink p5L">
            <a @click="addFieldToObj" class="material-icons button">add_circle_outline</a>
          </div>
          <div class="cell shrink p5L">
            <a @click="removeProp(prop)" class="material-icons button">delete_forever</a>
          </div>
          <div class="cell shrink p5L">
            <select @change="changePropType($event, prop)" class="proper m0" :value="typeIs(value)">
              <option>array</option>
              <option>object</option>
              <option>string</option>
              <option>number</option>
            </select>
          </div>
        </div>
      </div>
    `;
  },
  ifNestedObject: function() {
    return `
      <div v-if="isObj(value)" class="cell small-12">
        <ui-obj :obj="obj[prop]" :master="master || obj" :objTitle="prop.toString()" />
      </div>
    `;
  }
};

Vue.component("ui-obj", {
  computed: {
    arrow: function() {
      return this.open ? "keyboard_arrow_down" : "keyboard_arrow_right";
    },
    dbPath: function() {
      var parent = this.getParent(this),
          data = parent.obj;
      return parent.url ?  parent.url + "/" + data._id : false;
    },
    title: function() {
      var name = this.objTitle || this.obj.name || " ";
      return this.obj ? name : "n/a";
    },
    type: function() {
      return Array.isArray(this.obj)
        ? "list of "+this.obj.length+""
        : typeof this.obj;
    }
  },
  data: function() {
    this.settings = this.settings || {};
    var isOpen = this.settings.open !== undefined
                   ? this.settings.open
                   : this.master
                   ? true
                   : false,
        isLocked = this.settings.locked;
    return {
      history: [Object.assign({}, this.obj)],
      version: 0,
      muteChanges: false,
      showingPropTools: null,
      showingTitleTools: null,
      showingPropNameTools: null,
      objType: this.typeIs(this.obj),
      newPropName: "",
      locked: isLocked,
      open: isOpen,
      types: function(value) {
        return {
          array: [""],
          object: {test:""},
          string: "",
          number: 1,
          boolean: true
        }[value];
      }
    };
  },
  methods: {
    addFieldToObj: function() {
      if(Array.isArray(this.obj)) {
        this.obj.push("");
      } else {
        var objLength = Object.keys(this.obj).length,
            fieldName = "test"+objLength;
        this.obj[fieldName] = "";
      }
      this.update();
    },
    canDuplicate: function() {
      return this.master && Array.isArray(this.$parent.obj);
    },
    changeObjType: function() {
      if(!this.$parent) return;
      this.$parent.obj[this.objTitle] = this.types(this.objType);
      this.update();
    },
    changePropType: function(e, prop) {
      this.obj[prop] = this.types(e.target.value);
      this.update();
    },
    dataId: function(prop) {
      var objLen = Object.keys(this.obj).length;
      return prop.toString()+objLen.toString();
    },
    duplicate: function() {
      var arr = this.$parent.obj,
          index = this.title*1;
      arr.splice(index+1, 0, Object.assign({}, this.obj));
    },
    editingThisProp: function(prop) {
      return this.showingPropTools==this.dataId(prop);
    },
    editingThisPropName: function(prop) {
      return this.showingPropNameTools == this.dataId(prop);
    },
    inputWidth: function(prop) {
      if(!prop) return;
      var $span = this.$el.querySelector("a[data-id='"+this.dataId(prop)+"']");
      if(!$span) return;
      return $span.offsetWidth;
    },
    invisible: function(prop) {
      if(!prop) return;
      var invisibleStyle = {
                display: "block",
                height: 0,
                opacity: 0,
                position: "absolute",
                top: 0
              };
      return this.showingPropNameTools == this.dataId(prop)
              ? invisibleStyle
              : null;
    },
    isObj: function(value) {
      return typeof value == "object" && value !== null;
    },
    isValid: function(prop) {
      var excludes = ["_id", "__v", "siteId"];
      return excludes.indexOf(prop) < 0;
    },
    getParent: function(self) {
      return self.$parent.obj
             ? this.getParent(self.$parent)
             : self;
    },
    getHighestObj: function(self) {
      return self.$parent.obj
             ? this.getHighestObj(self.$parent)
             : self.obj;
    },
    historyAdjust: function(direction) {
      direction == "undo" ? this.version-- : this.version++;
      this.muteChanges = true;
      this.obj = Object.assign({}, this.history[this.version]);
    },
    launchAce: function(prop) {
      if(this.locked) return;
      editor.launch(
        { value: this.obj[prop] },
        {
          uiObj: this,
          obj: this.obj,
          uiProp: prop
        }
      );
    },
    pushToHistory: function(parent, newObj) {
      if(parent.muteChanges) return;
      console.log({
        version: parent.version,
        historyChanged: true,
        history: parent.history
      });
      parent.history.push(Object.assign({}, newObj));
      parent.version++;
    },
    propStyleOnEdit: function(prop) {
      return this.showingPropNameTools
              ?  {
                  padding: 0,
                  color: "#4285f4",
                  "font-weight": "bold",
                  height: "auto",
                  border: "1px solid #ccc",
                  width: this.inputWidth(prop)+"px"
                }
              : null;
    },
    typeIs: function(value, forSelect) {
      value = value || "";
      var typeOf = typeof value,
          type = Array.isArray(value)
              ? "array"
              : typeOf == "object"
              ? "object"
              : value.trim && !!value.trim() && !isNaN(value)
              ? "number"
              : typeOf;
      return !!forSelect && type == "string"
              ? "text"
              : type;
    },
    removeObj: function(objTitle) {
      if(confirm("<(-_-)> Sure,  you are?")) {
        if(!this.master && this.obj._id) {
          api.method("delete", this.dbPath, this.obj).then(function(res){
            console.log(res.last);
          });
        } else {
          var parent = this.$parent.obj;
          if(Array.isArray(parent)) {
            parent.splice(objTitle, 1);
          } else {
            delete parent[objTitle];
          }
          this.update(); 
        }
      }
    },
    removeProp: function(prop) {
      if(confirm("<(-_-)> Sure,  you are?")) {
        if(Array.isArray(this.obj)) {
          this.obj.splice(prop, 1);
        } else {
          delete this.obj[prop];
        }
        this.update(); 
      }
    },
    renameProp: function(prop) {
      var newObj = renameProp(this.obj, prop, this.newPropName);
      if(this.$parent.obj) {
        this.$parent.obj[this.objTitle] = Object.assign({}, newObj);
      } else {
        this.obj = Object.assign({}, newObj);
      }
      this.update();
      this.showingPropNameTools = null;
    },
    renderTools: function(method, Name, prop) {
      if(this.locked || site.screenSize == "small") return;
      var self = this,
          dataProp = prop === undefined ? Name : prop.toString(),
          dataId = this.dataId(dataProp),
          showMe = "showing"+Name+"Tools";
      return {
        show: function() {
          if(self[showMe] !== dataId) self[showMe] = dataId;
        },
        hide: function() {
          if(self[showMe]) self[showMe] = false;
        }
      }[method]();
    },
    saveChanges: function() {
      var parent = this.getParent(this),
          data = parent.obj;
      if(!data._id) return;
      var self = this;
      api.method("put", this.dbPath, data).then(function(res){
        // console.log(res.last);
      }).catch(function(e){
        site.notify = e;
      });
    },
    update: function() {
      this.muteChanges = false;
      var parent = !this.master ? this : this.getParent(this),
          self = this;
      this.$forceUpdate();
      if(this.$parent.obj) this.$parent.$forceUpdate();
      whenTypingStops(function(){
        self.saveChanges();
      });
      // parent.obj.__v = parent.obj.__v ? parent.obj.__v+1 : 1;
    }
  },
  props: ["obj", "master", "objTitle", "settings", "url"],
  template: `
    <div class="grid-x pad5Y">
      <div v-if="title" class="cell small-12">
        ${uiObjRender.title()}
      </div>
      <transition name="slide-fade">
      <div v-if="open" class="cell small-12">
        <div v-if="isValid(prop)" v-for="(value, prop) in obj" :key="prop" class="grid-x p5B align-middle" :class="{p20L: title}">
          ${uiObjRender.ifNestedObject()}
          ${uiObjRender.propSection()}
        </div>
      </div>
      </transition>
    </div>
  `,
  watch: {
    obj: {
      deep: true,
      handler: function() {
        console.log("change")
        var self = this;
        whenTypingStops(function(){
          self.saveChanges();
        });
      }
    }
  }
});