/* eslint-disable */

const { compileParcel } = require('./parcel-build');
const { copyCatapult } = require('./copy-catapult');
const { copyDevtoolsFrontend } = require('./copy-devtools-frontend');

module.exports = async () => {
  await Promise.all([ compileParcel({ production: true }), copyCatapult(), copyDevtoolsFrontend()]);
}
