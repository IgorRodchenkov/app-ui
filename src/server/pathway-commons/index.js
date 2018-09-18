const qs = require('querystring');
const fetch = require('node-fetch');
const _ = require('lodash');
const logger = require('./../logger');
const config = require('../../config');
const geneValidator = require('../enrichment/validation').validatorGconvert;


const fetchOptions = {
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
};

const _sanitize = (s) => {
  // Escape (with '\'), to treat them literally, symbols, such as '*', ':', or space,
  // which otherwise play special roles in a Lucene query string.
  return s.replace(/([!*+\-&|()[\]{}^~?:/\\"\s])/g, '\\$1');
};

const _processPhrase = (phrase) => {
  return geneValidator(phrase.split(' '),{}).then(result => {
    const genes = result.geneInfo.map(gene=>'xrefid:' + _sanitize(gene.initialAlias.toUpperCase()));
    const otherIds = result.unrecognized.map(id=>{
      id=id.toUpperCase();
      const recognized = /^SMP\d{5}$/.test(id) // check for a smpdb or chebi id
        ||/^CHEBI:\d+$/.test(id) && (id.length <= ("CHEBI:".length + 6));
      const sanitized = _sanitize(id);
      return recognized ? ( 'xrefid:' + sanitized ) : ( 'name:' + '*' + sanitized + '*' );
    });
    return genes.concat(otherIds);
  });
};

const _processQueryString = async (inputString) => {
  const keywords = await _processPhrase(inputString);
  const phrase = _sanitize(inputString);
  // return three search query candidates: the first one is the fastest, the last - slowest
  return [
    '(name:' + phrase + ') OR (' + 'name:*' + phrase + '*) OR (' + keywords.join(' AND ') + ')',
    '(' + keywords.join(' OR ') + ')',
    inputString //"as is" (won't additionally escape Lucene query syntax, spaces, etc.)
  ];
};

//Pathway Commons HTTP GET request; options.cmd = 'pc2/get', 'pc2/search', 'pc2/traverse', 'pc2/graph', etc.
const query = async (queryObj) => {
  queryObj.user = 'app-ui';
  let cmd = queryObj.cmd || 'pc2/get';
  //TODO: (not critical) client app's sends useless parameters to the PC server: cmd, lt, gt
  const url = config.PC_URL + cmd + '?' + qs.stringify(queryObj);
  return fetch(url, fetchOptions)
    .then(res => (cmd=='pc2/get'||cmd=='pc2/graph')?res.text():res.json())
    .catch((e) => {
      logger.error('query ' + queryObj + ' failed - ' + e);
      return null;
    });
};

// A fine-tuned PC search to improve relevance of full-text search and filter out unwanted hits.
// The argument (query object) has the following fields:
//  - q: user input - search query string
//  - type: BioPAX type to match/filter by
//  - lt: max graph size result returned
//  - gt: min graph size result returned
const _search = async (args) => {
  const minSize = args.gt || 0;
  const maxSize = args.lt || 250;
  //analyse the input string, generate specific (lucene) search sub-queries
  const queryString = args.q.trim();
  const queries = await _processQueryString(queryString);
  for (let q of queries) {
    args.cmd = 'pc2/search'; //PC command
    args.q = q; //override initial query.q string with the sub-query q
    const searchResult = await query(args); //up to 100 hits at once; if we need more, then must use 'page' parameter...
    const searchSuccess = searchResult != null;
    if (searchSuccess && searchResult.searchHit.length > 0) {
      const filteredResults = searchResult.searchHit.filter(hit => {
        const size = hit.numParticipants ? hit.numParticipants : 0;
        return minSize < size && size < maxSize;
      });
      if (filteredResults.length > 0) {
        return filteredResults;
      }
    }
  }

  return [];
};

//PC pathway data sources
const _datasources = () => {
  return fetch(config.PC_URL + 'pc2/metadata/datasources', fetchOptions)
  .then(res => res.json())
  .then(array => {
    const output = {};
    array.filter(source => source.notPathwayData == false).map(ds => {
      var name = (ds.name.length > 1) ? ds.name[1] : ds.name[0];
      output[ds.uri] = {
        id: ds.identifier,
        uri: ds.uri,
        name: name,
        description: ds.description,
        type: ds.type,
        iconUrl: ds.iconUrl,
        hasPathways: (ds.numPathways>0)?true:false
      };
    });
    return output; //filtered, simplified map
  })
  .catch(() => {
    return null;
  });
};

//PC pathway data sources
const _metadata = async () => {
  const meta = {};
  meta.version = await query({cmd:'pc2/traverse', path: 'Named/name', uri: "foo" }).then((json) => json.version);
  return meta; //TODO: get more metadata in the future (configuration, name, desc., logo, etc.)
};

//SifGraph
const sifGraph = async ( queryObj ) => {
  let path;
  const defaults = {
    limit: 1,
    pattern: ['CONTROLS_STATE_CHANGE_OF','CONTROLS_PHOSPHORYLATION_OF','CONTROLS_TRANSPORT_OF','CONTROLS_EXPRESSION_OF','CATALYSIS_PRECEDES','INTERACTS_WITH']
  };
  const params = _.assign(defaults, queryObj);

  if ( params.source.length > 1 ){
    path = 'pathsbetween';
    params.directed = 'false';
  } else {
    path = 'neighborhood';
    params.direction = 'UNDIRECTED';
  }

  const url = config.PC_URL + 'sifgraph/v1/' + path + '?' + qs.stringify(params);
  return fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'text/plain'
    }
  })
  .then( res => res.text() )
  .catch( e => {
    logger.error('sifGraph ' + queryObj + ' failed - ' + e);
    throw e;
  });
};

//cached functions
const datasources = _.memoize(_datasources);
const search = _.memoize(_search, query => JSON.stringify(query));
const metadata = _.memoize(_metadata);


module.exports = {query, search, datasources, metadata, sifGraph};