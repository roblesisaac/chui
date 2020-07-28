var index = new Chain({
  state: {
    activeSheet: {
      ui: {}
    },
    hash: null
  },
  steps: {
    foundSheetFromHash: function() {
      this.next(!!this.sheet);
    },
    grabSheetFromHash: function() {
      this.sheet = sheets.findOne({
        name: this.hash
      });
      this.next();
    },
    hideComponent: function() {
      site.component = null;
      var self = this;
      Vue.nextTick(function(){
        self.next();
      });
    },
    hideOffCanvasLinks: function() {
      site.showingOffCanvasLinks = false;
      this.next();
    },
    setActiveSheetToHash: function() {
      this.activeSheet = this.sheet;
      this.next();
    },
    setActiveSheetToFirstInLine: function() {
      this.activeSheet = sheets[0];
      this.next();
    },
    setHash: function() {
      location.hash = this.hash;
      this.next();
    },
    setComponentToOnStart: function() {
      var onStart = this.activeSheet.onStart || "ui";
      site.component = "ui-"+ onStart;
      this.next();
    },
    windowHasHash: function() {
      this.hash = location.hash.replace("#", "");
      this.next(!!this.hash);
    }
  },
  init: [
    {
      if: "windowHasHash",
      true: [
        "grabSheetFromHash",
        {
          if: "foundSheetFromHash",
          true: "setActiveSheetToHash",
          false: "setActiveSheetToFirstInLine"
        }
      ],
      false: ["setActiveSheetToFirstInLine"]
    },
    "setComponentToOnStart"
  ],
  loadHash: function(hash) {
    return [
      "hideComponent",
      "setHash",
      "grabSheetFromHash",
      "setActiveSheetToHash",
      "setComponentToOnStart",
      "hideOffCanvasLinks"
    ];
  }
});

Vue.component("ui-index", {
  beforeCreate: function() {
    index.init();
  },
  data: function() {
    return {
      index: index,
      site: site
    };
  },
  template: `
    <component v-if="site.component" :is="site.component || 'ui-db'" />
  `
});