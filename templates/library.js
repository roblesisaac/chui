Vue.component("new-site", {
  data: function() {
    return {
      newSite: {
        name: "newSiteTest",
        htmlButton: "htmlButtonTest",
        author: {{ userid }}
      }
    };
  },
  methods: {
    newsite: function() {
      console.log(this.newSite);
      api.method("post", "/db/sites", this.newSite).then(function(res){
        console.log(res.last);
      });
    }
  },
  template: `
    <div class="grid-x">
      <div class="cell small-12">
        <div class="grid-x">
          <div class="cell shrink">
            Site Name:
          </div>
          <div class="cell auto">
            <input type="text" v-model="newSite.name">
          </div>
        </div>
      </div>
      <div class="cell small-12">
        <div class="grid-x">
          <div class="cell shrink">
            Html Button:
          </div>
          <div class="cell auto">
            <input type="text" v-model="newSite.htmlButton">
          </div> 
        </div>
      </div>
      <a @click="newsite">Add New Site</a>
    </div>
  `
});

Vue.component("top-nav", {
  methods: {
    logout: function() {
      api.method("post", "/logout").then(function(){
        location.reload();
      })
    }
  },
  template: `
  <div class="grid-x">
    <div class="cell shrink">
      <a @click="logout"><b>Logout</b></a>
    </div>
  </div>
  `
});

Vue.component("user-site", {
  props: ["site", "i"],
  template: `
  <div class="column column-block text-center">
    <h3>{{ site.name }}</h3>
    <a :href="'https://{{ domain }}/dev/' + site.name"><b><(-_-)> Enter</b></a>
  </div>
  `
});

new Vue({
  el: "#root",
  data: {
    sites: userSites
  },
  template: `
    <div class="grid-x">
      <div class="cell small-12 pad15">
        <top-nav></top-nav>
      </div>
      <div class="columns medium-4 pad15">
        <new-site></new-site>
      </div>
      <div class="columns medium-8 pad15">
        <div class="row small-up-2 medium-up-3">
          <user-site :site="site" :i="i" v-for="(site, i) in sites"></user-site>
        </div>
      </div>
    </div>
  `
})
