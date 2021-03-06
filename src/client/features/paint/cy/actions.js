const _ = require('lodash');
const { PATHWAYS_LAYOUT_OPTS } = require('./layout');


const MATCHED_SEARCH_CLASS = 'search-match';

let expandCollapseAll = () => {
  let expanded = true;

  return cy => {
    let api = cy.expandCollapse('get');

    if( expanded ){
      let nodesToCollapse = cy.nodes('[class="complex"], [class="complex multimer"]').filter(node => api.isCollapsible(node));
      api.collapseRecursively(nodesToCollapse);

    } else {
      let nodesToExpand = cy.nodes('[class="complex"], [class="complex multimer"]').filter(node => api.isExpandable(node));
      api.expandRecursively(nodesToExpand);
    }
    expanded = !expanded;
  };
};

let fit = cy => {
  cy.animation({ duration: 250, fit: { padding: 75 }}).play();
};

let layout = cy => {
  cy.layout(PATHWAYS_LAYOUT_OPTS).run();
};

let searchNodes = (cy, query) => {
  let queryEmpty = _.trim(query) === '';
  let ecAPI = cy.expandCollapse('get');
  let allNodes = cy.nodes().union(ecAPI.getAllCollapsedChildrenRecursively());

  let getSyns = node => {
    let metadata = node.data('metadata');
    let { synonyms = [], standardName = '', displayName = '' } = metadata;
    let label = node.data('label');

    return _.uniq([
      ...synonyms,
      standardName,
      displayName,
      label
    ]).filter( el => !_.isEmpty( el ) );
  };

  let matched = allNodes.filter(node => {
    let synonyms = getSyns(node);

    let synonymMatch = synonyms.find( synonym => synonym.toUpperCase().includes( query.toUpperCase() ));

    return synonymMatch != null;
  });

  allNodes.removeClass(MATCHED_SEARCH_CLASS);

  if ( matched.length > 0 && !queryEmpty ) {
    matched.addClass(MATCHED_SEARCH_CLASS);
  }
};

module.exports = {
  expandCollapse: expandCollapseAll(),
  fit,
  layout,
  searchNodes: _.debounce(searchNodes, 300),
  MATCHED_SEARCH_CLASS
};