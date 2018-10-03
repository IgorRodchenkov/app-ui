const fetch = require('node-fetch');
const _ = require('lodash');
const qs = require('query-string');
const LRUCache = require('lru-cache');

const { organisms, targetDatabases } = require('./gconvert-config');
const cleanUpEntrez = require('../clean-up-entrez');


const { GPROFILER_URL, PC_CACHE_MAX_SIZE } = require('../../../../config');
const cache = require('../../../cache');

const GCONVERT_URL = GPROFILER_URL + 'gconvert.cgi';


const resultTemplate = ( unrecognized, duplicate, geneInfo ) => {
  return {
    unrecognized: Array.from( unrecognized ) || [],
    duplicate: duplicate || {},
    geneInfo: geneInfo || []
  };
};

const mapDBNames = officalSynonym  => {
  officalSynonym = officalSynonym.toUpperCase();
  if ( officalSynonym === 'HGNCSYMBOL' ) { return 'HGNC'; }
  if ( officalSynonym === 'HGNC' ) { return 'HGNC_ACC'; }
  if ( officalSynonym === 'UNIPROT' ) { return 'UNIPROTSWISSPROT'; }
  if ( officalSynonym === 'NCBIGENE' ) { return 'ENTREZGENE_ACC'; }
  return officalSynonym;
};

/*
 * getForm
 * @param { array } query - Gene IDs
 * @param { object } userOptions
 * @returns { object } error and form
 */
const getForm = ( query, defaultOptions, userOptions ) => {

  const form = _.assign( {},
    defaultOptions,
    JSON.parse( JSON.stringify( userOptions ) ),
    { query: query }
  );

  if (!Array.isArray( form.query )) {
    throw new Error( 'Invalid genes: Must be an array' );
  }
  if ( !organisms.includes( form.organism.toLowerCase() ) ) {
    throw new Error( 'Invalid organism' );
  }
  if ( !targetDatabases.includes( form.target.toUpperCase() ) ) {
    throw new Error( 'Invalid target' );
  }

  form.target = mapDBNames( form.target );
  form.query = form.query.join(" ");

  return form;
};

const bodyHandler = body =>  {
  const geneInfoList = _.map(body.split('\n'), ele => { return ele.split('\t'); });
  geneInfoList.splice(-1, 1); // remove last element ''
  const unrecognized = new Set();
  let duplicate = {};
  const previous = new Map();
  let geneInfo = new Set();
  const initialAliasIndex = 1;
  const convertedAliasIndex = 3;
  _.forEach(geneInfoList, info => {
    const convertedAlias = info[convertedAliasIndex];
    let initialAlias = info[initialAliasIndex];
    initialAlias = cleanUpEntrez(initialAlias);
    if (convertedAlias === 'N/A') {
      unrecognized.add(initialAlias);
    } else {
      if (!previous.has(convertedAlias)) {
        previous.set(convertedAlias, initialAlias);
      } else {
        if (!(convertedAlias in duplicate)) {
          duplicate[convertedAlias] = new Set([previous.get(convertedAlias)]);
        }
        duplicate[convertedAlias].add(initialAlias);
      }
      geneInfo.add(JSON.stringify({initialAlias: initialAlias, convertedAlias: convertedAlias}));
    }
  });
  for (const initialAlias in duplicate) {
    duplicate[initialAlias] = Array.from(duplicate[initialAlias]);
  }
  geneInfo = _.map(Array.from(geneInfo), ele => { return JSON.parse(ele); });
  return resultTemplate( unrecognized, duplicate, geneInfo );
};



/* rawValidatorGconvert
 * @param { array } query - identifier list query
 * @param { object } userOptions - options
 * @return { object } list of unrecognized, object with duplicated and list of mapped IDs
 */
const rawValidatorGconvert = ( query, userOptions ) => {

  const defaultOptions = {
    'output': 'mini',
    'organism': 'hsapiens',
    'target': 'HGNC',
    'prefix': 'ENTREZGENE_ACC'
  };

  return new Promise(( resolve, reject ) => {
    const form = getForm( query, defaultOptions, userOptions );

    fetch( GCONVERT_URL, {
        method: 'post',
        body: qs.stringify( form )
    })
    .then( response => response.text() )
    .then( bodyHandler )
    .then( resolve )
    .catch( reject );
  });
};

const pcCache = LRUCache({ max: PC_CACHE_MAX_SIZE, length: () => 1 });

const validatorGconvert = cache(rawValidatorGconvert, pcCache);

module.exports = { validatorGconvert };