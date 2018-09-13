
const React = require('react');
const h = require('react-hyperscript');

const IconButton = require('../../common/components/icon-button');

const { INTERACTIONS_LAYOUT_OPTS, searchInteractionNodes } = require('./cy');

class InteractionsToolbar extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      searchValue: ''
    };
  }

  handleNodeSearchChange(searchVal){
    this.setState({ searchValue: searchVal }, () => searchInteractionNodes( this.props.cySrv.get(), searchVal));
  }

  render(){
    let { cySrv, activeMenu } = this.props;
    let { searchValue } = this.state;
    let cy = cySrv.get();

    return h('div.app-toolbar', [
      h(IconButton, {
        description: 'Downloads',
        onClick: () => {},
        isActive: activeMenu === 'interactionsDownloadMenu',
        icon: 'file_download'
      }),
      h(IconButton, {
        description: 'Fit to screen',
        onClick: () => cy.animate({
          fit: {
            eles: cy.nodes().filter( n => !n.hasClass('type-hidden') && !n.hasClass('metric-hidden')),
            padding: 25
          },
          easing: 'ease-in-out'
        }),
        isActive: false,
        icon: 'fullscreen'
      }),
      h(IconButton, {
        description: 'Reset arrangement',
        onClick: () => cy.layout(INTERACTIONS_LAYOUT_OPTS).run(),
        isActive: false,
        icon: 'replay'
      }),
      h('div.pathways-search-nodes', {
        onChange: e => this.handleNodeSearchChange(e.target.value)
      }, [
        h('div.pathways-search-bar', [
          h('input.pathways-search-input', {
            value: searchValue,
            type: 'search',
            placeholder: 'Search entities',
          }),
          searchValue !== '' ? h('div.pathways-search-clear', {
            onClick: () => this.handleNodeSearchChange('')}, [
            h('i.material-icons', 'close')
          ]) : null
        ])
      ])
    ]);
  }
}

module.exports = InteractionsToolbar;