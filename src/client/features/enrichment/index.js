const React = require('react');
const h = require('react-hyperscript');
const _ = require('lodash');
const Loader = require('react-loader');
const classNames = require('classnames');
const queryString = require('query-string');

const { NS_HGNC_SYMBOL } = require('../../../config');

const EnrichmentDownloadMenu = require('./enrichment-download-menu');
const EnrichmentToolbar = require('./enrichment-toolbar');
const EnrichmentMenu = require('./enrichment-menu');
const EmptyNetwork = require('../../common/components/empty-network');
const PcLogoLink = require('../../common/components/pc-logo-link');
const CytoscapeNetwork = require('../../common/components/cytoscape-network');

const CytoscapeService = require('../../common/cy/');
const { ServerAPI } = require('../../services');

const { ENRICHMENT_MAP_LAYOUT, enrichmentStylesheet, bindEvents } = require('./cy');
class Enrichment extends React.Component {
  constructor(props){
    super(props);

    this.state = {
      cySrv: new CytoscapeService({ style: enrichmentStylesheet, onMount: bindEvents }),
      sources: _.uniq(queryString.parse(props.location.search).source.split(',')),
      errored: false,
      loading: true,
      invalidTokens: [],
      networkEmpty: false
    };

    if( process.env.NODE_ENV !== 'production' ){
      this.state.cySrv.getPromise().then(cy => window.cy = cy);
    }
  }

  componentDidMount(){
    this.loadEnrichment();
  }

  loadEnrichment(){
    let { sources, cySrv } = this.state;
    let cy = cySrv.get();

    let getNetworkJson = async () => {
      try {
        let { unrecognized, alias } = await ServerAPI.enrichmentAPI({ query: sources, targetDb: NS_HGNC_SYMBOL }, 'validation');
        let { pathwayInfo } = await ServerAPI.enrichmentAPI({ query: _.values( alias )}, 'analysis');
        let enrichmentNetwork = await ServerAPI.enrichmentAPI({ pathways: pathwayInfo }, 'visualization');

        cy.remove('*');
        cy.add({
          edges: enrichmentNetwork.graph.elements.edges,
          nodes: enrichmentNetwork.graph.elements.nodes
        });

        cy.layout( _.assign( {}, ENRICHMENT_MAP_LAYOUT, {
          stop: () => {
            this.setState({
              loading: false,
              invalidTokens: unrecognized,
              openToolBar: true
            });
          }
        })).run();

      } catch( e ){
        this.setState({
          errored: true,
          loading: false
        });
      }
    };

    this.setState({ loading: true, openToolbar: false, networkEmpty: false }, () => getNetworkJson());
  }

  render(){
    let { loading, cySrv, invalidTokens, networkEmpty, sources } = this.state;

    let appBar = h('div.app-bar.interactions-bar', [
      h('div.app-bar-branding', [
        h(PcLogoLink),
        h('div.app-bar-title', `Enrichment of ${ sources.slice(0, sources.length - 1).join(', ')} and ${sources.slice(-1)}`)
      ]),
      h(EnrichmentToolbar, { cySrv, sources: this.state.sources, controller: this })
    ]);

    return h('div.enrichment', [

      h(Loader, { loaded: !loading, options: { left: '50%', color: '#16a085' }}, [
        appBar
       ]),
      networkEmpty ? h(EmptyNetwork, { msg: 'No results to display', showPcLink: false} ) : null,
      h(CytoscapeNetwork, {
        cySrv,
        className: classNames({'network-loading': loading})
      })
    ]);
  }
}

module.exports = Enrichment;