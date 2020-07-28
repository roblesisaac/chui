var api = new Chain({
    input: {
        baseUrl: "{{ host }}"
    },
    steps: {
        buildUrl: function() {
          this.url = this.url || "/sheets";
          if(this.url[0] !== "/") this.url = "/" + this.url;
          this.url = this.baseUrl + this.url;
          this.next();
        },
        fetch: function() {
          var self = this;
          fetch(this.url).then(function(response){
            self.next(response);
          });
        },
        post: function() {
          if(!this.data) return this.end("Data not here.");
          var self = this;
          window.fetch(this.url, {
            method: "POST",
            mode: "cors",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(this.data)
          }).then(function(response){
            self.next(response);
          });
        },
        respond: function(response) {
          var self = this;
          if (!response.ok) {
            response.text().then(function(err){
              site.notify = err;
              self.error(err);
            });
          } else {
            response.json().then(function(json) {
              var method = {
                put: "Updated",
                post: "Posted",
                get: "Got",
                delete: "Removed"
              };
              if(json._id) {
                site.notify = `<(-_-)> ${method[self.method]} to archives, ${json.name || json._id} is.`;
              } else if(!json._id && self.url.includes("login")) {
                site.notify = "<(-_-)> Welcome to " + siteName + ", you are.";
              }
              self.next(json);
            });
          }
        },
        useMethod: function() {
          this.data = this.data || {};
          var self = this;
          window.fetch(this.url, {
            method: this.method,
            mode: "cors",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(this.data)
          }).then(function(response){
            self.next(response);
          });
        }
    },
    get: function(url) {
      return [
        "buildUrl",
        "fetch",
        "respond"
      ];
    },
    post: function(url, data) {
      return [
        "buildUrl",
        "post",
        "respond"
      ];
    },
    method: function(method, url, data) {
      return [
        "buildUrl",
        "useMethod",
        "respond"
      ];
    },
    instruct: function(input) {
      return [
        "buildUrl",
        input.method || "fetch",
        "respond"
      ];
    }
});

