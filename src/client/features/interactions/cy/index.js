const h = require('react-hyperscript');
const CytoscapeTooltip = require('../../../common/cy/cytoscape-tooltip');
const _ = require('lodash');

const { ServerAPI } = require('../../../services');
const InteractionsNodeTooltip = require('../interactions-node-tooltip');
const InteractionsEdgeTooltip = require('../interactions-edge-tooltip');

const SINGLE_SRC_LAYOUT = {
  name: 'concentric',
  concentric: node => node.data('queried') ? 1 : 0,
  levelWidth: () => 1,
  animate: true,
  animationDuration: 800,
  animationEasing: 'ease-in-out'
};

const interactionsLayoutOpts = cy => {
  if( cy.nodes('[?queried]').size() > 1){
    return _.assign({}, SINGLE_SRC_LAYOUT, { minNodeSpacing: 50 });
  }
  return SINGLE_SRC_LAYOUT;
};

const SHOW_INTERACTIONS_TOOLTIPS_EVENT = 'showinteractionstooltip';

let bindEvents = ( cy ) => {
  let geneData = [];

  // on initial interactions data load, popualate gene metadata
  cy.one('add', () => {
    let geneQuery = cy.nodes().map( node => node.data('id') ).join(' ');
    ServerAPI.searchGenes( geneQuery ).then( res => geneData = res );
  });

  let hideTooltips = () => {
    cy.elements().forEach(ele => {
      let tooltip = ele.scratch('_tooltip');
      if (tooltip) {
        tooltip.hide();
      }
    });
  };

  cy.on(SHOW_INTERACTIONS_TOOLTIPS_EVENT, 'node', function (evt) {
    let node = evt.target;
    let geneId = node.data('id');
    let geneMetadata = geneData.find( info => info.query === geneId ) || {};
    let tooltip = new CytoscapeTooltip( node.popperRef(), {
      html: h(InteractionsNodeTooltip, { node, geneMetadata })
    } );
    node.scratch('_tooltip', tooltip);
    tooltip.show();
  });

  cy.on(SHOW_INTERACTIONS_TOOLTIPS_EVENT, 'edge', function (evt) {
    let edge = evt.target;
    let tooltip = new CytoscapeTooltip( edge.popperRef(), {
      html: h(InteractionsEdgeTooltip, {
        edge: edge
        })
    } );
    edge.scratch('_tooltip', tooltip);
    tooltip.show();
  });

  cy.on('tap', evt => {
    const tgt = evt.target;

    // we clicked an element that has a tooltip open -> close it
    if( tgt.scratch('_tooltip')){
      hideTooltips();
      tgt.removeScratch('_tooltip');
    } else {
      // open the tooltip for the clicked element
      hideTooltips();
      tgt.emit(SHOW_INTERACTIONS_TOOLTIPS_EVENT);
    }
  });

  //Hide Tooltips on various graph movements
  cy.on('drag', () => hideTooltips());
  cy.on('pan', () => hideTooltips());
  cy.on('zoom', () => hideTooltips());
  cy.on('layoutstart', () => hideTooltips());
  cy.on('hide-type', () => hideTooltips());
  cy.on('slider-change', () => hideTooltips());

  let nodeHoverMouseOver = _.debounce(evt => {
    let node = evt.target;
    let elesToHighlight = cy.collection();

    //Create a list of the hovered node & its neighbourhood
    node.neighborhood().nodes().union(node).forEach(node => {
      elesToHighlight.merge(node.ancestors());
      elesToHighlight.merge(node.descendants());
      elesToHighlight.merge(node);
    });
    elesToHighlight.merge(node.neighborhood().edges());

    //Add highlighted class to node & its neighbourhood, unhighlighted to everything else
    cy.elements().addClass('unhighlighted');
    elesToHighlight.forEach(ele => {
      ele.removeClass('unhighlighted');
      ele.addClass('highlighted');
    });

  }, 750);

  //call style-applying and style-removing functions on 'mouseover' and 'mouseout' for non-compartment nodes
  cy.on('mouseover', 'node[class!="compartment"]', nodeHoverMouseOver);
  cy.on('mouseout', 'node[class!="compartment"]', () => {
    nodeHoverMouseOver.cancel();
    cy.elements().removeClass('highlighted unhighlighted');
  });
};

//Search by keyword within network
let searchInteractionNodes = _.debounce((cy, query) => {
  let queryEmpty = _.trim(query) === '';
  let allNodes = cy.nodes();
  let matched = allNodes.filter( node => node.data('id').toUpperCase().includes( query.toUpperCase() ) );

  cy.batch(() => {
    allNodes.removeClass('matched');

    if( matched.length > 0 && !queryEmpty ){
      matched.addClass('matched');
    }
  });
}, 250);


module.exports = {
  interactionsLayoutOpts,
  searchInteractionNodes,
  interactionsStylesheet: require('./interactions-stylesheet'),
  bindEvents
};
