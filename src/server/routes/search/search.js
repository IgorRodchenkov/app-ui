const _ = require('lodash');

const { NS_NCBI_GENE, NS_HGNC_SYMBOL, NS_UNIPROT } = require('../../../config');
const { validatorGconvert } = require('../../external-services/gprofiler/gconvert');
const pc = require('../../external-services/pathway-commons');
const { entityFetch } = require('../summary/entity');

const QUERY_MAX_CHARS = 5000; //temp - to be in config
const QUERY_MAX_TOKENS = 100; //temp - to be in config
const RAW_SEARCH_MAX_CHARS = 250; //temp - to be in config

const PATHWAY_SEARCH_DEFAULTS = {
  q: '',
  type: 'pathway'
};

// Get the HGNC Symbol from an EntitySummary's xrefLinks
const hgncSymbolsFromXrefs = xrefLinks => {
  let symbol;
  const hgncXrefLink = _.find( xrefLinks, link  => link.namespace === NS_HGNC_SYMBOL );
  if( hgncXrefLink ) symbol = _.last( _.compact( hgncXrefLink.uri.split('/') ) );
  return symbol;
};

const sanitize = ( rawQuery, maxLength = QUERY_MAX_CHARS ) => rawQuery.trim().substring( 0, maxLength );
const tokenize = ( rawQuery, maxNum = QUERY_MAX_TOKENS ) => rawQuery.split(/,?\s+/).slice( 0, maxNum ); //  limit token size?

// Take the entity summaries (summaries) and augment with xref corresponding to recommended name (name)
const fillInXref = async ( summaries, ncbiAlias, uniprotAlias, name ) => {
  const tokensWithUniprot = _.keys( uniprotAlias );
  for( const token of tokensWithUniprot ){
    const ncbiGeneId = ncbiAlias[ token ];
    const eSummary = _.find( summaries, s => s.localId === ncbiGeneId );
    if ( eSummary ) {
      // Use our internal service to grab the xref info
      const xref = await pc.xref2Uri( name, _.get( uniprotAlias, token ) );
      eSummary.xrefLinks.push( xref );
    }
  }
};

// Create an entity summary using NCBI, augmented with UniProt Xref
const getNcbiSummary = async ( ncbiAlias, uniprotAlias ) => {
  const ncbiIds = _.values( ncbiAlias );
  const summaries = await entityFetch( ncbiIds, NS_NCBI_GENE );
  await fillInXref( summaries, ncbiAlias, uniprotAlias, NS_UNIPROT );
  return summaries;
};

// Collect the summary, HGNC symbol and original query
const getGeneInfo = async ( uniqueTokens, ncbiAlias, uniprotAlias ) => {
  let geneInfo = [];
  const eSummaries = await getNcbiSummary( ncbiAlias, uniprotAlias );

  _.entries( ncbiAlias ).forEach( pair => { // pair is [ <token>, <ncbi gene id>]
    // get index of the original input token (must exist)
    const indexOfToken =  _.findIndex( uniqueTokens, t => t.toUpperCase() ===  pair[0] );
    // get index of the summary (must exist)
    const indexOfSummary =  _.findIndex( eSummaries, s => s.localId ===  pair[1] );
    const summary = eSummaries[ indexOfSummary ];
    geneInfo.push({
      query: uniqueTokens[ indexOfToken ],
      geneSymbol: hgncSymbolsFromXrefs( summary.xrefLinks ),
      summary
    });
  });
  return geneInfo;
};

const errorHandler = () => [];

// Return information about genes
const searchGenes = query => {
  const rawQuery = query.q;
  const tokens = tokenize( rawQuery );
  const uniqueTokens = _.uniq( tokens );

  return Promise.all([
    uniqueTokens,
    validatorGconvert( uniqueTokens, { target: NS_NCBI_GENE } ),
    validatorGconvert( uniqueTokens, { target: NS_UNIPROT } )
  ])
  .then( ([ uniqueTokens, ncbiValidation, uniprotValidation ]) => {
    const { alias: ncbiAlias } = ncbiValidation;
    const { alias: uniprotAlias } = uniprotValidation;
    return getGeneInfo( uniqueTokens, ncbiAlias, uniprotAlias );
  })
  .catch( errorHandler );
};

// Simple wrapper for pc search
const searchPathways = query => {
  const rawQuery = query.q;
  const sanitized = sanitize( rawQuery, RAW_SEARCH_MAX_CHARS );
  const opts = _.assign( {}, PATHWAY_SEARCH_DEFAULTS, query, { q: sanitized });
  return pc.search( opts )
    .catch( errorHandler );
};

/**
 * search
 * App search entrypoint which coordinates queries for pathways and other info (interactions).
 * @param { String } query Raw input to search by
 */
const search = async ( query ) => {
  return Promise.all([ searchGenes( query ), searchPathways( query ) ])
    .then( ([ genes, pathways ]) => {
      return { genes, pathways };
    } );
};

module.exports = { search };