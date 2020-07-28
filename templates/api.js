var api = new Chain({
    input: {
        baseUrl: "{{ host }}"
    },
    steps: {
        buildUrl: function(url) {
            this.url = url || this.url || "/sheets";
            if(this.url[0] !== "/") this.url = "/" + this.url;
            this.url = this.baseUrl + this.url;
            this.next();
        },
        fetch: function() {
            var self = this;
            window.fetch(this.url)
            .then(response => response.json())
            .then(json => self.next(json));
        },
        post: function(data) {
            if(!data && !this.data) return this.end("Data not here.");
            var self = this;
            window.fetch(this.url, {
              method: "POST",
              mode: "cors",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(data || this.data)
            }).then(response => !!response.json ? 
                                    response.json() 
                                    : !!response.text
                                    ? response.text()
                                    : respo)
            .then(json => self.next(json));
        },
        respond: function(res) {
            console.log("responed");
            this.next(res);
        },
        useMethod: function(method, data) {
            data = data || this.data || {};
            var self = this;
            window.fetch(this.url, {
              method: method,
              mode: "cors",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify(data)
            }).then(function(response){
              response.json().then(function(json){
                self.next(json);
              }).catch(function(){
                self.next(response);
              });
            });
        }
    },
    get: function(url) {
        return [
            this.call("buildUrl", url),
            "fetch",
            "respond"
        ];
    },
    post: function(url, data) {
        return [
            this.call("buildUrl", url),
            this.call("post", data),
            "respond"
        ];
    },
    method: function(method, url, data) {
        return [
          this.call("buildUrl", url),
          this.call("useMethod", method, data),
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


