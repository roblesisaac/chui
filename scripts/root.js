var site = new Vue({
  computed: {
    screenSize: function() {
      return Foundation.MediaQuery.current;
    }
  },
  el: "#root",
  data: {
    screen: Foundation.MediaQuery,
    page: false,
    component: false,
    lastComponent: false,
    showingOffCanvasLinks: false,
    notify: false
  },
  watch: {
    component: function(current, old) {
      this.lastComponent = old;
    }
  },
  template: `
    <div class="grid-x">
      <div v-if="page" class="cell small-12">
        <ui-top-nav />
      </div>
      
      <div v-show="!showingOffCanvasLinks" class="cell medium-12">
        <ui-ace v-show="component == 'ui-ace'" />
        
        <transition name="slide-fade">
        <${page} v-if="page && component !== 'ui-ace'" />
        </transition>
        
        <transition name="slide-fade">
        <ui-notify v-if="notify" />
        </transition>
      </div>
      
    </div>
  `
});

site.page = page;