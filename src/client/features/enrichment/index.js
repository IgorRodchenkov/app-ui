const React = require('react');
const h = require('react-hyperscript');
const _ = require('lodash');
//const Loader = require('react-loader');
//const queryString = require('query-string');

// const hideTooltips = require('../../common/cy/events/click').hideTooltips;
// const removeStyle= require('../../common/cy/manage-style').removeStyle;
// const make_cytoscape = require('../../common/cy/');
// const interactionsStylesheet= require('../../common/cy/interactions-stylesheet');
const TokenInput = require('./token-input');
const { BaseNetworkView } = require('../../common/components');
//const { getLayoutConfig } = require('../../common/cy/layout');
//const downloadTypes = require('../../common/config').downloadTypes;

const enrichmentConfig={
  //extablish toolbar and declare features to not include
  toolbarButtons: _.differenceBy(BaseNetworkView.config.toolbarButtons,[{'id': 'expandCollapse'}, {'id': 'showInfo'}],'id'),
  menus: BaseNetworkView.config.menus,
  //allow for searching of nodes
  useSearchBar: true
};


class Enrichment extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      componentConfig: enrichmentConfig,
      networkMetadata: {
        name: '',
        datasource: '',
        comments: []
      },
      titleContainer: [],
      invalidTokenContainer: [],
      tokenData: new Map()
    };

  }

  render() {
    const tokenInput = new TokenInput(this.state);
    const state = this.state;
    const baseView = h(BaseNetworkView.component, {
      componentConfig: state.componentConfig,
      //titles at top of toolbar
      networkMetadata: {},
      titleContainer: [
        h('h4', [
          h('span', 'Pathway Enrichment   '),]),
          h('img', {
            src: '/img/humanIcon.png'
            }),
          h('div.gene-input-container', [
            h('div.gene-input-box', {
             placeholder: 'Enter one gene per line',
             contentEditable: true,
             id: 'gene-input-box',
             onInput: () => tokenInput.handleChange(),
            })
          ]),
          h('submit-container', {
            onClick: () => {tokenInput.parseTokenList(); } },
            [h('button.submit', 'Submit'),]
          )
      ],
      invalidTokenContainer:
      h('div.invalid-token-container', {
        id: 'invalid-tokens'
      })
    });
    return h('div.main', [baseView]);
  }
}
module.exports = Enrichment;

//NOTE: CURRENTLY ONLY RENDERS ON PAGE WHEN base-network-view.js function 'componentDidMount(){}'
//      IS COMMENTED OUT