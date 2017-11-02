const MetadataTip = require('../../components/tooltips/metadataTip');

const bindClick = (cy) => {
  //Tippy JS Events
  //Binding actions (Try/Catch blocks re only for quick demo purposes)
  //Bind right click event to tippy.show()
  cy.on('cxttap', 'node', function (evt) {
      let data = evt.target.data();
      let name = data.label;
      let cy = evt.cy;

      //Create or get tooltip HTML object
      let html = evt.target.scratch('tooltip');
      if(!(html)){
        html = new MetadataTip(name, data, evt.target);
        evt.target.scratch('tooltip', html);
      }

      html.show(cy);
  });
};

module.exports = bindClick;