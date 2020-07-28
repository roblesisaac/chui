var blocks = new Chain({
  input: function() {
    return {
      sheet: index.activeSheet,
      blocks: index.activeSheet.ui.blocks,
      compiled: []
    };
  },
  state: {
    loading: true
  },
  steps: {
    appendNestedBlock: function() {
      var nested = `
        <div class="client-block cell small-${this.item.width}">
          ${this.item.html}
        </div>
      `;
      this.row.push(nested);
      this.next();
    },
    alertNoBlocks: function() {
      console.log("<(-_-)> Not existing on sheet, blocks are.");
    },
    endRow: function() {
      this.row.push("</div></div>");
      this.compiled.push(this.row.join(""));
      this.next();
    },
    heightIsGreaterThanOne: function() {
      this.next(this.block.height > 1);
    },
    triggerLoading: function() {
      this.loading = true;
      this.next();
    },
    forEachBlock: function() {
      this.next(this.blocks.slice());
    },
    forEachNestedCell: function() {
      var blockWidth = this.block.width,
          nestedStart = this.i+1,
          numberOfNestedCells = 2,
          nested = this.list.splice(nestedStart, numberOfNestedCells);
      this.next(nested);
    },
    hasBlocks: function() {
      this.next(this.blocks.length > 0);
    },
    renderClientBlock: function() {
      var clientBlock = `
        <div class="client-block cell small-${this.block.width}">
          ${this.block.html}
        </div>
      `;
      this.compiled.push(clientBlock);
      this.next();
    },
    renderServerBlock: function() {
      var blockName = proper(this.sheet.name)+this.i;
      console.log(`
        var block${blockName} = Vue.comonent("block-${blockName}", {
          ${this.block.css},
          template: '${this.block.html}'
        })
      `);
    },
    startRow: function() {
      this.row = [`
      <div class="cell small-8 block-nested-row">
        <div class="grid-x block-row">
      `];
      this.next();
    }
  },
  server: {
    if: "hasBlocks",
    true: [
      "forEachBlock", [
        "define=>block",
        "renderServerBlock"  
      ]
    ],
    false: "alertNoBlocks"
  },
  compile: [
    "triggerLoading",
    "forEachBlock", loop([
      "define=>block",
      {
        if: "heightIsGreaterThanOne",
        true: [
          "renderClientBlock",
          "startRow",
          "forEachNestedCell", [
            "appendNestedBlock"
          ],
          "endRow"
        ],
        false: "renderClientBlock"
      }  
    ])
  ]
});


var tBlocks = [
  {
    height: 2,
    width: 4
  },
  {
    height: 1,
    width: 10
  },
  {
    height: 1,
    width: 2
  },
  {
    height: 1,
    width: 6
  },
  {
    height: 1,
    width: 6
  }
];

var uiBlocks = [
  [
    { width: 4 }, { width: 8 }  
  ], 
  [
    { width: 4 }, { width: 4 }, { width: 4 }  
  ], 
  [
    { width: 3 }, { width: 3 }, { width: 3 }, { width: 3 }
  ], 
  [
    { width: 4 }, {
      width: 4,
      rows: [
        [ { width: 4 }, { width: 4 }, { width: 4 } ],
        [ { width: 4 }, { width: 4 }, { width: 4 } ],
        [ { width: 4 }, { width: 4 }, { width: 4 } ],
        [ { width: 4 }, { width: 4 }, { width: 4 } ]
      ]
    },
    { width: 4 }  
  ], 
  [
    { width: 3 }, { width: 3 }, { width: 3 }, { width: 3 }
  ]
];

Vue.component("ui-ui", {
  beforeCreate: function() {
    eval(index.activeSheet.ui.js);
    blocks.compile().then(function(res){
      console.log(res.compiled.join(""));
      Vue.component("ui-blocks", {
        template: `
          <div class="grid-x ui-blocks">
            ${res.compiled.join("")}
          </div>
        `
        });
        blocks.loading = false;
    });
  },
  data: function() {
    return {
      blocks: blocks
    };
  },
  template: `
    <div class="grid-x">
      <div class="cell small-12">
        <div class="cell small-12 borderB">
          <ui-db-tools />
        </div>
      </div>
      <div class="cell small-12">
        <ui-blocks v-if="!blocks.loading" /> 
      </div>
    </div>
  `
});