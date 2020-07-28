Vue.component("ui-library", {
  data: function() {
    return {
      sites: userSites
    };
  },
  template: `
    <div class="grid-x">
      <div class="cell medium-4 pad15">
        <ui-new-site></ui-new-site>
      </div>
      <div class="cell medium-8 pad15">
        <div class="row small-up-1">
          <ui-site-obj :site="site" :i="i" v-for="(site, i) in sites"></ui-site-obj>
        </div>
      </div>
    </div>
  `
});