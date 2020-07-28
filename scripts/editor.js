ace.config.set("basePath", "https://cdnjs.cloudflare.com/ajax/libs/ace/1.4.12");
ace.require("ace/ext/language_tools");

var editor = new Chain({
  input: function() {
    return {
      session: ace.edit("aceEditor"),
      options: {
        autoScrollEditorIntoView: true,
        copyWithEmptySelection: true,
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        fontSize: "12pt",
        tabSize: 2,
        mode: "ace/mode/text",
        theme: "ace/theme/ambiance",
        selectionStyle: "text",
        value: "// <(-_-)> Empty, your canvas is.",
      },
      themes: {
        "javascript": "ambiance",
        "html": "chrome",
        "css": "chrome",
        "text": "chrome"
      }
    };
  },
  state: {
    uiObj: {},
    obj: {_id: null},
    uiProp: null  
  },
  steps: {
    buildOptions: function() {
      Object.assign(this.options, this.aceOptions);
      if(this.options.value) {
        this.options.value = this.options.value.toString();
      }
      this.next();
    },
    changeToLastComponent: function() {
      site.component = site.lastComponent;
      this.next();
    },
    changeEditorObj: function() {
      this.obj = this.editorObj;
      this.uiProp = "text";
      this.next();
    },
    changeComponentToAce: function() {
      site.component = "ui-ace";
      var self = this;
      Vue.nextTick(function(){
        self.next();
      });
    },
    changeValue: function() {
      var prop = this.uiProp || "text";
      this.options.value = this.obj[prop].toString();
      this.next();
    },
    destroySession: function() {
      this.session.destroy();
      this.next();
    },
    determineSessionMode: function() {
      if(!this.obj) return this.next();
      var obj = this.obj,
          name = obj.name;
      if(name) {
        var ext = name.split(".")[1],
            types = {
              "js": "javascript"
            };
        this.type = types[ext] || ext;
        this.options.mode = "ace/mode/"+this.type; 
      }
      this.next();
    },
    determineTheme: function() {
      var theme = this.themes[this.type || "text"];
      this.options.theme = "ace/theme/"+theme;
      this.next();
    },
    initSession: function() {
      ace.edit("aceEditor").setOptions(this.options);
      this.next();
    },
    setProps: function() {
      if(this.props) {
        this.uiObj = this.props.uiObj;
        this.obj = this.props.obj;
        this.uiProp = this.props.uiProp;
      }
      this.next();
    },
    valueChanged: function() {
      if(!this.uiObj.saveChanges || !editor.obj) return this.next(false);
      this.value = this.session.getValue();
      this.prop = this.uiProp || "text";
      this.next(this.obj[this.prop] != this.value);
    },
    saveIt: function() {
      this.obj[this.prop || "text"] = this.value || this.session.getValue();
      this.uiObj.saveChanges();
      this.next();
    }
  },
  changeSession: function(editorObj) {
    return [
      { if: "valueChanged", true: "saveIt" },
      "destroySession",
      "changeEditorObj",
      "determineSessionMode",
      "changeValue",
      "initSession",
    ];
  },
  close: [
    { if: "valueChanged", true: "saveIt" },
    "changeToLastComponent",
    "destroySession"
  ],
  launch: function(aceOptions, props) {
    return [
      "setProps",
      "determineSessionMode",
      "buildOptions",
      "initSession",
      "changeComponentToAce"
    ];
  },
  save: { if: "valueChanged", true: "saveIt" }
});