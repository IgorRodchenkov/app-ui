const fs = require('fs');
const _ = require('lodash');
const { xref2Uri } = require('../../../../external-services/pathway-commons');

let extractBiopaxMetadata = biopaxJsonEntry => {
  let xrefLinks = _.get(biopaxJsonEntry, 'xrefLinks', []);
  let entRefEl = _.get(biopaxJsonEntry, 'entRefEl', []);

  let type = _.get(biopaxJsonEntry, '@type', '');
  let datasource = _.get(biopaxJsonEntry, 'dataSource', '');
  let comments = _.get(biopaxJsonEntry, 'comment', []);


  let entryDisplayName = _.get(biopaxJsonEntry, 'displayName', '');
  let entryNames = [].concat(_.get(biopaxJsonEntry, 'name', []));
  let entryStdName = _.get(biopaxJsonEntry, 'standardName', '');

  let entRefNames = _.get(entRefEl, 'name', []);
  let entRefStdName = _.get(entRefEl, 'standardName', '');
  let entRefDisplayName = _.get(entRefEl, 'displayName', '');


  let synonyms = (
    _.uniq(
      _.flatten( [entryNames, entRefNames] )
    ).filter( name => !_.isEmpty( name ) )
  );

  let standardName = entryStdName || entRefStdName || '';
  let displayName = entryDisplayName || entRefDisplayName || '';

  return {
    comments,
    synonyms,
    datasource,
    type: type.includes(':') ? type.split(':')[1] : type,
    standardName,
    displayName,
    xrefLinks
  };
};

// helper for converting xrefs to map of uris grouped by db
const xref2link = ( db, id, xrefLinks ) => {
  return xref2Uri( db, id )
    .then( uri => {
      if( xrefLinks[ db ] != null ){
        xrefLinks[ db ] = xrefLinks[ db ].concat( uri );
      } else {
        xrefLinks[ db ] = [ uri ];
      }
    })
    .catch( () => {}); //swallow
};

// transform biopaxJsonText into a consolidated js object
let biopaxText2ElementMap = async biopaxJsonText => {
  let rawMap = new Map();
  let elementMap = new Map();
  let xRefMap = new Map();

  let biopaxElementGraph = JSON.parse(biopaxJsonText)['@graph'];
  let externalReferences = [];

  biopaxElementGraph.forEach( element => {
    if( _.has(element, '@id') ){
      rawMap.set(element['@id'], element);
    }

    if( _.has(element, 'xref' ) ){
      externalReferences.push(element);
    }
  });

  // extract db ids from specific elements that have 'db' and 'id' fields
  externalReferences.forEach( element => {
    let xrefs = [].concat(_.get(element, 'xref', []));

    xrefs.forEach( xrefId => {
      if( rawMap.has( xrefId ) ){
        let { db, id } = rawMap.get( xrefId );

        if( db != null && id != null ){
          xRefMap.set(xrefId, { k: db, v: id });
        }
      }
    });
  });

  for ( const element of biopaxElementGraph ){
    let entityReference = _.get(element, 'entityReference', null);
    let xrefIds = [].concat( _.get(element, 'xref', []) );
    let elementId = _.get(element, '@id');
    let entRefEl = rawMap.get( entityReference );
    const xrefLinks = {};

    if( entRefEl != null ){
      let entRefXrefs = _.get(entRefEl, 'xref', []);
      xrefIds = xrefIds.concat( entRefXrefs );
    }

    const linkPromises = xrefIds.filter( xrefId => xrefId != null ).map( xrefId => {
      let { k, v } = xRefMap.get( xrefId );
      return xref2link( k, v, xrefLinks );
    });

    await Promise.all( linkPromises );

    // each 'element' does not contain all of the data we need, it
    // is scattered across various xref elements and entityReference elements.
    // we merge all this data into one object for easy processing
    elementMap.set( elementId, _.assign( element, { xrefLinks, entRefEl } ) );
  }

  return elementMap;
};


let getBiopaxMetadata = async ( cyJsonNodes, biopaxJsonText ) => {
  let bm = await biopaxText2ElementMap( biopaxJsonText );
  let cyJsonNodeMetadataMap = {};

  cyJsonNodes.forEach( node => {
    let nodeId = node.data.id;
    let altPCId = nodeId.substring(0, nodeId.lastIndexOf('_'));

    // weird legacy hack to get extra metadata for certain nodes that have PC prefixes
    if( bm.has( nodeId ) ){
      cyJsonNodeMetadataMap[nodeId] = extractBiopaxMetadata( bm.get(nodeId) );
    } else {
      if( bm.has( altPCId ) ){
        cyJsonNodeMetadataMap[nodeId] = extractBiopaxMetadata( bm.get(altPCId) );
      }
    }
  });

  return cyJsonNodeMetadataMap;
};


let getGenericPhysicalEntityMap = _.memoize(() => JSON.parse(
  fs.readFileSync(__dirname + '/generic-physical-entity-map.json', 'utf-8')
));



let getGenericPhyiscalEntityData = nodes => {
  let nodeGeneSynonyms = {};
  let genericPhysicalEntityMap = getGenericPhysicalEntityMap();

  nodes.forEach(node => {
    let genericPE = genericPhysicalEntityMap[node.data.id];
    let syns = _.get(genericPE, 'synonyms', []);
    if( syns == null) { syns = []; }
    nodeGeneSynonyms[node.data.id] = syns;
  });

  return nodeGeneSynonyms;
};


module.exports = { getBiopaxMetadata, getGenericPhyiscalEntityData };