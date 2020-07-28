Vue.component("ui-ace", {
  computed: {
    scripts: function() {
      if(!this.editor.uiObj.getHighestObj) return [];
      var self = this,
          scripts = [],
          oldestObj = this.editor.uiObj.getHighestObj(this.editor.uiObj);
      Object.loop(oldestObj, function(obj, key, value) {
        var isAScriptObj = obj.text;
            notInScripts = scripts.findOne({ name: obj.name }) == null;
        if(isAScriptObj && notInScripts) scripts.push(obj);
      });
      return scripts;
    }
  },
  data: function() {
    return {
      editor: editor
    };
  },
  methods: {
    changeSession: function(scriptObj) {
      editor.changeSession(scriptObj);
    },
    close: function() {
      editor.close();
    },
    highlight: function() {
      for(var i=0; i<this.scripts.length; i++) {
        var scriptObj = this.scripts[i];
        scriptObj.isActive = this.isActiveScript(scriptObj);
      }
      this.$forceUpdate();
    },
    isActiveScript: function(scriptObj) {
      return this.editor.obj.name==scriptObj.name;
    }
  },
  watch: {
    "editor.obj": {
      deep: true,
      handler: function() {
        this.highlight();
      }
    }
  },
  template: `
    <div class="grid-x">
      <div class="cell shrink pad10">
        <div class="grid-x align-middle">
          <div class="small-12">
            <a @click="close" class="button f1 left expanded m5B">
              Close <i class="fi-x-circle fontSubtle"></i>
            </a>
            <a v-for="scriptObj in scripts"
                @click="changeSession(scriptObj)"
                class="button f1 colorBlue left expanded m5B"
                :class="{'bgBlue colorBleach': scriptObj.isActive }">
              {{ scriptObj.name }}
            </a>
          </div>
        </div>
      </div> 
      <div class="cell auto">
        <div @keyup.alt.enter="editor.save()" class="ace" id="aceEditor"></div>
      </div>
    </div>
  `
});