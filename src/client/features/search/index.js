const React = require('react');
const h = require('react-hyperscript');
const Link = require('react-router-dom').Link;
const Loader = require('react-loader');

const queryString = require('query-string');
const _ = require('lodash');

const { ServerAPI } = require('../../services');

const PcLogoLink = require('../../common/components/pc-logo-link');

const { PathwayResultsView } = require('./pathway-results-view');
const { GeneResultsView } = require('./gene-results-view');

class Search extends React.Component {

  constructor(props) {
    super(props);

    const query = queryString.parse(props.location.search);

    this.state = {
      query: _.assign({
        q: '',
        type: 'Pathway',
        datasource: []
      }, query),
      geneResults: [],
      pathwayResults: [],
      loading: false
    };
  }

  getSearchResult() {
    const state = this.state;
    const query = state.query;

    if (query.q !== '') {
      this.setState({
        loading: true,
      });
      ServerAPI.search( query ).then( res => {
        let { genes, pathways } = res;
        this.setState({
          geneResults: genes,
          pathwayResults: pathways,
          loading: false
         });
      });
    }
  }

  componentDidMount() {
    this.getSearchResult();
  }

  onSearchValueChange(e) {
    // if the user presses enter, submit the query
    if (e.which && e.which === 13) {
      this.submitSearchQuery(e);
    } else {
      const newQueryState = _.assign({}, this.state.query);
      newQueryState.q = e.target.value;
      this.setState({ query: newQueryState });
    }
  }

  setAndSubmitSearchQuery(query) {
    const state = this.state;
    if (!state.searchLoading) {
      const newQueryState = _.assign({}, state.query, query);
      this.setState({ query: newQueryState }, () => this.submitSearchQuery());
    }
  }

  submitSearchQuery() {
    const props = this.props;
    const state = this.state;
    const query = state.query;

    props.history.push({
      pathname: '/search',
      search: queryString.stringify(query),
      state: {}
    });
    this.getSearchResult();
  }

  componentWillReceiveProps (nextProps) {
    const nextSearch = nextProps.location.search;
    if( this.props.location.search !==  nextSearch){
      this.setState({
        query: _.assign({
          q: '',
          gt: 0,
          lt: 250,
          type: 'Pathway',
          datasource: []
          }, queryString.parse(nextSearch))} , ()=>{
            this.getSearchResult();
          });
    }
  }

  render() {
    let { geneResults, pathwayResults, query, loading } = this.state;

    const notFoundErrorMessage = h('div.search-error', [
      h('h1', 'We can\'t find the the resource you are looking for'),
      h('p', [
        h('span', 'If difficulties persist, please report this to our '),
        h('a.plain-link', { href: 'mailto: pathway-commons-help@googlegroups.com' }, 'help forum.')
      ])
    ]);

    const searchListing = h(Loader, { loaded: !loading, options: { left: '50%', color: '#16A085' } }, [
      h('div.search-body', [
        geneResults.length > 0 ? h(GeneResultsView, { geneResults } ) : null,
        h(PathwayResultsView, { pathwayResults, curDatasource: query.datasource, controller: this})
      ])
    ]);

    const searchBody =  this.props.notFoundError ? notFoundErrorMessage : searchListing;

    return h('div.search', [
      h('div.search-header', [
        h('div.search-branding', [
          h(PcLogoLink, { className: 'search-logo'} ),
          h('div.search-branding-descriptor', [
            h('h2.search-subtitle', 'Pathway Commons'),
            h('h1.search-title', 'Search')
          ])
        ]),
        h('div.search-searchbar-container', {
          ref: dom => this.searchBar = dom
        }, [
          h('div.search-searchbar', [
            h('input', {
              type: 'text',
              placeholder: 'Enter pathway name or gene names',
              value: query.q,
              maxLength: 250, // 250 chars max of user input
              onChange: e => this.onSearchValueChange(e),
              onKeyPress: e => this.onSearchValueChange(e)
            }),
            h(Link, { to: { pathname: '/search', search: queryString.stringify(query)},className:"search-search-button"}, [
              h('i.material-icons', 'search')
            ])
          ]),
          h('div.search-suggestions', [
            'e.g. ',
            h(Link, { to: { pathname: '/search', search: queryString.stringify(_.assign({}, query, {q: 'cell cycle'})) }}, 'cell cycle, '),
            h(Link, { to: { pathname: '/search', search: queryString.stringify(_.assign({}, query, {q: 'TP53 MDM2'})) }}, 'TP53 MDM2, '),
            h(Link, { to: { pathname: '/search', search: queryString.stringify(_.assign({}, query, {q: 'P04637'})) }}, 'P04637')
          ])
        ])
      ]),
      h('div', [searchBody])
    ]);
  }
}

module.exports = Search;
