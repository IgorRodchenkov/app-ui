const cytoscape = require('cytoscape');

//Layouts
const coseBilkent = require('cytoscape-cose-bilkent');
const cola = require('cytoscape-cola');

const expandCollapse = require('cytoscape-expand-collapse');

//Tooltips
const popper = require('cytoscape-popper');

module.exports = () => {
  cytoscape.use(cola);
  cytoscape.use(coseBilkent);
  cytoscape.use(expandCollapse);
  cytoscape.use(popper);
};