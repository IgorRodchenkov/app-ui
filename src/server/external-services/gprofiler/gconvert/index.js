const _ = require('lodash');
const qs = require('query-string');
const QuickLRU = require('quick-lru');
const logger = require('../../../logger');

const { fetch } = require('../../../../util');
const cleanUpEntrez = require('../clean-up-entrez');
const InvalidParamError = require('../../../../server/errors/invalid-param');
const { GPROFILER_URL, PC_CACHE_MAX_SIZE, NS_HGNC, NS_HGNC_SYMBOL, NS_UNIPROT, NS_NCBI_GENE, NS_ENSEMBL } = require('../../../../config');
const { cachePromise } = require('../../../cache');
const GCONVERT_URL = GPROFILER_URL + 'gconvert.cgi';

const GPROFILER_NS_MAP = new Map([
  [NS_HGNC, 'HGNC_ACC'],
  [NS_HGNC_SYMBOL, 'HGNC'],
  [NS_UNIPROT, 'UNIPROTSWISSPROT'],
  [NS_NCBI_GENE, 'ENTREZGENE_ACC'],
  [NS_ENSEMBL, 'ENSG']
]);

const mapTarget = target  => {
  const gconvertNamespace = GPROFILER_NS_MAP.get( target );
  if( !gconvertNamespace ) throw new InvalidParamError( 'Unrecognized targetDb' );
  return gconvertNamespace;
};

const mapQuery = query => query.join(' ');

/*
 * mapParams
 * @param { object } params the input parameters
 */
const mapParams = params => {
  const target = mapTarget( params.target );
  const query = mapQuery( params.query );
  return _.assign({}, params, { target,  query });
};

/*
 * getForm
 * @param { array } query - Gene IDs
 * @param { object } userOptions
 * @returns { object } error and form
 */
const getForm = ( query, defaultOptions, userOptions ) => {

  let form = _.assign( {},
    defaultOptions,
    JSON.parse( JSON.stringify( userOptions ) ),
    { query: query }
  );

  if ( !Array.isArray( form.query ) ) {
    throw new InvalidParamError( 'Invalid query format' );
  }

  return mapParams( form );
};

const gConvertResponseHandler = body =>  {
  let entityInfoList = body.split('\n').map( ele => ele.split('\t') ).filter( ele => ele != '');
  let unrecognized = new Set();
  let duplicate = {};
  let entityMap = new Map();
  let alias = {};
  const INITIAL_ALIAS_INDEX = 1;
  const CONVERTED_ALIAS_INDEX = 3;

  entityInfoList.forEach( entityInfo => {
    let convertedAlias = entityInfo[CONVERTED_ALIAS_INDEX];
    let initialAlias = cleanUpEntrez(entityInfo[INITIAL_ALIAS_INDEX]);

    if( convertedAlias === 'N/A' ){
      unrecognized.add(initialAlias);
      return;
    }

    if( !entityMap.has( convertedAlias ) ){
      entityMap.set( convertedAlias, initialAlias );
    } else {
      if( duplicate[ convertedAlias ] == null ){
        duplicate[ convertedAlias ] = new Set([entityMap.get( convertedAlias )]);
      }
      duplicate[ convertedAlias ].add( initialAlias );
    }
  } );

  Object.keys( duplicate ).forEach( key => {
    duplicate[ key ] = Array.from( duplicate[ key ] ); // turn each set into a array for serialization
  } );

  return {
    unrecognized: Array.from( unrecognized ) || [],
    duplicate: duplicate || {},
    alias: alias || {}
  };
};



/* rawValidatorGconvert
 * @param { array } query - identifier list query
 * @param { object } userOptions - options
 * @return { object } list of unrecognized, object with duplicated and list of mapped IDs
 */
const rawValidatorGconvert = ( query, userOptions = {} ) => {

  const defaultOptions = {
    'output': 'mini',
    'organism': 'hsapiens',
    'target': NS_HGNC,
    'prefix': 'ENTREZGENE_ACC'
  };

  return Promise.resolve()
    .then( () => getForm( query, defaultOptions, userOptions ) )
    .then( form => fetch( GCONVERT_URL, {
      method: 'post',
      body: qs.stringify( form )
    }))
    .then( response => response.text() )
    .then( gConvertResponseHandler )
    .catch( err => {
      logger.error(`Error in validatorGconvert - ${err.message}`);
      throw err;
    });
};

const pcCache = new QuickLRU({ maxSize: PC_CACHE_MAX_SIZE });

const validatorGconvert = cachePromise(rawValidatorGconvert, pcCache);

module.exports = { validatorGconvert,
  getForm,
  mapParams,
  gConvertResponseHandler,
  GPROFILER_NS_MAP
};
