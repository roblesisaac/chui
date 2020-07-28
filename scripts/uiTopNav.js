var ifShowingNormalLinks = `
  <div v-if="showingNormalLinks" class="cell auto">
    <div class="grid-x align-right">
      <div v-for="sheet in sheets" class="cell shrink">
        <a @click="index.loadHash(sheet.name)" class="button bgClear f1 proper p20X">{{ sheet.name }}</a>
      </div>
      <div class="cell shrink">
        <a class="button f1 p20X colorBlue bgClear" :href="'https://{{ domain }}/dev/'"><b>Library</b></a>
      </div>
      <div class="cell shrink">
        <a class="button f1 p20X colorBlue bgClear" @click="logout"><b>Logout</b></a>
      </div>
    </div>
  </div>
  <div v-if="showingButton" class="cell auto">
    <div class="grid-x align-right">
      <div class="cell shrink">
        <a @click="site.showingOffCanvasLinks=true" class="button bgClear fi-list p10Y p30X"></a>
      </div>
    </div>
  </div>
`;
var ifShowingOffCanvasLinks = `
  <div v-if="site.showingOffCanvasLinks" class="cell auto">
    <div class="grid-x align-right">
      <div class="cell shrink">
        <a @click="site.showingOffCanvasLinks=false"
            class="button bgClear p10Y p20X">
          <i class="fi-x"></i> Close
        </a>
      </div>
    </div>
  </div>
  <transition name="slide-fade">
  <div v-if="site.showingOffCanvasLinks" class="cell small-12">
    <div class="grid-x align-right">
      <a class="cell shrink button p10Y p20X colorBlue bgClear" :href="'https://{{ domain }}/dev/'"><b>Library</b></a>
    </div>
    <div class="grid-x align-right">
      <a class="cell shrink button p10Y p20X colorBlue bgClear" @click="logout"><b>Logout</b></a>
    </div>
    <div v-for="sheet in sheets" class="grid-x align-right">
      <a @click="index.loadHash(sheet.name)"
         class="cell shrink proper button p10Y p20X bgClear">
      {{ sheet.name }}
      </a>
    </div>
  </div>
  </transition>
`;

Vue.component("ui-top-nav", {
  computed: {
    showingNormalLinks: function() {
      return site.screenSize !== "small";
    },
    showingButton: function() {
      return site.screenSize == "small" && !site.showingOffCanvasLinks;
    }
  },
  data: function() {
    return {
      site: site,
      index: index,
      sheets: sheets
    };
  },
  methods: {
    logout: function() {
      api.method("post", "/logout").then(function(){
        location.reload();
      });
    }
  },
  template: `
  <div class="grid-x topNav align-middle borderB">
    <div class="cell shrink bold proper">
      <a @click="location.reload()" class="button colorBlue bgClear p20X">
        ${siteName == "undefined" ? "Library" : siteName}
      </a>
    </div>
    
    ${ifShowingNormalLinks}
    ${ifShowingOffCanvasLinks}
    
  </div>
  `
});