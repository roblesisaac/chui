Vue.component("new-site", {
  data: function() {
    return {
      newSite: {
        email: "    CUSTOMEmail@email.com    ",
        htmlButton: "htmlButton",
        author: {{ userid }},
        testNumber: 1,
        testString: 1
      }
    };
  },
  methods: {
    newsite: function() {
      api.method("post", "/db/bugtests", this.newSite).then(function(res){
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
            <input type="text" v-model="newSite.email">
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
  <div>
    {{ site }}, <br> {{ i }}
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
      <div class="cell small-12">
        <top-nav></top-nav>
      </div>
      <div class="columns medium-4">
        <new-site></new-site>
      </div>
      <div class="columns medium-8">
        <user-site :site="site" :i="i" v-for="(site, i) in sites"></user-site>
      </div>
    </div>
  `
})
