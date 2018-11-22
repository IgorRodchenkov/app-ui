const React = require('react');
const h = require('react-hyperscript');
const saveAs = require('file-saver').saveAs;
const Loader = require('react-loader');


class EnrichmentDownloadMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false
    };
  }

  downloadPng(){
    let { cySrv } = this.props;
    let cy = cySrv.get();

    let saveCyPng = () =>{
      setTimeout(() => {
        saveAs(cy.png({
          output: 'blob',
          scale: 2,
          bg: 'white',
          full: true
        }), `enrichment-map.png`);
        this.setState({ loading: false });
      }, 1);
    };

    this.setState({ loading: true }, () => saveCyPng() );
  }

  downloadJson(){
    let { cySrv } = this.props;
    let cy = cySrv.get();
    let saveCyJson = () => {
      setTimeout(() => {
        saveAs(cy.json({
          output: 'blob',
          scale: 2,
          bg: 'white',
          full: true
        }), `enrichment-map.json`);
        this.setState({ loading: false });
      }, 1);
    };

    this.setState({ loading: true }, () => saveCyJson() );
  }

  render() {
    return h('div.file-download-menu', [
      h('h2', 'Network Downloads'),
      h('div.file-download-content', [
        h('div.download-option', { onClick: () => this.downloadPng() }, [
          h('div.download-option-header', [
            h('h3', 'Image (PNG)'),
          ]),
          h('div.download-option-description', 'Download an image of the entire view')
        ]),
        h('div.download-option', { onClick: () => this.downloadJson() }, [
          h('div.download-option-header', [
            h('h3', 'Cytoscape JSON'),
          ]),
          h('div.download-option-description', 'Download a Cytoscape Desktop compatible JSON file')
        ]),
        h(Loader, { loaded: !this.state.loading })
      ])
    ]);
  }
}

module.exports = EnrichmentDownloadMenu;